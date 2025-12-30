import { z } from "zod";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db, ColumnType, Prisma } from "~/server/db";

const DEFAULT_COLS = [
  { name: "Name", type: ColumnType.TEXT },
  { name: "Notes", type: ColumnType.TEXT },
  { name: "Amount", type: ColumnType.NUMBER },
] as const;

type AuthedCtx = {
  db: typeof db;
  session: { user: { id: string } };
};

function tableOwnedWhere(ctx: AuthedCtx, baseId: string, tableId: string) {
  return {
    id: tableId,
    baseId,
    base: { ownerId: ctx.session.user.id },
  } as const;
}

async function requireBaseOwned(ctx: AuthedCtx, baseId: string) {
  const base = await ctx.db.base.findFirst({
    where: { id: baseId, ownerId: ctx.session.user.id },
    select: { id: true },
  });
  if (!base) throw new TRPCError({ code: "NOT_FOUND", message: "Base not found" });
  return base;
}

async function requireTableOwned(ctx: AuthedCtx, baseId: string, tableId: string) {
  const table = await ctx.db.table.findFirst({
    where: tableOwnedWhere(ctx, baseId, tableId),
    select: { id: true },
  });
  if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
  return table;
}

// --------------------
// ViewConfig (stored in View.config as JSON)
// --------------------
const textFilterSchema = z.object({
  kind: z.literal("text"),
  columnId: z.string().min(1),
  op: z.enum(["is_empty", "is_not_empty", "contains", "not_contains", "equals"]),
  value: z.string().trim().min(1).max(200).optional(),
});

const numberFilterSchema = z.object({
  kind: z.literal("number"),
  columnId: z.string().min(1),
  op: z.enum(["is_empty", "is_not_empty", "gt", "lt", "equals"]),
  value: z.number().finite().optional(),
});

const viewFilterSchema = z.union([textFilterSchema, numberFilterSchema]);

const viewSortSchema = z.object({
  columnId: z.string().min(1),
  direction: z.enum(["asc", "desc"]),
});

const viewConfigSchema = z
  .object({
    filters: z.array(viewFilterSchema).default([]),
    sort: viewSortSchema.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    hiddenColumnIds: z.array(z.string().min(1)).default([]),
  })
  .passthrough();

type ViewConfig = z.infer<typeof viewConfigSchema>;
type ViewFilter = z.infer<typeof viewFilterSchema>;
type ViewSort = z.infer<typeof viewSortSchema>;

// cursor used ONLY when sort is active (keyset pagination)
const sortCursorSchema = z.object({
  mode: z.literal("sort"),
  nullRank: z.number().int().min(0).max(1),
  t: z.string().nullable().optional(),
  n: z.number().nullable().optional(),
  rowIndex: z.number().int(),
});

const rowsCursorSchema = z.union([z.number().int(), sortCursorSchema]).optional();
type SortCursor = z.infer<typeof sortCursorSchema>;

function ilikePattern(q: string) {
  return `%${q}%`;
}

