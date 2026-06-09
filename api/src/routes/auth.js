const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { sendMagicLink } = require('../services/email');

const prisma = new PrismaClient();

// POST /api/auth/magic-link  { email }
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const parents = await prisma.parent.findMany({ where: { email } });
    if (!parents.length) {
      // Réponse identique pour ne pas révéler si l'email existe
      return res.json({ message: 'Si cet email est enregistré, un lien vous a été envoyé.' });
    }

    // Un seul magic link par email — lie au premier parent trouvé (les autres partagent le JWT)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const link = await prisma.magicLink.create({
      data: { parentId: parents[0].id, expiresAt },
    });

    await sendMagicLink(email, link.token);
    res.json({ message: 'Si cet email est enregistré, un lien vous a été envoyé.' });
  } catch (err) {
    console.error('magic-link error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/verify?token=xxx
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const link = await prisma.magicLink.findUnique({ where: { token } });
    if (!link || link.usedAt || link.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Lien invalide ou expiré' });
    }

    await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    await prisma.parent.update({ where: { id: link.parentId }, data: { compteActif: true } });

    const jwt_token = jwt.sign(
      { id: link.parentId, type: 'parent' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token: jwt_token });
  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
