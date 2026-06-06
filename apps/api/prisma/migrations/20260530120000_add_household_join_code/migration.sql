-- Add the join code. Existing rows get a backfilled value before the NOT NULL
-- + unique index. Backfill uses md5(random()) so every row is distinct; new
-- codes created by the app use the friendly wordlist generator.
ALTER TABLE "Household" ADD COLUMN "joinCode" TEXT;

UPDATE "Household"
SET "joinCode" = upper(substr(md5(random()::text || id::text), 1, 7))
WHERE "joinCode" IS NULL;

ALTER TABLE "Household" ALTER COLUMN "joinCode" SET NOT NULL;

CREATE UNIQUE INDEX "Household_joinCode_key" ON "Household"("joinCode");
