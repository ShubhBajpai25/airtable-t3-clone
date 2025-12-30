import { env } from "~/env";
import { PrismaClient, Prisma, ColumnType, ViewType } from "../../generated/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export * from "../../generated/prisma";

// ✅ Re-export ONE Prisma namespace everywhere
export { Prisma, ColumnType, ViewType };

// ✅ Re-export the error class you need for instanceof checks
export { PrismaClientKnownRequestError };