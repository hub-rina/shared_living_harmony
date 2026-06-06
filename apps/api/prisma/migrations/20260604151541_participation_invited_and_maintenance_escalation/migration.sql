-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'invited';

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false;

