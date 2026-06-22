const router = require('express').Router();
const prisma = require('../db');
const jwt = require('jsonwebtoken');
const { sendMagicLink } = require('../services/email');
const rateLimit = require('../middleware/rateLimit');

const magicLinkLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de demandes de lien. Réessayez dans 15 minutes.' });

// Lien de connexion self-service : durée courte (le parent le demande et clique aussitôt).
// Les liens d'accueil (import CSV / renvoi admin) gardent une durée longue, voir admin.js.
const LOGIN_LINK_TTL_MS = 60 * 60 * 1000; // 1 heure

// POST /api/auth/magic-link  { email }
router.post('/magic-link', magicLinkLimiter, async (req, res) => {
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

    // Un seul magic link par email — lie au premier parent trouvé (le JWT émis à la
    // vérification porte le courriel et couvre donc tous les enfants).
    const expiresAt = new Date(Date.now() + LOGIN_LINK_TTL_MS);
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

    const link = await prisma.magicLink.findUnique({ where: { token }, include: { parent: true } });
    if (!link || link.usedAt || link.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Lien invalide ou expiré' });
    }

    const email = link.parent.email;
    await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    // Activer TOUTES les lignes Parent de ce courriel (un parent peut avoir plusieurs enfants)
    await prisma.parent.updateMany({ where: { email }, data: { compteActif: true } });

    // Le jeton porte le COURRIEL : le parent voit tous ses enfants, pas seulement le premier
    const jwt_token = jwt.sign(
      { email, type: 'parent' },
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