function filterToSql(
  f: ViewFilter,
  colType: ColumnType,
): Prisma.Sql | null {
  // If config got stale (column type changed), ignore filter rather than breaking the view.
  if (f.kind === "text" && colType !== ColumnType.TEXT) return null;
  if (f.kind === "number" && colType !== ColumnType.NUMBER) return null;

  // "empty" means missing cell OR cell exists but both values null
  const nonEmptyCheck =
    colType === ColumnType.TEXT
      ? Prisma.sql`c."textValue" IS NOT NULL`
      : Prisma.sql`c."numberValue" IS NOT NULL`;

  if (f.op === "is_empty") {
    return Prisma.sql`
      NOT EXISTS (
        SELECT 1 FROM "Cell" c
        WHERE c."rowId" = r.id
          AND c."columnId" = ${f.columnId}
          AND (${nonEmptyCheck})
      )
    `;
  }

  if (f.op === "is_not_empty") {
    return Prisma.sql`
      EXISTS (
        SELECT 1 FROM "Cell" c
        WHERE c."rowId" = r.id
          AND c."columnId" = ${f.columnId}
          AND (${nonEmptyCheck})
      )
    `;
  }

  if (f.kind === "text") {
    if (!f.value) return null;

    if (f.op === "contains") {
      const pat = ilikePattern(f.value);
      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND COALESCE(c."textValue", '') ILIKE ${pat}
        )
      `;
    }

    if (f.op === "not_contains") {
      const pat = ilikePattern(f.value);
      return Prisma.sql`
        NOT EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND COALESCE(c."textValue", '') ILIKE ${pat}
        )
      `;
    }

    if (f.op === "equals") {
      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND c."textValue" = ${f.value}
        )
      `;
    }

    return null;
  }

  // number filters
  if (f.kind === "number") {
    if (f.op === "gt") {
      if (typeof f.value !== "number") return null;
      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND c."numberValue" > ${f.value}
        )
      `;
    }

    if (f.op === "lt") {
      if (typeof f.value !== "number") return null;
      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND c."numberValue" < ${f.value}
        )
      `;
    }

    if (f.op === "equals") {
      if (typeof f.value !== "number") return null;
      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Cell" c
          WHERE c."rowId" = r.id
            AND c."columnId" = ${f.columnId}
            AND c."numberValue" = ${f.value}
        )
      `;
    }

    return null;
  }

  return null;
}

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireBaseOwned(ctx as AuthedCtx, input.baseId);

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),

  getMeta: protectedProcedure
    .input(z.object({ baseId: z.string().min(1), tableId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const table = await ctx.db.table.findFirst({
        where: tableOwnedWhere(ctx as AuthedCtx, input.baseId, input.tableId),
        select: {
          id: true,
          name: true,
          baseId: true,
          columns: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, type: true, order: true },
          },
          _count: { select: { rows: true } },
        },
      });

      if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });

      return {
        id: table.id,
        name: table.name,
        baseId: table.baseId,
        columns: table.columns,
        rowCount: table._count.rows,
      };
    }),

  rowsInfinite: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        viewId: z.string().min(1).optional(),
        cursor: rowsCursorSchema,
        limit: z.number().int().min(10).max(500).default(50),
        q: z.string().trim().min(1).max(200).optional(), // optional override
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      // Load view config (use provided viewId; otherwise fall back to earliest view)
      const view = await ctx.db.view.findFirst({
        where: input.viewId
          ? {
              id: input.viewId,
              tableId: input.tableId,
              table: { baseId: input.baseId, base: { ownerId: ctx.session.user.id } },
            }
          : {
              tableId: input.tableId,
              table: { baseId: input.baseId, base: { ownerId: ctx.session.user.id } },
            },
        orderBy: input.viewId ? undefined : { createdAt: "asc" },
        select: { id: true, config: true },
      });

      const config: ViewConfig = viewConfigSchema.parse(view?.config ?? {});

      // Effective search query: input.q overrides view config
      const q = (input.q?.trim() || config.q?.trim() || undefined) ?? undefined;
      const limit = input.limit;

      // Gather referenced columns (filters + sort) for type validation
      const referencedColIds = Array.from(
        new Set([
          ...config.filters.map((f) => f.columnId),
          ...(config.sort ? [config.sort.columnId] : []),
        ]),
      );

      const cols = referencedColIds.length
        ? await ctx.db.column.findMany({
            where: { tableId: input.tableId, id: { in: referencedColIds } },
            select: { id: true, type: true },
          })
        : [];

      const colTypeById = new Map(cols.map((c) => [c.id, c.type] as const));

      // Build WHERE parts: tableId + (rowIndex cursor when no sort) + filters + search
      const whereParts: Prisma.Sql[] = [Prisma.sql`r."tableId" = ${input.tableId}`];

      // filters
      for (const f of config.filters) {
        const colType = colTypeById.get(f.columnId);
        if (!colType) continue; // stale config: column deleted
        const sql = filterToSql(f, colType);
        if (sql) whereParts.push(sql);
      }

      // search across all cells
      if (q) {
        const pat = ilikePattern(q);
        whereParts.push(Prisma.sql`
          EXISTS (
            SELECT 1 FROM "Cell" c
            WHERE c."rowId" = r.id
              AND COALESCE(c."textValue", c."numberValue"::text, '') ILIKE ${pat}
          )
        `);
      }

      const sort: ViewSort | undefined = (() => {
        const s = config.sort;
        if (!s) return undefined;
        if (!colTypeById.get(s.columnId)) return undefined; // stale sort column
        return s;
      })();

      // --------------------
      // CASE A: No sort => rowIndex pagination (existing)
      // --------------------
      if (!sort) {
        const start =
          typeof input.cursor === "number" ? input.cursor : 0;

        whereParts.push(Prisma.sql`r."rowIndex" >= ${start}`);

        const matches = await ctx.db.$queryRaw<Array<{ id: string; rowIndex: number }>>(
          Prisma.sql`
            SELECT r.id, r."rowIndex" as "rowIndex"
            FROM "Row" r
            WHERE ${Prisma.join(whereParts, Prisma.sql` AND `)}
            ORDER BY r."rowIndex" ASC
            LIMIT ${limit};
          `,
        );

        if (matches.length === 0) return { rows: [], nextCursor: null };

        const matchIds = matches.map((m) => m.id);

        const rows = await ctx.db.row.findMany({
          where: { id: { in: matchIds }, tableId: input.tableId },
          select: {
            id: true,
            rowIndex: true,
            cells: { select: { columnId: true, textValue: true, numberValue: true } },
          },
        });

        const byId = new Map(rows.map((r) => [r.id, r] as const));
        const ordered = matches.map((m) => byId.get(m.id)!).filter(Boolean);

        const nextCursor =
          ordered.length === limit ? ordered[ordered.length - 1]!.rowIndex + 1 : null;

        return { rows: ordered, nextCursor };
      }

      // --------------------
      // CASE B: Sort => keyset pagination
      // --------------------
      const sortColType = colTypeById.get(sort.columnId);
      if (!sortColType) {
        // stale config, fall back
        return { rows: [], nextCursor: null };
      }

      const direction = sort.direction; // "asc" | "desc"
      const dirRaw = direction === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");

      // cursor parsing (only meaningful when sort is active)
      const sortCursor: SortCursor | null =
        typeof input.cursor === "object" && input.cursor?.mode === "sort"
          ? input.cursor
          : null;

      // Build sort expressions based on column type
      const nullRankExpr =
        sortColType === ColumnType.TEXT
          ? Prisma.sql`CASE WHEN sc."textValue" IS NULL THEN 1 ELSE 0 END`
          : Prisma.sql`CASE WHEN sc."numberValue" IS NULL THEN 1 ELSE 0 END`;

      const sortExpr =
        sortColType === ColumnType.TEXT
          ? Prisma.sql`COALESCE(sc."textValue", '')`
          : Prisma.sql`COALESCE(sc."numberValue", 0)`;

      // Keyset condition
      if (sortCursor) {
        const curNullRank = sortCursor.nullRank;
        const curRowIndex = sortCursor.rowIndex;

        if (sortColType === ColumnType.TEXT) {
          const curVal = (sortCursor.t ?? "") as string;

          if (direction === "asc") {
            whereParts.push(Prisma.sql`
              (
                (${nullRankExpr} > ${curNullRank})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} > ${curVal})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} = ${curVal} AND r."rowIndex" > ${curRowIndex})
              )
            `);
          } else {
            whereParts.push(Prisma.sql`
              (
                (${nullRankExpr} > ${curNullRank})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} < ${curVal})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} = ${curVal} AND r."rowIndex" > ${curRowIndex})
              )
            `);
          }
        } else {
          const curVal = (sortCursor.n ?? 0) as number;

          if (direction === "asc") {
            whereParts.push(Prisma.sql`
              (
                (${nullRankExpr} > ${curNullRank})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} > ${curVal})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} = ${curVal} AND r."rowIndex" > ${curRowIndex})
              )
            `);
          } else {
            whereParts.push(Prisma.sql`
              (
                (${nullRankExpr} > ${curNullRank})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} < ${curVal})
                OR (${nullRankExpr} = ${curNullRank} AND ${sortExpr} = ${curVal} AND r."rowIndex" > ${curRowIndex})
              )
            `);
          }
        }
      }

      type MatchSorted = {
        id: string;
        rowIndex: number;
        nullRank: number;
        sortText: string | null;
        sortNumber: number | null;
      };

      const matches = await ctx.db.$queryRaw<MatchSorted[]>(
        Prisma.sql`
          SELECT
            r.id,
            r."rowIndex" as "rowIndex",
            (${nullRankExpr})::int as "nullRank",
            sc."textValue" as "sortText",
            sc."numberValue" as "sortNumber"
          FROM "Row" r
          LEFT JOIN "Cell" sc
            ON sc."rowId" = r.id
           AND sc."columnId" = ${sort.columnId}
          WHERE ${Prisma.join(whereParts, Prisma.sql` AND `)}
          ORDER BY
            (${nullRankExpr}) ASC,
            ${sortExpr} ${dirRaw},
            r."rowIndex" ASC
          LIMIT ${limit};
        `,
      );

      if (matches.length === 0) return { rows: [], nextCursor: null };

      const matchIds = matches.map((m) => m.id);

      const rows = await ctx.db.row.findMany({
        where: { id: { in: matchIds }, tableId: input.tableId },
        select: {
          id: true,
          rowIndex: true,
          cells: { select: { columnId: true, textValue: true, numberValue: true } },
        },
      });

      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const ordered = matches.map((m) => byId.get(m.id)!).filter(Boolean);

      const last = matches[matches.length - 1]!;
      const nextCursor =
        matches.length === limit
          ? ({
              mode: "sort",
              nullRank: last.nullRank,
              t: last.sortText ?? null,
              n: last.sortNumber ?? null,
              rowIndex: last.rowIndex,
            } satisfies SortCursor)
          : null;

      return { rows: ordered, nextCursor };
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        name: z.string().min(1).max(80),
        seedRows: z.number().int().min(0).max(1000).default(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireBaseOwned(ctx as AuthedCtx, input.baseId);

      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: { name: input.name, baseId: input.baseId },
          select: { id: true, name: true },
        });

        const createdCols = await Promise.all(
          DEFAULT_COLS.map((c, idx) =>
            tx.column.create({
              data: { tableId: table.id, name: c.name, type: c.type, order: idx },
              select: { id: true, name: true, type: true, order: true },
            }),
          ),
        );

        const rowCount = input.seedRows ?? 50;
        const createdRows = await Promise.all(
          Array.from({ length: rowCount }).map((_, i) =>
            tx.row.create({
              data: { tableId: table.id, rowIndex: i },
              select: { id: true, rowIndex: true },
            }),
          ),
        );

        const cellData: Array<{
          rowId: string;
          columnId: string;
          textValue?: string;
          numberValue?: number;
        }> = [];

        for (const row of createdRows) {
          for (const col of createdCols) {
            if (col.type === ColumnType.TEXT) {
              const v =
                col.name === "Name"
                  ? faker.person.fullName()
                  : faker.lorem.sentence({ min: 3, max: 8 });
              cellData.push({ rowId: row.id, columnId: col.id, textValue: v });
            } else {
              cellData.push({
                rowId: row.id,
                columnId: col.id,
                numberValue: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
              });
            }
          }
        }

        await tx.cell.createMany({ data: cellData });

        // ✅ default view for the table
        await tx.view.create({
          data: {
            tableId: table.id,
            name: "Grid view",
            // minimal config; UI can extend later
            config: { filters: [], hiddenColumnIds: [] },
          },
          select: { id: true },
        });

        return { table, columns: createdCols, seededRows: rowCount };
      });

      return result;
    }),

  // SPEC: add blank rows only (no cells created)
  addRows: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        count: z.number().int().min(1).max(1_000_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const agg = await ctx.db.row.aggregate({
        where: { tableId: input.tableId },
        _max: { rowIndex: true },
      });

      const start = (agg._max.rowIndex ?? -1) + 1;
      const total = input.count;

      const BATCH = 5_000;
      for (let offset = 0; offset < total; offset += BATCH) {
        const size = Math.min(BATCH, total - offset);

        const data = Array.from({ length: size }, (_, i) => ({
          tableId: input.tableId,
          rowIndex: start + offset + i,
        }));

        await ctx.db.row.createMany({
          data,
          skipDuplicates: true,
        });
      }

      return {
        added: total,
        startRowIndex: start,
        endRowIndex: start + total - 1,
      };
    }),

  setCellValue: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        rowId: z.string().min(1),
        columnId: z.string().min(1),
        value: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const [row, col] = await Promise.all([
        ctx.db.row.findFirst({
          where: { id: input.rowId, tableId: input.tableId },
          select: { id: true },
        }),
        ctx.db.column.findFirst({
          where: { id: input.columnId, tableId: input.tableId },
          select: { id: true, type: true },
        }),
      ]);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Row not found" });
      if (!col) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

      const trimmed = input.value.trim();

      const next =
        col.type === ColumnType.TEXT
          ? { textValue: trimmed === "" ? null : trimmed, numberValue: null }
          : (() => {
              if (trimmed === "") return { textValue: null, numberValue: null };
              const n = Number(trimmed);
              if (Number.isNaN(n)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid number" });
              }
              return { textValue: null, numberValue: n };
            })();

      const cell = await ctx.db.cell.upsert({
        where: {
          rowId_columnId: {
            rowId: input.rowId,
            columnId: input.columnId,
          },
        },
        create: { rowId: input.rowId, columnId: input.columnId, ...next },
        update: next,
        select: { columnId: true, textValue: true, numberValue: true },
      });

      return { rowId: input.rowId, ...cell };
    }),

  addColumn: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        name: z.string().min(1).max(80),
        type: z.nativeEnum(ColumnType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const max = await ctx.db.column.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });
      const nextOrder = (max._max.order ?? -1) + 1;

      const existing = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { name: true },
      });
      const used = new Set(existing.map((c) => c.name.toLowerCase()));

      const baseName = input.name.trim() || "Field";
      let finalName = baseName;
      let i = 2;
      while (used.has(finalName.toLowerCase())) {
        finalName = `${baseName} ${i++}`;
      }

      const col = await ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: finalName,
          type: input.type,
          order: nextOrder,
        },
        select: { id: true, name: true, type: true, order: true },
      });

      return col;
    }),

  deleteColumn: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        columnId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const col = await ctx.db.column.findFirst({
        where: {
          id: input.columnId,
          tableId: input.tableId,
          table: {
            baseId: input.baseId,
            base: { ownerId: ctx.session.user.id },
          },
        },
        select: { id: true },
      });

      if (!col) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

      await ctx.db.column.delete({ where: { id: col.id } });
      return { ok: true };
    }),

  moveColumn: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        columnId: z.string().min(1),
        direction: z.enum(["left", "right"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const cols = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        orderBy: { order: "asc" },
        select: { id: true, order: true },
      });

      const idx = cols.findIndex((c) => c.id === input.columnId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

      const nextIdx = input.direction === "left" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= cols.length) return { ok: true };

      const reordered = [...cols];
      [reordered[idx], reordered[nextIdx]] = [reordered[nextIdx]!, reordered[idx]!];

      await ctx.db.$transaction(async (tx) => {
        await tx.column.updateMany({
          where: { tableId: input.tableId },
          data: { order: { increment: 1000 } },
        });

        for (let i = 0; i < reordered.length; i++) {
          await tx.column.update({ where: { id: reordered[i]!.id }, data: { order: i } });
        }
      });

      return { ok: true };
    }),

  reorderColumns: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        orderedColumnIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const existing = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
        select: { id: true },
      });

      const existingSet = new Set(existing.map((c) => c.id));
      if (existing.length !== input.orderedColumnIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid column ordering" });
      }
      for (const id of input.orderedColumnIds) {
        if (!existingSet.has(id)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid column ordering" });
        }
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.column.updateMany({
          where: { tableId: input.tableId },
          data: { order: { increment: 1000 } },
        });

        for (let i = 0; i < input.orderedColumnIds.length; i++) {
          await tx.column.update({
            where: { id: input.orderedColumnIds[i]! },
            data: { order: i },
          });
        }
      });

      return { ok: true };
    }),

  renameColumn: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        columnId: z.string().min(1),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextName = input.name.trim();
      if (!nextName) throw new TRPCError({ code: "BAD_REQUEST", message: "Name required" });

      const col = await ctx.db.column.findFirst({
        where: {
          id: input.columnId,
          tableId: input.tableId,
          table: {
            baseId: input.baseId,
            base: { ownerId: ctx.session.user.id },
          },
        },
        select: { id: true },
      });

      if (!col) throw new TRPCError({ code: "NOT_FOUND", message: "Column not found" });

      try {
        const updated = await ctx.db.column.update({
          where: { id: col.id },
          data: { name: nextName },
          select: { id: true, name: true },
        });

        return updated;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A column with that name already exists",
          });
        }
        throw e;
      }
    }),
});
