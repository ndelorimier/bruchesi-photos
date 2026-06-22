const express = require('express');
const helmet = require('helmet');
const prisma = require('./db');

const app = express();

// Derrière nginx — req.ip lit X-Forwarded-For (1 saut de proxy)
app.set('trust proxy', 1);

// En-têtes de sécurité (X-Frame-Options, HSTS une fois en HTTPS, etc.).
// L'API ne renvoie que du JSON/des fichiers : pas de CSP de page à gérer ici.
app.use(helmet());

// Limiter la taille des corps pour éviter un DoS mémoire (les uploads passent par multer)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employes', require('./routes/employes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/campeurs', require('./routes/campeurs'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Gestionnaire d'erreurs final — renvoie du JSON (et pas la page HTML 500 d'Express).
// Gère notamment les rejets multer (fichier trop gros / format non supporté).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || /Format non support/.test(err.message || '')) {
    return res.status(400).json({ error: err.message || 'Requête invalide.' });
  }
  console.error('Erreur non gérée:', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;

// Validation des variables d'environnement critiques au démarrage (jamais en test)
function validerEnv() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || secret === 'change-me-32-chars-minimum') {
    throw new Error('JWT_SECRET manquant, trop court (<32 caractères) ou laissé à la valeur d\'exemple.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant.');
  if (!process.env.APP_URL) throw new Error('APP_URL manquant (requis pour les liens de connexion).');

  const estPlaceholder = (v) => !v || /change|your-|set-after/i.test(v);
  if (estPlaceholder(process.env.SMTP_USER)) console.warn('[config] ⚠ SMTP non configuré — les courriels de connexion ne partiront pas.');
  if (!process.env.VAPID_PUBLIC_KEY) console.warn('[config] ⚠ VAPID non configuré — notifications push désactivées.');
  if (estPlaceholder(process.env.COMPREFACE_API_KEY)) console.warn('[config] ⚠ CompreFace non configuré — reconnaissance faciale inactive.');
}

async function start() {
  validerEnv();
  await prisma.$connect();
  require('./services/faceQueue').startWorker();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

if (process.env.NODE_ENV !== 'test') {
  start().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { app, prisma };
