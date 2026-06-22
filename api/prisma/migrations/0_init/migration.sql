-- CreateEnum
CREATE TYPE "StatutEnrolement" AS ENUM ('AUCUN', 'PARTIEL', 'CONFIRME');

-- CreateEnum
CREATE TYPE "RoleEmploye" AS ENUM ('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatutPhoto" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TypeProfile" AS ENUM ('PARENT_SUBMIT', 'SELFIE_STATION');

-- CreateTable
CREATE TABLE "Semaine" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Semaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campeur" (
    "id" SERIAL NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "semaineId" INTEGER NOT NULL,
    "compreFaceSubjectId" TEXT,
    "statut" "StatutEnrolement" NOT NULL DEFAULT 'AUCUN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "campeurId" INTEGER NOT NULL,
    "compteActif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employe" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleEmploye" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" SERIAL NOT NULL,
    "fichierPath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "uploadedById" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutPhoto" NOT NULL DEFAULT 'PENDING',
    "approuveParId" INTEGER,
    "approuveAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoTag" (
    "id" SERIAL NOT NULL,
    "photoId" INTEGER NOT NULL,
    "campeurId" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confirmeParHumain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhotoTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceProfile" (
    "id" SERIAL NOT NULL,
    "campeurId" INTEGER NOT NULL,
    "type" "TypeProfile" NOT NULL,
    "fichierPath" TEXT NOT NULL,
    "enregistreAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "parentId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'new_photo',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Semaine_dateDebut_dateFin_idx" ON "Semaine"("dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Parent_email_idx" ON "Parent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employe_email_key" ON "Employe"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoTag_photoId_campeurId_key" ON "PhotoTag"("photoId", "campeurId");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Campeur" ADD CONSTRAINT "Campeur_semaineId_fkey" FOREIGN KEY ("semaineId") REFERENCES "Semaine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_campeurId_fkey" FOREIGN KEY ("campeurId") REFERENCES "Campeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_approuveParId_fkey" FOREIGN KEY ("approuveParId") REFERENCES "Employe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_campeurId_fkey" FOREIGN KEY ("campeurId") REFERENCES "Campeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceProfile" ADD CONSTRAINT "FaceProfile_campeurId_fkey" FOREIGN KEY ("campeurId") REFERENCES "Campeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

