const router = require('express').Router();
const prisma = require('../db');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ownsAny } = require('../services/parentIdentity');
const { sendToParents } = require('../services/push');

const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];
const approuvateurOnly = [requireAuth, requireRole('APPROBATEUR', 'ADMIN')];

// POST /api/photos/upload — upload batch de photos
router.post('/upload', ...staffOnly, upload.array('photos', 50), async (req, res) => {
  try {
    const semaineId = req.body.semaineId ? Number(req.body.semaineId) : null;
    const created = [];
    for (const file of req.files) {
      const thumbDir = path.join(process.env.PHOTOS_PATH || '/data/photos', 'thumbs');
      fs.mkdirSync(thumbDir, { recursive: true });
      const thumbPath = path.join(thumbDir, file.filename);
      await sharp(file.path).resize(400, 400, { fit: 'cover' }).toFile(thumbPath);

      const photo = await prisma.photo.create({
        data: {
          fichierPath: file.path,
          thumbnailPath: thumbPath,
          uploadedById: req.user.id,
          semaineId,
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
      include: { tags: { include: { campeur: true } }, semaine: true },
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

    // Notifications push — étendre par COURRIEL pour couvrir tous les enfants d'un parent
    const taggedParents = updated.tags.flatMap(t => t.campeur.parents);
    if (taggedParents.length) {
      const emails = [...new Set(taggedParents.map(p => p.email))];
      const rows = await prisma.parent.findMany({ where: { email: { in: emails } } });
      const uniqueParentIds = [...new Set(rows.map(p => p.id))];
      const prenoms = [...new Set(updated.tags.map(t => t.campeur.prenom))];
      await sendToParents(uniqueParentIds, {
        title: 'Bruchési Photos',
        body: `📸 Nouvelle photo de ${prenoms.join(', ')} !`,
        photoId: id,
      });
      // Une notification par courriel (ligne représentative) pour éviter les doublons
      const repByEmail = {};
      for (const r of rows) if (!(r.email in repByEmail)) repByEmail[r.email] = r.id;
      await prisma.notification.createMany({
        data: Object.values(repByEmail).map(pId => ({ parentId: pId, photoId: id, type: 'new_photo' })),
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

// GET /api/photos/file/:id/thumb — sert la miniature
// Staff : toutes les miniatures (file d'approbation incluse). Parent : seulement
// les photos APPROVED taguées avec un de ses enfants (sinon fuite — IDOR).
router.get('/file/:id/thumb', requireAuth, async (req, res) => {
  try {
    if (req.user.type === 'parent') {
      const photo = await prisma.photo.findUnique({
        where: { id: Number(req.params.id) },
        include: { tags: { include: { campeur: { include: { parents: true } } } } },
      });
      if (!photo || !photo.thumbnailPath || photo.statut !== 'APPROVED') return res.status(404).end();
      const parents = photo.tags.flatMap(t => t.campeur.parents);
      if (!ownsAny(req.user, parents)) return res.status(403).end();
      return res.sendFile(photo.thumbnailPath);
    }
    // Staff (PHOTOGRAPHE / APPROBATEUR / ADMIN)
    const photo = await prisma.photo.findUnique({ where: { id: Number(req.params.id) } });
    if (!photo || !photo.thumbnailPath) return res.status(404).end();
    res.sendFile(photo.thumbnailPath);
  } catch (err) {
    res.status(500).end();
  }
});

// GET /api/photos/file/:id — sert l'originale (parents approuvés seulement)
router.get('/file/:id', requireAuth, async (req, res) => {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: Number(req.params.id) },
      include: { tags: { include: { campeur: { include: { parents: true } } } } },
    });
    if (!photo || photo.statut !== 'APPROVED') return res.status(404).end();
    if (req.user.type === 'parent') {
      const parents = photo.tags.flatMap(t => t.campeur.parents);
      if (!ownsAny(req.user, parents)) return res.status(403).end();
    }
    res.sendFile(photo.fichierPath);
  } catch (err) {
    res.status(500).end();
  }
});

module.exports = router;
