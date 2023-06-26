-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('USER', 'MANAGER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRoles" NOT NULL DEFAULT 'USER',
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "username" DROP NOT NULL;
