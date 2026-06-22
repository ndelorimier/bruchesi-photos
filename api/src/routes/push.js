const router = require('express').Router();
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { whereForUser } = require('../services/parentIdentity');


// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
router.post('/subscribe', requireAuth, requireRole('parent'), async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Données de subscription invalides' });
    }
    // L'identité parent est par courriel : rattacher l'abonnement à une ligne
    // représentative. L'envoi (photos.js) étend ensuite par courriel à tous les enfants.
    const rows = await prisma.parent.findMany({ where: whereForUser(req.user) });
    if (!rows.length) return res.status(404).json({ error: 'Parent introuvable' });
    const parentId = rows[0].id;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { parentId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { parentId, p256dh: keys.p256dh, auth: keys.auth },
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
