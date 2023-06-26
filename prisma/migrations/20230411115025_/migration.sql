/*
  Warnings:

  - You are about to drop the column `text` on the `Project` table. All the data in the column will be lost.
  - Added the required column `name` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "text",
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "tssRequestedAt" DROP NOT NULL,
ALTER COLUMN "tssRequestedAt" DROP DEFAULT,
ALTER COLUMN "tssScore" DROP NOT NULL;
