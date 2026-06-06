-- CreateEnum
CREATE TYPE "RitualCadence" AS ENUM ('once', 'daily', 'weekly');

-- AlterTable
ALTER TABLE "Ritual" ADD COLUMN "cadence" "RitualCadence" NOT NULL DEFAULT 'once';
