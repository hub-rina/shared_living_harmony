-- CreateEnum
CREATE TYPE "TaskCadence" AS ENUM ('once', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "cadence" "TaskCadence" NOT NULL DEFAULT 'once';
