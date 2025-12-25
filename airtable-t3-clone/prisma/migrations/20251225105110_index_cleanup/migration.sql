-- DropIndex
DROP INDEX "Cell_columnId_numberValue_idx";

-- DropIndex
DROP INDEX "Cell_columnId_textValue_idx";

-- DropIndex
DROP INDEX "Cell_rowId_idx";

-- CreateIndex
CREATE INDEX "Table_baseId_updatedAt_idx" ON "Table"("baseId", "updatedAt");
