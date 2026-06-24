const prisma = require('../db');
const compreface = require('./compreface');

const CONFIDENCE_THRESHOLD = 0.70;
const TICK_MS = 3000;
let running = false;
let indisponibleSignale = false; // pour ne logger l'indisponibilité qu'une fois

async function processPhoto(photo, prisma) {
  // Candidats : campeurs enrôlés. Si la photo est rattachée à une semaine,
  // on se limite aux campeurs de CETTE semaine (évite les faux positifs inter-semaines).
  const where = { compreFaceSubjectId: { not: null } };
  if (photo.semaineId) where.semaineId = photo.semaineId;
  const campeurs = await prisma.campeur.findMany({ where });

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

  // Marquer la photo comme traitée par l'IA : elle sort de la file même si
  // aucun visage n'a été reconnu (sinon reprise en boucle infinie). Le statut
  // reste PENDING — un approbateur valide toujours manuellement.
  await prisma.photo.update({
    where: { id: photo.id },
    data: { iaTraitee: true },
  });
}

function startWorker() {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      // Ne rien faire tant que CompreFace n'est pas joignable/configuré —
      // évite de boucler sur des erreurs toutes les 3 s.
      const etat = await compreface.ping();
      if (etat !== 'ok') {
        if (!indisponibleSignale) {
          console.warn(`[faceQueue] CompreFace ${etat} — traitement en pause jusqu'à configuration.`);
          indisponibleSignale = true;
        }
        return;
      }
      if (indisponibleSignale) {
        console.log('[faceQueue] CompreFace de nouveau disponible — reprise du traitement.');
        indisponibleSignale = false;
      }

      const photo = await prisma.photo.findFirst({
        where: { statut: 'PENDING', iaTraitee: false },
        orderBy: { uploadedAt: 'asc' },
      });
      if (photo) await processPhoto(photo, prisma);
    } catch (err) {
      console.error('[faceQueue] Erreur:', err.message);
    } finally {
      running = false;
    }
  }, TICK_MS);
}

module.exports = { startWorker, processPhoto };
