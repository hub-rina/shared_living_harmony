-- CreateEnum
CREATE TYPE "LandlordMode" AS ENUM ('observer', 'caretaker');

-- AlterTable
ALTER TABLE "LandlordProperty" ADD COLUMN     "consentGranted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" "LandlordMode" NOT NULL DEFAULT 'observer';
