const router = require('express').Router();
const prisma = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { sendPasswordReset } = require('../services/email');

const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessayez dans 5 minutes.' });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: 'Trop de demandes de réinitialisation. Réessayez dans 15 minutes.' });
const RESET_TTL_MS = 60 * 60 * 1000; // 1 heure

// POST /api/employes/login  { email, password }
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const employe = await prisma.employe.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!employe) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, employe.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      { id: employe.id, type: 'employe', role: employe.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, role: employe.role, prenom: employe.prenom });
  } catch (err) {
    console.error('employes/login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/employes/password  { currentPassword, newPassword }
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Nouveau mot de passe : 8 caractères minimum' });
    }
    const employe = await prisma.employe.findUnique({ where: { id: req.user.id } });
    if (!employe) return res.status(404).json({ error: 'Employé introuvable' });

    const valid = await bcrypt.compare(currentPassword, employe.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.employe.update({ where: { id: employe.id }, data: { passwordHash } });
    return res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    console.error('employes/password error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/employes/forgot-password  { email }
// Réponse identique que l'email existe ou non (anti-énumération).
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const reponseGenerique = { message: 'Si ce courriel correspond à un compte, un lien de réinitialisation a été envoyé.' };
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Courriel requis' });

    const employe = await prisma.employe.findUnique({ where: { email } });
    if (!employe) return res.json(reponseGenerique);

    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    const reset = await prisma.passwordReset.create({ data: { employeId: employe.id, expiresAt } });
    try {
      await sendPasswordReset(employe.email, reset.token);
    } catch (err) {
      console.error('forgot-password SMTP error:', err.message);
      // On ne révèle pas l'échec d'envoi côté client (anti-énumération) ; le lien existe en base.
    }
    return res.json(reponseGenerique);
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/employes/reset-password  { token, newPassword }
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Lien et nouveau mot de passe requis' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Nouveau mot de passe : 8 caractères minimum' });

    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien invalide ou expiré. Demandez-en un nouveau.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.employe.update({ where: { id: reset.employeId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      // Invalider les autres liens en attente pour ce compte
      prisma.passwordReset.updateMany({
        where: { employeId: reset.employeId, usedAt: null, id: { not: reset.id } },
        data: { usedAt: new Date() },
      }),
    ]);
    return res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
