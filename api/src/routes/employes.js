const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// POST /api/employes/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const employe = await prisma.employe.findUnique({ where: { email } });
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

module.exports = router;
