-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "lastBloomedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "rotationReason" TEXT;
