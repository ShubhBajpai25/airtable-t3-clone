-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 1: Create a default workspace for each user who has bases
INSERT INTO "Workspace" ("id", "name", "ownerId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    COALESCE(u."name", u."email", 'User') || '''s Workspace',
    u."id",
    NOW(),
    NOW()
FROM "User" u
WHERE EXISTS (
    SELECT 1 FROM "Base" b WHERE b."ownerId" = u."id"
);

-- Step 2: Add the workspaceId column to Base table (nullable first)
ALTER TABLE "Base" ADD COLUMN "workspaceId" TEXT;

-- Step 3: Populate workspaceId for existing bases
UPDATE "Base" b
SET "workspaceId" = w."id"
FROM "Workspace" w
WHERE w."ownerId" = b."ownerId";

-- Step 4: Make workspaceId NOT NULL
ALTER TABLE "Base" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Step 5: Remove the old ownerId column and its index
DROP INDEX "Base_ownerId_idx";
ALTER TABLE "Base" DROP COLUMN "ownerId";

-- Step 6: Add the new foreign key and index
ALTER TABLE "Base" ADD CONSTRAINT "Base_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Base_workspaceId_idx" ON "Base"("workspaceId");