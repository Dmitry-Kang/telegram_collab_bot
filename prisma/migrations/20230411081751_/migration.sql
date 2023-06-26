-- CreateTable
CREATE TABLE "_leading" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_leading_AB_unique" ON "_leading"("A", "B");

-- CreateIndex
CREATE INDEX "_leading_B_index" ON "_leading"("B");

-- AddForeignKey
ALTER TABLE "_leading" ADD CONSTRAINT "_leading_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_leading" ADD CONSTRAINT "_leading_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
