-- Drop legacy User.role column and Role enum
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
