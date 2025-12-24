import { z } from "zod";
import { faker } from "@faker-js/faker";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ColumnType } from "../../../../generated/prisma";

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
});
