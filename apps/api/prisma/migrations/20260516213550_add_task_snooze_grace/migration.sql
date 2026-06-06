-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "penaltyApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snoozeUsed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing overdue tasks were already penalized at flip time,
-- so mark them so the new grace-aware sweep does not double-penalize.
UPDATE "Task" SET "penaltyApplied" = true WHERE "status" = 'overdue';
