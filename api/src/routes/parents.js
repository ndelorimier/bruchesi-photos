const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');
const { streamZip } = require('../services/zip');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const parentOnly = [requireAuth, requireRole('parent')];

// GET /api/parents/me — profil et campeur(s) liés
router.get('/me', ...parentOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      where: { id: req.user.id },
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
    const parents = await prisma.parent.findMany({ where: { id: req.user.id } });
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
    const parents = await prisma.parent.findMany({ where: { id: req.user.id } });
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
    const notifs = await prisma.notification.findMany({
      where: { parentId: req.user.id },
      include: { photo: { select: { thumbnailPath: true } } },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/parents/reference-photo — upload photo de référence enfant
router.post('/reference-photo', ...parentOnly, upload.memory.single('file'), async (req, res) => {
  try {
    const parent = await prisma.parent.findUnique({ where: { id: req.user.id } });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });

    const profileDir = path.join(process.env.PHOTOS_PATH || '/data/photos', 'profiles');
    fs.mkdirSync(profileDir, { recursive: true });
    const filename = `${parent.campeurId}-parent_submit-${Date.now()}.jpg`;
    const filePath = path.join(profileDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    await prisma.faceProfile.create({
      data: { campeurId: parent.campeurId, type: 'PARENT_SUBMIT', fichierPath: filePath },
    });

    res.json({ ok: true, message: 'Photo soumise — en attente de validation par l\'admin.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
