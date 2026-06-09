const { PrismaClient } = require('@prisma/client');
const compreface = require('./compreface');

const CONFIDENCE_THRESHOLD = 0.70;
let running = false;

async function processPhoto(photo, prisma) {
  const campeurs = await prisma.campeur.findMany({
    where: { compreFaceSubjectId: { not: null } },
  });

  const results = await compreface.reconnaitre(photo.fichierPath);

  for (const face of results) {
    const best = face.subjects?.[0];
    if (!best || best.similarity < CONFIDENCE_THRESHOLD) continue;

    const campeur = campeurs.find(c => c.compreFaceSubjectId === best.subject);
    if (!campeur) continue;

    await prisma.photoTag.upsert({
      where: { photoId_campeurId: { photoId: photo.id, campeurId: campeur.id } },
      create: { photoId: photo.id, campeurId: campeur.id, confidence: best.similarity, confirmeParHumain: false },
      update: { confidence: best.similarity },
    });
  }

  await prisma.photo.update({
    where: { id: photo.id },
    data: { statut: 'PENDING' }, // reste pending — approbateur doit valider
  });
}

function startWorker() {
  const prisma = new PrismaClient();
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const photo = await prisma.photo.findFirst({ where: { statut: 'PENDING' }, orderBy: { uploadedAt: 'asc' } });
      if (photo) await processPhoto(photo, prisma);
    } catch (err) {
      console.error('[faceQueue] Erreur:', err.message);
    } finally {
      running = false;
    }
  }, 3000);
}

module.exports = { startWorker, processPhoto };
