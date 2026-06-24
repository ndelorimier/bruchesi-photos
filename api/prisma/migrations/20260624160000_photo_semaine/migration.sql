-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "semaineId" INTEGER;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_semaineId_fkey" FOREIGN KEY ("semaineId") REFERENCES "Semaine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

