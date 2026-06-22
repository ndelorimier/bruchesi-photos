const router = require('express').Router();
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { whereForUser } = require('../services/parentIdentity');
const { streamZip } = require('../services/zip');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const parentOnly = [requireAuth, requireRole('parent')];

// GET /api/parents/me — profil et campeur(s) liés
router.get('/me', ...parentOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      where: whereForUser(req.user),
      include: { campeur: { include: { semaine: true, faceProfiles: true } } },
    });
    res.json(parents);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/parents/photos — photos approuvées de la semaine de l'enfant
router.get('/photos', ...parentOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({ where: whereForUser(req.user) });
    const campeurIds = parents.map(p => p.campeurId);

    const photos = await prisma.photo.findMany({
      where: {
        statut: 'APPROVED',
        tags: { some: { campeurId: { in: campeurIds } } },
      },
      include: { tags: { where: { campeurId: { in: campeurIds } }, include: { campeur: true } } },
      orderBy: { approuveAt: 'desc' },
    });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/parents/photos/download — ZIP de toutes les photos
router.get('/photos/download', ...parentOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({ where: whereForUser(req.user) });
    const campeurIds = parents.map(p => p.campeurId);

    const photos = await prisma.photo.findMany({
      where: { statut: 'APPROVED', tags: { some: { campeurId: { in: campeurIds } } } },
    });
    streamZip(res, photos.map(p => p.fichierPath), 'bruchesi-photos.zip');
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/parents/notifications — historique
router.get('/notifications', ...parentOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({ where: whereForUser(req.user) });
    const parentIds = parents.map(p => p.id);
    const notifs = await prisma.notification.findMany({
      where: { parentId: { in: parentIds } },
      include: { photo: { select: { thumbnailPath: true } } },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/parents/reference-photo — upload photo de référence d'un enfant
// body.campeurId optionnel : si le parent a plusieurs enfants, il faut le préciser
router.post('/reference-photo', ...parentOnly, upload.memory.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    const parents = await prisma.parent.findMany({ where: whereForUser(req.user) });
    if (!parents.length) return res.status(404).json({ error: 'Parent introuvable' });

    // Choisir l'enfant cible : campeurId fourni (et possédé) sinon l'unique enfant
    const campeurIds = parents.map(p => p.campeurId);
    let campeurId;
    if (req.body.campeurId) {
      campeurId = Number(req.body.campeurId);
      if (!campeurIds.includes(campeurId)) return res.status(403).json({ error: 'Cet enfant ne vous est pas rattaché.' });
    } else if (campeurIds.length === 1) {
      campeurId = campeurIds[0];
    } else {
      return res.status(400).json({ error: 'Plusieurs enfants : précisez lequel (campeurId).' });
    }

    const profileDir = path.join(process.env.PHOTOS_PATH || '/data/photos', 'profiles');
    fs.mkdirSync(profileDir, { recursive: true });
    const filename = `${campeurId}-parent_submit-${Date.now()}.jpg`;
    const filePath = path.join(profileDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    await prisma.faceProfile.create({
      data: { campeurId, type: 'PARENT_SUBMIT', fichierPath: filePath },
    });

    res.json({ ok: true, message: 'Photo soumise — en attente de validation par l\'admin.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
