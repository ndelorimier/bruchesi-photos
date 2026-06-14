// Limiteur de débit en mémoire par IP — fenêtre fixe.
// Suffisant pour une instance unique derrière nginx (trust proxy requis pour la vraie IP).
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Trop de tentatives. Réessayez plus tard.' } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs);
  cleanup.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

module.exports = rateLimit;
