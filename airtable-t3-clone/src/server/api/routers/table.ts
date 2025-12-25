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
      // Ensure the base belongs to the user
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

      const rowCount = await ctx.db.row.count({ where: { tableId: input.tableId } });

      return { ...table, rowCount }; // ✅ flattened
    }),

  
  rowsInfinite: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        cursor: z.number().int().optional(), // rowIndex to start from
        limit: z.number().int().min(10).max(500).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // ownership check (cheap + safe)
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
      // Ensure base belongs to user
      const base = await ctx.db.base.findFirst({
        where: { id: input.baseId, ownerId: ctx.session.user.id },
        select: { id: true },
      });
      if (!base) throw new Error("Base not found");

      // Create table + seed in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        const table = await tx.table.create({
          data: {
            name: input.name,
            baseId: input.baseId,
          },
          select: { id: true, name: true },
        });

        // Create default columns
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

        // Create rows
        const rowCount = input.seedRows ?? 50;
        const createdRows = await Promise.all(
          Array.from({ length: rowCount }).map((_, i) =>
            tx.row.create({
              data: {
                tableId: table.id,
                rowIndex: i,
              },
              select: { id: true, rowIndex: true },
            }),
          ),
        );

        // Create cells (sparse: only set the correct value field)
        // Use createMany for speed
        const cellData = [];
        for (const row of createdRows) {
          for (const col of createdCols) {
            if (col.type === ColumnType.TEXT) {
              const v =
                col.name === "Name"
                  ? faker.person.fullName()
                  : faker.lorem.sentence({ min: 3, max: 8 });
              cellData.push({
                rowId: row.id,
                columnId: col.id,
                textValue: v,
              });
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

        return {
          table,
          columns: createdCols,
          seededRows: rowCount,
        };
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

      const result = await ctx.db.$transaction(async (tx) => {
        const agg = await tx.row.aggregate({
          where: { tableId: input.tableId },
          _max: { rowIndex: true },
        });

        const start = (agg._max.rowIndex ?? -1) + 1;
        const total = input.count;

        // batch to avoid huge payloads/timeouts
        const BATCH = 5000;
        for (let offset = 0; offset < total; offset += BATCH) {
          const size = Math.min(BATCH, total - offset);
          const data = Array.from({ length: size }, (_, i) => ({
            tableId: input.tableId,
            rowIndex: start + offset + i,
          }));
          await tx.row.createMany({ data });
        }

        return { added: total, startRowIndex: start, endRowIndex: start + total - 1 };
      });

      return result;
    }),
});