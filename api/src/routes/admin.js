const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendMagicLink } = require('../services/email');

const prisma = new PrismaClient();
const adminOnly = [requireAuth, requireRole('ADMIN')];

// GET /api/admin/dashboard
router.get('/dashboard', ...adminOnly, async (req, res) => {
  try {
    const [totalPhotos, pendingPhotos, approvedPhotos, campeurs] = await Promise.all([
      prisma.photo.count(),
      prisma.photo.count({ where: { statut: 'PENDING' } }),
      prisma.photo.count({ where: { statut: 'APPROVED' } }),
      prisma.campeur.groupBy({ by: ['statut'], _count: true }),
    ]);
    res.json({ totalPhotos, pendingPhotos, approvedPhotos, campeurs });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/semaines
router.get('/semaines', ...adminOnly, async (req, res) => {
  try {
    res.json(await prisma.semaine.findMany({ orderBy: { dateDebut: 'asc' } }));
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/semaines  { nom, dateDebut, dateFin }
router.post('/semaines', ...adminOnly, async (req, res) => {
  try {
    const { nom, dateDebut, dateFin } = req.body;
    const semaine = await prisma.semaine.create({
      data: { nom, dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) },
    });
    res.status(201).json(semaine);
  } catch (err) {
    console.error('create semaine error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/import-csv  (multipart, champ: file)
router.post('/import-csv', ...adminOnly, require('../middleware/upload').single('file'), async (req, res) => {
  try {
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    let created = 0;

    for (const row of rows) {
      const semaine = await prisma.semaine.findFirst({ where: { nom: row.semaine } });
      if (!semaine) continue;

      let campeur = await prisma.campeur.findFirst({
        where: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
      });
      if (!campeur) {
        campeur = await prisma.campeur.create({
          data: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
        });
      }

      const exists = await prisma.parent.findFirst({
        where: { email: row.email_parent, campeurId: campeur.id },
      });
      if (!exists) {
        const parent = await prisma.parent.create({
          data: {
            email: row.email_parent,
            prenom: row.prenom_parent,
            nom: row.nom_enfant,
            campeurId: campeur.id,
          },
        });
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const link = await prisma.magicLink.create({ data: { parentId: parent.id, expiresAt } });
        await sendMagicLink(parent.email, link.token).catch(() => {});
        created++;
      }
    }

    res.json({ created, total: rows.length });
  } catch (err) {
    console.error('import-csv error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/employes  { email, prenom, nom, role, password }
router.post('/employes', ...adminOnly, async (req, res) => {
  try {
    const { email, prenom, nom, role, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const employe = await prisma.employe.create({ data: { email, prenom, nom, role, passwordHash } });
    res.status(201).json({ id: employe.id, email: employe.email, role: employe.role });
  } catch (err) {
    console.error('create employe error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/parents — liste avec statut connexion
router.get('/parents', ...adminOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      include: { campeur: { include: { semaine: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(parents);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
