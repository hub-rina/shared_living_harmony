-- CreateTable
CREATE TABLE "MessFlag" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "flaggerId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessFlag_householdId_createdAt_idx" ON "MessFlag"("householdId", "createdAt");
CREATE INDEX "MessFlag_flaggerId_idx" ON "MessFlag"("flaggerId");

-- AddForeignKey
ALTER TABLE "MessFlag" ADD CONSTRAINT "MessFlag_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessFlag" ADD CONSTRAINT "MessFlag_flaggerId_fkey" FOREIGN KEY ("flaggerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessFlag" ADD CONSTRAINT "MessFlag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
