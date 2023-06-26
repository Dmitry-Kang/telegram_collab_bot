/*
  Warnings:

  - You are about to drop the `_leading` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `leadId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_leading" DROP CONSTRAINT "_leading_A_fkey";

-- DropForeignKey
ALTER TABLE "_leading" DROP CONSTRAINT "_leading_B_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "leadId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_leading";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
