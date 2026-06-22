const router = require('express').Router();
const prisma = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessayez dans 5 minutes.' });

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

module.exports = router;
