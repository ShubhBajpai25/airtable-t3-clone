-- Enable trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN index over "all cell content" (text OR number-as-text)
CREATE INDEX IF NOT EXISTS "Cell_search_trgm_idx"
ON "Cell"
USING GIN ((COALESCE("textValue", ("numberValue")::text, '')) gin_trgm_ops);
