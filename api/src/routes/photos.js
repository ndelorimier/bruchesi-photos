const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendToParents } = require('../services/push');

const prisma = new PrismaClient();
const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];
const approuvateurOnly = [requireAuth, requireRole('APPROBATEUR', 'ADMIN')];

// POST /api/photos/upload — upload batch de photos
router.post('/upload', ...staffOnly, upload.array('photos', 50), async (req, res) => {
  try {
    const created = [];
    for (const file of req.files) {
      const thumbDir = path.join(process.env.PHOTOS_PATH, 'thumbs');
      fs.mkdirSync(thumbDir, { recursive: true });
      const thumbPath = path.join(thumbDir, file.filename);
      await sharp(file.path).resize(400, 400, { fit: 'cover' }).toFile(thumbPath);

      const photo = await prisma.photo.create({
        data: {
          fichierPath: file.path,
          thumbnailPath: thumbPath,
          uploadedById: req.user.id,
          statut: 'PENDING',
        },
      });
      created.push(photo.id);
    }
    res.status(201).json({ uploaded: created.length, ids: created });
  } catch (err) {
    console.error('upload error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/photos/pending — file d'approbation avec tags IA
router.get('/pending', ...approuvateurOnly, async (req, res) => {
  try {
    const photos = await prisma.photo.findMany({
      where: { statut: 'PENDING' },
      include: { tags: { include: { campeur: true } } },
      orderBy: { uploadedAt: 'asc' },
    });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/photos/:id/approve — approuver avec tags finaux
router.post('/:id/approve', ...approuvateurOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { tags } = req.body; // [{ campeurId, confidence }] — optionnel, override IA

    const photo = await prisma.photo.findUnique({ where: { id }, include: { tags: true } });
    if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

    if (tags) {
      await prisma.photoTag.deleteMany({ where: { photoId: id } });
      if (tags.length) {
        await prisma.photoTag.createMany({
          data: tags.map(t => ({ photoId: id, campeurId: t.campeurId, confidence: t.confidence, confirmeParHumain: true })),
        });
      }
    }

    const updated = await prisma.photo.update({
      where: { id },
      data: { statut: 'APPROVED', approuveParId: req.user.id, approuveAt: new Date() },
      include: { tags: { include: { campeur: { include: { parents: true } } } } },
    });

    // Notifications push
    const parentIds = updated.tags.flatMap(t => t.campeur.parents.map(p => p.id));
    if (parentIds.length) {
      const uniqueParentIds = [...new Set(parentIds)];
      const prenoms = [...new Set(updated.tags.map(t => t.campeur.prenom))];
      await sendToParents(uniqueParentIds, {
        title: 'Bruchési Photos',
        body: `📸 Nouvelle photo de ${prenoms.join(', ')} !`,
        photoId: id,
      });
      await prisma.notification.createMany({
        data: uniqueParentIds.map(pId => ({ parentId: pId, photoId: id, type: 'new_photo' })),
        skipDuplicates: true,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('approve error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/photos/:id/reject
router.post('/:id/reject', ...approuvateurOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.photo.update({
      where: { id },
      data: { statut: 'REJECTED', approuveParId: req.user.id, approuveAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
