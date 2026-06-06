-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('user', 'support');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "HouseholdMember" ADD COLUMN     "inactiveFrom" TIMESTAMP(3),
ADD COLUMN     "inactiveReason" TEXT,
ADD COLUMN     "inactiveUntil" TIMESTAMP(3),
ADD COLUMN     "role" "HouseholdRole" NOT NULL DEFAULT 'member',
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "systemRole" "SystemRole" NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "MembershipStatusLog" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fromStatus" "MembershipStatus" NOT NULL,
    "toStatus" "MembershipStatus" NOT NULL,
    "from" TIMESTAMP(3),
    "until" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipStatusLog_membershipId_createdAt_idx" ON "MembershipStatusLog"("membershipId", "createdAt");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_status_idx" ON "HouseholdMember"("householdId", "status");

-- AddForeignKey
ALTER TABLE "MembershipStatusLog" ADD CONSTRAINT "MembershipStatusLog_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipStatusLog" ADD CONSTRAINT "MembershipStatusLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: promote household members whose user holds the legacy global admin
-- role to household admins. Inactive admins, members, and landlords keep the
-- 'member' default already applied by the column add.
UPDATE "HouseholdMember" hm
SET "role" = 'admin'
FROM "User" u
WHERE hm."userId" = u."id" AND u."role" = 'admin';

-- Backfill: promote the canonical dev/support account to systemRole=support.
UPDATE "User" SET "systemRole" = 'support' WHERE email = 'admin@homebuddy.dev';
