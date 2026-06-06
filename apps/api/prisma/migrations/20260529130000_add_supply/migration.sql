-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isLow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supply_householdId_idx" ON "Supply"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Supply_householdId_name_key" ON "Supply"("householdId", "name");

-- AddForeignKey
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
