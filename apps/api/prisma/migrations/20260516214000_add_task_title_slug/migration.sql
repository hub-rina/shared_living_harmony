-- AlterTable: add a derived slug column to enable token-normalized matching
-- for the heavy-chore rotation exclusion ("dishes" == "do dishes" == "wash up dishes").
ALTER TABLE "Task" ADD COLUMN "titleSlug" TEXT NOT NULL DEFAULT '';

-- Coarse backfill for existing rows (lowercase, trim, collapse whitespace).
-- The full token-sort + stopword pass happens in application code on every
-- write, so new rows have a precise slug; existing rows degrade gracefully.
UPDATE "Task" SET "titleSlug" = LOWER(REGEXP_REPLACE(TRIM("title"), '\s+', ' ', 'g'));

-- CreateIndex
CREATE INDEX "Task_householdId_titleSlug_completedAt_idx" ON "Task"("householdId", "titleSlug", "completedAt");
