const fs = require('fs');
const prisma = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;

// Housekeeping TOUJOURS sûr (aucune donnée utile détruite)
async function purgerLiensExpires() {
  const res = await prisma.magicLink.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (res.count) console.log(`[rétention] ${res.count} lien(s) magique(s) expiré(s) supprimé(s).`);
}

async function purgerVieillesNotifications() {
  const cutoff = new Date(Date.now() - 90 * DAY_MS);
  const res = await prisma.notification.deleteMany({ where: { sentAt: { lt: cutoff } } });
  if (res.count) console.log(`[rétention] ${res.count} notification(s) de plus de 90 j supprimée(s).`);
}

// Purge des PHOTOS — désactivée tant que RETENTION_DAYS n'est pas défini (Loi 25 : à activer
// avec un délai décidé, ex. RETENTION_DAYS=90). Supprime les photos plus vieilles que ce délai.
async function purgerPhotos() {
  const days = Number(process.env.RETENTION_DAYS);
  if (!days || days <= 0) {
    console.log('[rétention] Purge des photos désactivée (RETENTION_DAYS non défini).');
    return;
  }
  const cutoff = new Date(Date.now() - days * DAY_MS);
  const photos = await prisma.photo.findMany({
    where: { uploadedAt: { lt: cutoff } },
    select: { id: true, fichierPath: true, thumbnailPath: true },
  });
  if (!photos.length) return;

  const ids = photos.map((p) => p.id);
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { photoId: { in: ids } } }),
    prisma.photoTag.deleteMany({ where: { photoId: { in: ids } } }),
    prisma.photo.deleteMany({ where: { id: { in: ids } } }),
  ]);

  let fichiers = 0;
  for (const p of photos) {
    for (const f of [p.fichierPath, p.thumbnailPath]) {
      if (f) { try { fs.unlinkSync(f); fichiers++; } catch { /* déjà absent */ } }
    }
  }
  console.log(`[rétention] ${photos.length} photo(s) de plus de ${days} j supprimée(s) (${fichiers} fichier(s) disque).`);
}

async function executerRetention() {
  try {
    await purgerLiensExpires();
    await purgerVieillesNotifications();
    await purgerPhotos();
  } catch (err) {
    console.error('[rétention] Erreur:', err.message);
  }
}

function startRetention() {
  setTimeout(executerRetention, 30_000);   // une fois peu après le démarrage
  setInterval(executerRetention, DAY_MS);  // puis chaque 24 h
}

module.exports = { startRetention, executerRetention };
