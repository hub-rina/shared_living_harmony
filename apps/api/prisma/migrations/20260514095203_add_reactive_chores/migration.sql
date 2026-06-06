-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('routine', 'reactive');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "flaggedById" TEXT,
ADD COLUMN     "kind" "TaskKind" NOT NULL DEFAULT 'routine';

-- CreateIndex
CREATE INDEX "Task_householdId_kind_status_idx" ON "Task"("householdId", "kind", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
