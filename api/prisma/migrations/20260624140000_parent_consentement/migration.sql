-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "consentementAt" TIMESTAMP(3),
ADD COLUMN     "consentementBiometrie" BOOLEAN NOT NULL DEFAULT false;

