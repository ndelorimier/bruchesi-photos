const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
router.post('/subscribe', requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Données de subscription invalides' });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { parentId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { parentId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/push/subscribe
router.delete('/subscribe', requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

module.exports = router;
