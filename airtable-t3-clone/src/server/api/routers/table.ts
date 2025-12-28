import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ColumnType, Prisma } from "~/server/db";
import { TRPCError } from "@trpc/server";

const DEFAULT_COLS = [
  { name: "Name", type: ColumnType.TEXT },
  { name: "Notes", type: ColumnType.TEXT },
  { name: "Amount", type: ColumnType.NUMBER },
] as const;

// ✅ type-safe DB type without importing runtime db
type DB = typeof import("~/server/db").db;

function tableOwnedWhere(baseId: string, tableId: string, ownerId: string) {
  return {
    id: tableId,
    baseId,
    base: { ownerId },
  } as const;
}

async function requireBaseOwned(db: DB, baseId: string, ownerId: string) {
  const base = await db.base.findFirst({
    where: { id: baseId, ownerId },
    select: { id: true },
  });

  if (!base) throw new TRPCError({ code: "NOT_FOUND", message: "Base not found" });
  return base;
}

async function requireTableOwned(db: DB, baseId: string, tableId: string, ownerId: string) {
  const table = await db.table.findFirst({
    where: tableOwnedWhere(baseId, tableId, ownerId),
    select: { id: true },
  });

  if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
  return table;
}

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.session.user.id;
      await requireBaseOwned(ctx.db, input.baseId, ownerId);

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),

  getMeta: protectedProcedure
    .input(z.object({ baseId: z.string().min(1), tableId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

      const table = await ctx.db.table.findFirst({
        where: tableOwnedWhere(input.baseId, input.tableId, ownerId),
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
        cursor: z.number().int().optional(),
        limit: z.number().int().min(10).max(500).default(50),
        q: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

      const start = input.cursor ?? 0;
      const q = input.q?.trim();

      // ✅ Normal browse mode
      if (!q) {
        const rows = await ctx.db.row.findMany({
          where: { tableId: input.tableId, rowIndex: { gte: start } },
          orderBy: { rowIndex: "asc" },
          take: input.limit,
          select: {
            id: true,
            rowIndex: true,
            cells: { select: { columnId: true, textValue: true, numberValue: true } },
          },
        });

        const nextCursor =
          rows.length === input.limit ? rows[rows.length - 1]!.rowIndex + 1 : null;

        return { rows, nextCursor };
      }

      // ✅ Search mode
      const matches = await ctx.db.$queryRaw<Array<{ id: string; rowIndex: number }>>`
        SELECT r.id, r."rowIndex" as "rowIndex"
        FROM "Row" r
        WHERE r."tableId" = ${input.tableId}
          AND r."rowIndex" >= ${start}
          AND EXISTS (
            SELECT 1
            FROM "Cell" c
            WHERE c."rowId" = r.id
              AND (COALESCE(c."textValue", c."numberValue"::text, '') ILIKE '%' || ${q} || '%')
          )
        ORDER BY r."rowIndex" ASC
        LIMIT ${input.limit};
      `;

      if (matches.length === 0) {
        return { rows: [], nextCursor: null };
      }

      const matchIds = matches.map((m) => m.id);

      const rows = await ctx.db.row.findMany({
        where: { id: { in: matchIds } },
        select: {
          id: true,
          rowIndex: true,
          cells: { select: { columnId: true, textValue: true, numberValue: true } },
        },
      });

      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const ordered = matches.map((m) => byId.get(m.id)!).filter(Boolean);

      const nextCursor =
        ordered.length === input.limit ? ordered[ordered.length - 1]!.rowIndex + 1 : null;

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
      const ownerId = ctx.session.user.id;
      await requireBaseOwned(ctx.db, input.baseId, ownerId);

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
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

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
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

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
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

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
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

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
      const ownerId = ctx.session.user.id;
      await requireTableOwned(ctx.db, input.baseId, input.tableId, ownerId);

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
