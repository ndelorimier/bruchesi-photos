const router = require('express').Router();
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];

// GET /api/semaines — liste des semaines (lecture, accessible à tout le staff)
router.get('/', ...staffOnly, async (req, res) => {
  try {
    const semaines = await prisma.semaine.findMany({
      orderBy: { dateDebut: 'asc' },
      select: { id: true, nom: true, dateDebut: true, dateFin: true },
    });
    res.json(semaines);
  } catch (err) {
    console.error('semaines (staff) GET error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
