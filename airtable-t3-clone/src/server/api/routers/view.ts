import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

// ---- ViewConfig schema (match what table.rowsInfinite expects) ----
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

export const viewConfigSchema = z
  .object({
    filters: z.array(viewFilterSchema).default([]),
    sort: viewSortSchema.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    hiddenColumnIds: z.array(z.string().min(1)).default([]),
  })
  .passthrough();

type AuthedCtx = {
  db: typeof db;
  session: { user: { id: string } };
};

function viewOwnedWhere(ctx: AuthedCtx, baseId: string, tableId: string, viewId: string) {
  return {
    id: viewId,
    tableId,
    table: { baseId, base: { ownerId: ctx.session.user.id } },
  } as const;
}

async function requireTableOwned(ctx: AuthedCtx, baseId: string, tableId: string) {
  const table = await ctx.db.table.findFirst({
    where: { id: tableId, baseId, base: { ownerId: ctx.session.user.id } },
    select: { id: true },
  });
  if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Table not found" });
  return table;
}

export const viewRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ baseId: z.string().min(1), tableId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      return ctx.db.view.findMany({
        where: {
          tableId: input.tableId,
          table: { baseId: input.baseId, base: { ownerId: ctx.session.user.id } },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, type: true, createdAt: true, updatedAt: true },
      });
    }),

  get: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        viewId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: viewOwnedWhere(ctx as AuthedCtx, input.baseId, input.tableId, input.viewId),
        select: { id: true, name: true, type: true, config: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      return { ...view, config: viewConfigSchema.parse(view.config ?? {}) };
    }),

  create: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      try {
        return await ctx.db.view.create({
          data: {
            tableId: input.tableId,
            name: input.name.trim(),
            config: { filters: [], hiddenColumnIds: [] },
          },
          select: { id: true, name: true, type: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "A view with that name already exists" });
        }
        throw e;
      }
    }),

  rename: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        viewId: z.string().min(1),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const where = viewOwnedWhere(ctx as AuthedCtx, input.baseId, input.tableId, input.viewId);

      try {
        return await ctx.db.view.update({
          where: { id: where.id },
          data: { name: input.name.trim() },
          select: { id: true, name: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "A view with that name already exists" });
        }
        throw e;
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        viewId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTableOwned(ctx as AuthedCtx, input.baseId, input.tableId);

      const count = await ctx.db.view.count({ where: { tableId: input.tableId } });
      if (count <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete the last view" });
      }

      const view = await ctx.db.view.findFirst({
        where: viewOwnedWhere(ctx as AuthedCtx, input.baseId, input.tableId, input.viewId),
        select: { id: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      await ctx.db.view.delete({ where: { id: view.id } });
      return { ok: true };
    }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        baseId: z.string().min(1),
        tableId: z.string().min(1),
        viewId: z.string().min(1),
        patch: viewConfigSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findFirst({
        where: viewOwnedWhere(ctx as AuthedCtx, input.baseId, input.tableId, input.viewId),
        select: { id: true, config: true },
      });
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });

      const current = viewConfigSchema.parse(view.config ?? {});
      const merged = viewConfigSchema.parse({ ...current, ...input.patch });

      const updated = await ctx.db.view.update({
        where: { id: view.id },
        data: { config: merged },
        select: { id: true, config: true },
      });

      return { id: updated.id, config: viewConfigSchema.parse(updated.config ?? {}) };
    }),
});
