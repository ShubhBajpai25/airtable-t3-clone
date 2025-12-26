import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ColumnType } from "~/server/db";

const DEFAULT_COLS = [
  { name: "Name", type: ColumnType.TEXT },
  { name: "Notes", type: ColumnType.TEXT },
  { name: "Amount", type: ColumnType.NUMBER },
] as const;

export const tableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
    }),

  getMeta: protectedProcedure
    .input(z.object({ baseId: z.string().min(1), tableId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          baseId: input.baseId,
          base: { ownerId: ctx.session.user.id },
        },
        select: {
          id: true,
          name: true,
          baseId: true,
          columns: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, type: true, order: true },
          },
        },
      });

      if (!table) throw new Error("Table not found");

      const rowCount = await ctx.db.row.count({
        where: { tableId: input.tableId },
      });

      return { ...table, rowCount };
    }),

  rowsInfinite: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        cursor: z.number().int().optional(),
        limit: z.number().int().min(10).max(500).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ok = await ctx.db.table.findFirst({
        where: {
          id: input.tableId,
          baseId: input.baseId,
          base: { ownerId: ctx.session.user.id },
        },
        select: { id: true },
      });
      if (!ok) throw new Error("Table not found");

      const start = input.cursor ?? 0;

      const rows = await ctx.db.row.findMany({
        where: { tableId: input.tableId, rowIndex: { gte: start } },
        orderBy: { rowIndex: "asc" },
        take: input.limit,
        select: {
          id: true,
          rowIndex: true,
          cells: {
            select: { columnId: true, textValue: true, numberValue: true },
          },
        },
      });

      const nextCursor =
        rows.length === input.limit ? rows[rows.length - 1]!.rowIndex + 1 : null;

      return { rows, nextCursor };
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
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: { name: input.name, baseId: input.baseId },
          select: { id: true, name: true },
        });

        const createdCols = await Promise.all(
          DEFAULT_COLS.map((c, idx) =>
            tx.column.create({
              data: {
                tableId: table.id,
                name: c.name,
                type: c.type,
                order: idx,
              },
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
                numberValue: faker.number.float({
                  min: 0,
                  max: 10000,
                  fractionDigits: 2,
                }),
              });
            }
          }
        }

        await tx.cell.createMany({ data: cellData });

        return { table, columns: createdCols, seededRows: rowCount };
      });

      return result;
    }),

  addRows: protectedProcedure
  .input(
    z.object({
      baseId: z.string().min(1),
      tableId: z.string().min(1),
      count: z.number().int().min(1).max(1_000_000).default(100_000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ownership check
    const ok = await ctx.db.table.findFirst({
      where: {
        id: input.tableId,
        baseId: input.baseId,
        base: { ownerId: ctx.session.user.id },
      },
      select: { id: true },
    });
    if (!ok) throw new Error("Table not found");

    const result = await ctx.db.$transaction(
      async (tx) => {
        // find the "Name" column (or fallback to order=0)
        const nameCol = await tx.column.findFirst({
          where: {
            tableId: input.tableId,
            OR: [{ name: "Name" }, { order: 0 }],
          },
          select: { id: true, type: true, name: true },
        });

        if (!nameCol) {
          throw new Error("No columns found to seed (expected a Name column)");
        }

        const agg = await tx.row.aggregate({
          where: { tableId: input.tableId },
          _max: { rowIndex: true },
        });

        const start = (agg._max.rowIndex ?? -1) + 1;
        const total = input.count;

        // batch settings
        const BATCH = 2000;

        // ✅ throttle seeding for huge inserts
        //  - <= 20k rows: seed every row
        //  - > 20k rows: seed every 10th row (so 100k => 10k cells)
        const seedEvery = total > 20_000 ? 10 : 1;

        for (let offset = 0; offset < total; offset += BATCH) {
          const size = Math.min(BATCH, total - offset);
          const batchStart = start + offset;
          const batchEnd = batchStart + size; // exclusive

          // 1) insert rows
          await tx.row.createMany({
            data: Array.from({ length: size }, (_, i) => ({
              tableId: input.tableId,
              rowIndex: batchStart + i,
            })),
          });

          // 2) fetch inserted row ids for this batch (so we can create cells)
          const insertedRows = await tx.row.findMany({
            where: {
              tableId: input.tableId,
              rowIndex: { gte: batchStart, lt: batchEnd },
            },
            select: { id: true, rowIndex: true },
            orderBy: { rowIndex: "asc" },
          });

          // 3) seed Name cells for some/all rows
          const cellData: Array<{
            rowId: string;
            columnId: string;
            textValue?: string;
            numberValue?: number;
          }> = [];

          for (const r of insertedRows) {
            // seed only every Nth row when total is large
            if ((r.rowIndex - start) % seedEvery !== 0) continue;

            if (nameCol.type === ColumnType.TEXT) {
              cellData.push({
                rowId: r.id,
                columnId: nameCol.id,
                textValue: faker.person.fullName(),
              });
            } else {
              // fallback if your first column ends up NUMBER
              cellData.push({
                rowId: r.id,
                columnId: nameCol.id,
                numberValue: faker.number.float({
                  min: 0,
                  max: 10000,
                  fractionDigits: 2,
                }),
              });
            }
          }

          if (cellData.length > 0) {
            await tx.cell.createMany({
              data: cellData,
              skipDuplicates: true,
            });
          }
        }

        return {
          added: total,
          seededColumn: nameCol.name,
          seedEvery,
          startRowIndex: start,
          endRowIndex: start + total - 1,
        };
      },
      {
        maxWait: 10_000,
        timeout: 300_000, // ✅ longer for big inserts
      },
    );

    return result;
  }),
