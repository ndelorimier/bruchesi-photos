const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const compreface = require('../services/compreface');

const prisma = new PrismaClient();
const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];

// GET /api/campeurs?semaine=:id&q=:nom
router.get('/', ...staffOnly, async (req, res) => {
  try {
    const where = {};
    if (req.query.semaine) where.semaineId = Number(req.query.semaine);
    if (req.query.q) {
      where.OR = [
        { prenom: { contains: req.query.q, mode: 'insensitive' } },
        { nom: { contains: req.query.q, mode: 'insensitive' } },
      ];
    }
    const campeurs = await prisma.campeur.findMany({
      where,
      include: { semaine: true, faceProfiles: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    res.json(campeurs);
  } catch (err) {
    console.error('campeurs GET error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/campeurs/:id/enroll-profile — photo de référence (parent ou selfie station)
// Champ: file (image), type: parent_submit | selfie_station
router.post('/:id/enroll-profile', ...staffOnly, upload.memory.single('file'), async (req, res) => {
  try {
    const campeurId = Number(req.params.id);
    const type = req.body.type || 'selfie_station';

    const campeur = await prisma.campeur.findUnique({ where: { id: campeurId } });
    if (!campeur) return res.status(404).json({ error: 'Campeur introuvable' });

    // Sauvegarder l'image
    const profileDir = path.join(process.env.PHOTOS_PATH || '/data/photos', 'profiles');
    fs.mkdirSync(profileDir, { recursive: true });
    const filename = `${campeurId}-${type}-${Date.now()}.jpg`;
    const filePath = path.join(profileDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    // Créer sujet CompreFace si inexistant
    let subjectId = campeur.compreFaceSubjectId;
    if (!subjectId) {
      const subjectName = `campeur-${campeurId}`;
      await compreface.creerSujet(subjectName);
      subjectId = subjectName;
      await prisma.campeur.update({ where: { id: campeurId }, data: { compreFaceSubjectId: subjectId } });
    }

    // Ajouter l'image au sujet
    await compreface.ajouterImage(subjectId, filePath);

    // Enregistrer le profil
    await prisma.faceProfile.create({ data: { campeurId, type, fichierPath: filePath } });

    // Mettre à jour le statut d'enrôlement
    const profiles = await prisma.faceProfile.count({ where: { campeurId } });
    const newStatut = profiles >= 2 ? 'CONFIRME' : 'PARTIEL';
    await prisma.campeur.update({ where: { id: campeurId }, data: { statut: newStatut } });

    res.json({ ok: true, statut: newStatut });
  } catch (err) {
    console.error('enroll-profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
