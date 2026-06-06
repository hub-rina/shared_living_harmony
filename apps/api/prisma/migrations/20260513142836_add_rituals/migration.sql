-- CreateEnum
CREATE TYPE "RitualType" AS ENUM ('meal', 'event', 'checkin', 'challenge');

-- CreateEnum
CREATE TYPE "RitualStatus" AS ENUM ('proposed', 'completed');

-- CreateTable
CREATE TABLE "Ritual" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "RitualType" NOT NULL,
    "title" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "status" "RitualStatus" NOT NULL DEFAULT 'proposed',
    "proposerId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ritual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RitualParticipant" (
    "id" TEXT NOT NULL,
    "ritualId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RitualParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ritual_householdId_status_idx" ON "Ritual"("householdId", "status");

-- CreateIndex
CREATE INDEX "RitualParticipant_ritualId_idx" ON "RitualParticipant"("ritualId");

-- CreateIndex
CREATE UNIQUE INDEX "RitualParticipant_ritualId_userId_key" ON "RitualParticipant"("ritualId", "userId");

-- AddForeignKey
ALTER TABLE "Ritual" ADD CONSTRAINT "Ritual_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ritual" ADD CONSTRAINT "Ritual_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualParticipant" ADD CONSTRAINT "RitualParticipant_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualParticipant" ADD CONSTRAINT "RitualParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
