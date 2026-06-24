const multer = require('multer');
const path = require('path');
const fs = require('fs');

const pendingDir = path.join(process.env.PHOTOS_PATH || '/data/photos', 'pending');
fs.mkdirSync(pendingDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: pendingDir,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const memoryStorage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez JPG, PNG, WEBP ou HEIC.'), false);
  }
};

// Filtre fichiers de données (import campeurs) : CSV ou XLSX uniquement.
const dataFilter = (req, file, cb) => {
  const okMime = [
    'text/csv', 'application/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ].includes(file.mimetype);
  const okExt = /\.(csv|xlsx)$/i.test(file.originalname || '');
  if (okMime || okExt) cb(null, true);
  else cb(new Error('Format non supporté. Déposez un fichier CSV ou XLSX.'), false);
};

module.exports = multer({ storage: photoStorage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: imageFilter });
module.exports.memory = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });
module.exports.single = (field) => multer({ storage: memoryStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter }).single(field);
// Pour les imports de campeurs (CSV/XLSX) — pas de filtre image.
module.exports.dataFile = multer({ storage: memoryStorage, limits: { fileSize: 15 * 1024 * 1024 }, fileFilter: dataFilter });
