import { baseRouter } from "~/server/api/routers/base";
import { tableRouter } from "~/server/api/routers/table";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { viewRouter } from "~/server/api/routers/view";
import { workspaceRouter } from "~/server/api/routers/workspace";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: baseRouter,
  table: tableRouter,
  view: viewRouter,
  workspace: workspaceRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
export const PrismaClient = appRouter.createCaller;
