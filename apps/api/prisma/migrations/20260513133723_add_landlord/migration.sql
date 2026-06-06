-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'landlord';

-- CreateTable
CREATE TABLE "LandlordProperty" (
    "id" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandlordProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandlordProperty_landlordId_idx" ON "LandlordProperty"("landlordId");

-- CreateIndex
CREATE UNIQUE INDEX "LandlordProperty_landlordId_householdId_key" ON "LandlordProperty"("landlordId", "householdId");

-- AddForeignKey
ALTER TABLE "LandlordProperty" ADD CONSTRAINT "LandlordProperty_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordProperty" ADD CONSTRAINT "LandlordProperty_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
