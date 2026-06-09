# Bruchési Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une PWA de photos de camp avec reconnaissance faciale locale, workflow d'approbation, et notifications push parents — entièrement hébergée sur NAS Synology DS1520+ via Docker Compose.

**Architecture:** Node.js/Express API + Vue.js 3 PWA servis par Nginx. PostgreSQL pour les données, CompreFace (Docker) pour la reconnaissance faciale locale. Les photos transitent par une file d'approbation avant d'être visibles aux parents.

**Tech Stack:** Node.js 20, Express 4, Prisma ORM, Vue.js 3 + Vite + vite-plugin-pwa, Tailwind CSS 3, PostgreSQL 15, CompreFace, Nginx, web-push, Nodemailer, Docker Compose

---

## Structure des fichiers

```
Photoscampeurs/
├── docker-compose.yml
├── .env.example
├── nginx/
│   ├── nginx.conf
│   └── ssl/                      # certbot mount
├── api/                          # Backend Node.js
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma         # Modèle de données complet
│   ├── src/
│   │   ├── server.js             # Entry point Express
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT + rôles (parent / employé / admin)
│   │   │   └── upload.js         # Multer config
│   │   ├── services/
│   │   │   ├── compreface.js     # Client HTTP CompreFace
│   │   │   ├── email.js          # Nodemailer + Brevo SMTP
│   │   │   ├── push.js           # web-push VAPID
│   │   │   ├── faceQueue.js      # Worker reconnaissance faciale
│   │   │   └── zip.js            # Génération ZIP téléchargement
│   │   └── routes/
│   │       ├── auth.js           # POST /auth/magic-link, /auth/verify
│   │       ├── employes.js       # POST /employes/login
│   │       ├── admin.js          # CSV import, semaines, dashboard
│   │       ├── campeurs.js       # CRUD campeurs + enrôlement CompreFace
│   │       ├── photos.js         # Upload, approval queue, tags
│   │       ├── parents.js        # Galerie, download ZIP, profil
│   │       └── push.js           # Subscribe / unsubscribe push
│   └── tests/
│       ├── auth.test.js
│       ├── photos.test.js
│       ├── faceQueue.test.js
│       └── admin.test.js
└── pwa/                          # Frontend Vue.js
    ├── package.json
    ├── vite.config.js
    ├── public/
    │   ├── manifest.json
    │   └── sw-custom.js          # Service worker push handler
    └── src/
        ├── main.js
        ├── router/index.js
        ├── stores/
        │   ├── auth.js           # Pinia — état auth parent/employé
        │   └── photos.js         # Pinia — galerie + notifications
        ├── views/
        │   ├── LoginView.vue     # Écran magic link (email input)
        │   ├── ParentGallery.vue # Galerie photos semaine enfant
        │   ├── ParentAlerts.vue  # Historique notifications
        │   ├── ParentProfile.vue # Photo référence + préfs push
        │   ├── ApprovalQueue.vue # File d'approbation (employé)
        │   ├── UploadView.vue    # Upload photos (employé)
        │   ├── SelfieStation.vue # Selfie station (employé)
        │   └── AdminView.vue     # Dashboard admin
        └── components/
            ├── PhotoCard.vue
            ├── TagBadge.vue
            ├── CameraCapture.vue
            └── CsvImport.vue
```

---

## Task 1 : Infrastructure Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `nginx/nginx.conf`

- [ ] **Étape 1 : Créer `.env.example`**

```bash
# API
NODE_ENV=production
JWT_SECRET=change-me-32-chars-minimum
DATABASE_URL=postgresql://bruchesi:bruchesi@postgres:5432/bruchesiPhotos

# CompreFace
COMPREFACE_URL=http://compreface:8000
COMPREFACE_API_KEY=change-me

# Email (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-login@email.com
SMTP_PASS=your-brevo-smtp-key
EMAIL_FROM=noreply@bruchesi.com

# Push notifications VAPID
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@bruchesi.com

# App
APP_URL=https://photos.bruchesi.com
PHOTOS_PATH=/data/photos
```

- [ ] **Étape 2 : Créer `docker-compose.yml`**

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - pwa_dist:/usr/share/nginx/html:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build: ./api
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - COMPREFACE_URL=${COMPREFACE_URL}
      - COMPREFACE_API_KEY=${COMPREFACE_API_KEY}
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - EMAIL_FROM=${EMAIL_FROM}
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_EMAIL=${VAPID_EMAIL}
      - APP_URL=${APP_URL}
      - PHOTOS_PATH=/data/photos
    volumes:
      - photos_data:/data/photos
    depends_on:
      postgres:
        condition: service_healthy
      compreface:
        condition: service_started
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: bruchesiPhotos
      POSTGRES_USER: bruchesi
      POSTGRES_PASSWORD: bruchesi
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bruchesi -d bruchesiPhotos"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  compreface:
    image: exadel/compreface:latest
    environment:
      POSTGRES_USER: compreface
      POSTGRES_PASSWORD: compreface
      POSTGRES_DB: facerecognition
    volumes:
      - cf_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pg_data:
  cf_data:
  photos_data:
  pwa_dist:
```

- [ ] **Étape 3 : Créer `nginx/nginx.conf`**

```nginx
events { worker_processes auto; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  client_max_body_size 50M;

  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Serve PWA
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;

    # API proxy
    location /api/ {
      proxy_pass http://app:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }

    # Photos statiques approuvées
    location /photos/ {
      alias /usr/share/nginx/html/photos/;
      expires 30d;
      add_header Cache-Control "public, immutable";
    }
  }
}
```

- [ ] **Étape 4 : Commit**

```bash
git add docker-compose.yml .env.example nginx/
git commit -m "feat: docker compose infrastructure + nginx config"
```

---

## Task 2 : Schéma Prisma + migration

**Files:**
- Create: `api/package.json`
- Create: `api/prisma/schema.prisma`
- Create: `api/src/server.js`

- [ ] **Étape 1 : Créer `api/package.json`**

```json
{
  "name": "bruchesi-photos-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "migrate": "prisma migrate deploy",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcrypt": "^5.1.1",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.13",
    "web-push": "^3.6.7",
    "archiver": "^7.0.1",
    "axios": "^1.7.2",
    "csv-parse": "^5.5.6",
    "sharp": "^0.33.4"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.3",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Étape 2 : Créer `api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Semaine {
  id         Int       @id @default(autoincrement())
  nom        String
  dateDebut  DateTime
  dateFin    DateTime
  campeurs   Campeur[]
  createdAt  DateTime  @default(now())
}

model Campeur {
  id                   Int           @id @default(autoincrement())
  prenom               String
  nom                  String
  semaine              Semaine       @relation(fields: [semaineId], references: [id])
  semaineId            Int
  compreFaceSubjectId  String?
  statut               StatutEnrolement @default(AUCUN)
  parents              Parent[]
  photoTags            PhotoTag[]
  faceProfiles         FaceProfile[]
  createdAt            DateTime      @default(now())
}

enum StatutEnrolement {
  AUCUN
  PARTIEL
  CONFIRME
}

model Parent {
  id                Int                @id @default(autoincrement())
  email             String
  prenom            String
  nom               String
  campeur           Campeur            @relation(fields: [campeurId], references: [id])
  campeurId         Int
  compteActif       Boolean            @default(false)
  magicLinks        MagicLink[]
  pushSubscriptions PushSubscription[]
  notifications     Notification[]
  createdAt         DateTime           @default(now())
}

model Employe {
  id            Int        @id @default(autoincrement())
  email         String     @unique
  prenom        String
  nom           String
  passwordHash  String
  role          RoleEmploye
  photosUploaded Photo[]   @relation("uploader")
  photosApproved Photo[]   @relation("approver")
  createdAt     DateTime   @default(now())
}

enum RoleEmploye {
  PHOTOGRAPHE
  APPROBATEUR
  ADMIN
}

model Photo {
  id            Int          @id @default(autoincrement())
  fichierPath   String
  thumbnailPath String?
  uploadedBy    Employe      @relation("uploader", fields: [uploadedById], references: [id])
  uploadedById  Int
  uploadedAt    DateTime     @default(now())
  statut        StatutPhoto  @default(PENDING)
  approuvePar   Employe?     @relation("approver", fields: [approuveParId], references: [id])
  approuveParId Int?
  approuveAt    DateTime?
  tags          PhotoTag[]
  notifications Notification[]
}

enum StatutPhoto {
  PENDING
  APPROVED
  REJECTED
}

model PhotoTag {
  id                 Int      @id @default(autoincrement())
  photo              Photo    @relation(fields: [photoId], references: [id])
  photoId            Int
  campeur            Campeur  @relation(fields: [campeurId], references: [id])
  campeurId          Int
  confidence         Float
  confirmeParHumain  Boolean  @default(false)

  @@unique([photoId, campeurId])
}

model FaceProfile {
  id          Int         @id @default(autoincrement())
  campeur     Campeur     @relation(fields: [campeurId], references: [id])
  campeurId   Int
  type        TypeProfile
  fichierPath String
  enregistreAt DateTime   @default(now())
}

enum TypeProfile {
  PARENT_SUBMIT
  SELFIE_STATION
}

model MagicLink {
  id        Int      @id @default(autoincrement())
  token     String   @unique @default(cuid())
  parent    Parent   @relation(fields: [parentId], references: [id])
  parentId  Int
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}

model PushSubscription {
  id        Int    @id @default(autoincrement())
  parent    Parent @relation(fields: [parentId], references: [id])
  parentId  Int
  endpoint  String @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
}

model Notification {
  id       Int      @id @default(autoincrement())
  parent   Parent   @relation(fields: [parentId], references: [id])
  parentId Int
  photo    Photo    @relation(fields: [photoId], references: [id])
  photoId  Int
  type     String   @default("new_photo")
  sentAt   DateTime @default(now())
}
```

- [ ] **Étape 3 : Créer `api/src/server.js`**

```js
const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employes', require('./routes/employes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/campeurs', require('./routes/campeurs'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;

async function start() {
  await prisma.$connect();
  require('./services/faceQueue').startWorker();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

start().catch(console.error);

module.exports = { app, prisma };
```

- [ ] **Étape 4 : Créer `api/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
```

- [ ] **Étape 5 : Commit**

```bash
git add api/
git commit -m "feat: prisma schema + express server scaffold"
```

---

## Task 3 : Middleware auth (JWT + rôles)

**Files:**
- Create: `api/src/middleware/auth.js`
- Create: `api/tests/auth.test.js`

- [ ] **Étape 1 : Écrire le test**

```js
// api/tests/auth.test.js
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';
const { requireAuth, requireRole } = require('../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

test('requireAuth rejects missing token', () => {
  const req = { headers: {} };
  const res = mockRes();
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('requireAuth accepts valid JWT and sets req.user', () => {
  const token = jwt.sign({ id: 1, type: 'parent' }, 'test-secret-32-chars-minimum-xxxx');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();
  const next = jest.fn();
  requireAuth(req, res, next);
  expect(next).toHaveBeenCalled();
  expect(req.user).toMatchObject({ id: 1, type: 'parent' });
});

test('requireRole blocks wrong role', () => {
  const req = { user: { type: 'parent' } };
  const res = mockRes();
  const next = jest.fn();
  requireRole('admin')(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
});

test('requireRole allows correct role', () => {
  const req = { user: { type: 'employe', role: 'ADMIN' } };
  const res = mockRes();
  const next = jest.fn();
  requireRole('ADMIN')(req, res, next);
  expect(next).toHaveBeenCalled();
});
```

- [ ] **Étape 2 : Lancer le test — vérifier qu'il échoue**

```bash
cd api && npx jest tests/auth.test.js --no-coverage
# Expected: FAIL — "Cannot find module '../src/middleware/auth'"
```

- [ ] **Étape 3 : Implémenter `api/src/middleware/auth.js`**

```js
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role || req.user?.type;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

- [ ] **Étape 4 : Lancer le test — vérifier qu'il passe**

```bash
npx jest tests/auth.test.js --no-coverage
# Expected: PASS (4 tests)
```

- [ ] **Étape 5 : Commit**

```bash
git add api/src/middleware/auth.js api/tests/auth.test.js
git commit -m "feat: JWT auth middleware with role guard"
```

---

## Task 4 : Auth parents — magic links

**Files:**
- Create: `api/src/routes/auth.js`
- Create: `api/src/services/email.js`

- [ ] **Étape 1 : Créer `api/src/services/email.js`**

```js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendMagicLink(email, token) {
  const url = `${process.env.APP_URL}/auth/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Votre lien de connexion — Bruchési Photos',
    html: `
      <p>Bonjour,</p>
      <p>Cliquez sur le lien ci-dessous pour accéder aux photos de votre enfant :</p>
      <p><a href="${url}">${url}</a></p>
      <p>Ce lien est valide 7 jours et à usage unique.</p>
    `,
  });
}

module.exports = { sendMagicLink };
```

- [ ] **Étape 2 : Créer `api/src/routes/auth.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { sendMagicLink } = require('../services/email');

const prisma = new PrismaClient();

// POST /api/auth/magic-link  { email }
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

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
});

// GET /api/auth/verify?token=xxx
router.get('/verify', async (req, res) => {
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
});

module.exports = router;
```

- [ ] **Étape 3 : Commit**

```bash
git add api/src/routes/auth.js api/src/services/email.js
git commit -m "feat: magic link auth for parents"
```

---

## Task 5 : Auth employés + route admin de base

**Files:**
- Create: `api/src/routes/employes.js`
- Create: `api/src/routes/admin.js`

- [ ] **Étape 1 : Créer `api/src/routes/employes.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// POST /api/employes/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
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
});

module.exports = router;
```

- [ ] **Étape 2 : Créer `api/src/routes/admin.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendMagicLink } = require('../services/email');

const prisma = new PrismaClient();
const adminOnly = [requireAuth, requireRole('ADMIN')];

// GET /api/admin/dashboard
router.get('/dashboard', ...adminOnly, async (req, res) => {
  const [totalPhotos, pendingPhotos, approvedPhotos, campeurs] = await Promise.all([
    prisma.photo.count(),
    prisma.photo.count({ where: { statut: 'PENDING' } }),
    prisma.photo.count({ where: { statut: 'APPROVED' } }),
    prisma.campeur.groupBy({ by: ['statut'], _count: true }),
  ]);
  res.json({ totalPhotos, pendingPhotos, approvedPhotos, campeurs });
});

// GET /api/admin/semaines
router.get('/semaines', ...adminOnly, async (req, res) => {
  res.json(await prisma.semaine.findMany({ orderBy: { dateDebut: 'asc' } }));
});

// POST /api/admin/semaines  { nom, dateDebut, dateFin }
router.post('/semaines', ...adminOnly, async (req, res) => {
  const { nom, dateDebut, dateFin } = req.body;
  const semaine = await prisma.semaine.create({
    data: { nom, dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) },
  });
  res.status(201).json(semaine);
});

// POST /api/admin/import-csv  (multipart, champ: file)
router.post('/import-csv', ...adminOnly, require('../middleware/upload').single('file'), async (req, res) => {
  const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  let created = 0;

  for (const row of rows) {
    const semaine = await prisma.semaine.findFirst({ where: { nom: row.semaine } });
    if (!semaine) continue;

    let campeur = await prisma.campeur.findFirst({
      where: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
    });
    if (!campeur) {
      campeur = await prisma.campeur.create({
        data: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
      });
    }

    const exists = await prisma.parent.findFirst({
      where: { email: row.email_parent, campeurId: campeur.id },
    });
    if (!exists) {
      const parent = await prisma.parent.create({
        data: {
          email: row.email_parent,
          prenom: row.prenom_parent,
          nom: row.nom_enfant,
          campeurId: campeur.id,
        },
      });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const link = await prisma.magicLink.create({ data: { parentId: parent.id, expiresAt } });
      await sendMagicLink(parent.email, link.token).catch(() => {});
      created++;
    }
  }

  res.json({ created, total: rows.length });
});

// POST /api/admin/employes  { email, prenom, nom, role, password }
router.post('/employes', ...adminOnly, async (req, res) => {
  const { email, prenom, nom, role, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const employe = await prisma.employe.create({ data: { email, prenom, nom, role, passwordHash } });
  res.status(201).json({ id: employe.id, email: employe.email, role: employe.role });
});

// GET /api/admin/parents — liste avec statut connexion
router.get('/parents', ...adminOnly, async (req, res) => {
  const parents = await prisma.parent.findMany({
    include: { campeur: { include: { semaine: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(parents);
});

module.exports = router;
```

- [ ] **Étape 3 : Créer `api/src/middleware/upload.js`**

```js
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

module.exports = multer({ storage: photoStorage, limits: { fileSize: 20 * 1024 * 1024 } });
module.exports.memory = multer({ storage: memoryStorage, limits: { fileSize: 5 * 1024 * 1024 } });
module.exports.single = (field) => multer({ storage: memoryStorage }).single(field);
```

- [ ] **Étape 4 : Commit**

```bash
git add api/src/routes/employes.js api/src/routes/admin.js api/src/middleware/upload.js
git commit -m "feat: employee auth + admin routes (dashboard, semaines, CSV import)"
```

---

## Task 6 : Service CompreFace + queue de reconnaissance

**Files:**
- Create: `api/src/services/compreface.js`
- Create: `api/src/services/faceQueue.js`
- Create: `api/tests/faceQueue.test.js`

- [ ] **Étape 1 : Créer `api/src/services/compreface.js`**

```js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const BASE = () => process.env.COMPREFACE_URL;
const KEY = () => process.env.COMPREFACE_API_KEY;

async function creerSujet(nom) {
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/subjects`,
    { subject: nom },
    { headers: { 'x-api-key': KEY() } }
  );
  return res.data.subject;
}

async function ajouterImage(subject, imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`,
    form,
    { headers: { ...form.getHeaders(), 'x-api-key': KEY() } }
  );
  return res.data;
}

async function reconnaitre(imagePath, { limit = 5, detProbThreshold = 0.8 } = {}) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/recognize?limit=${limit}&det_prob_threshold=${detProbThreshold}`,
    form,
    { headers: { ...form.getHeaders(), 'x-api-key': KEY() } }
  );
  // Retourne tableau de { box, subjects: [{ subject, similarity }] }
  return res.data.result || [];
}

module.exports = { creerSujet, ajouterImage, reconnaitre };
```

- [ ] **Étape 2 : Écrire le test de la queue**

```js
// api/tests/faceQueue.test.js
jest.mock('../src/services/compreface', () => ({
  reconnaitre: jest.fn(),
}));
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    photo: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    campeur: { findMany: jest.fn() },
    photoTag: { create: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const { processPhoto } = require('../src/services/faceQueue');
const compreface = require('../src/services/compreface');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

test('processPhoto crée un tag pour chaque visage reconnu avec similarity >= 0.7', async () => {
  prisma.campeur.findMany.mockResolvedValue([
    { id: 1, compreFaceSubjectId: 'theo-t', prenom: 'Théo' },
  ]);
  compreface.reconnaitre.mockResolvedValue([
    { subjects: [{ subject: 'theo-t', similarity: 0.92 }] },
  ]);
  prisma.photoTag.create.mockResolvedValue({});
  prisma.photo.update.mockResolvedValue({});

  await processPhoto({ id: 42, fichierPath: '/data/photos/pending/test.jpg', semaineId: 1 }, prisma);

  expect(prisma.photoTag.create).toHaveBeenCalledWith({
    data: { photoId: 42, campeurId: 1, confidence: 0.92, confirmeParHumain: false },
  });
});

test('processPhoto ignore les résultats avec similarity < 0.7', async () => {
  prisma.campeur.findMany.mockResolvedValue([
    { id: 2, compreFaceSubjectId: 'emma-b', prenom: 'Emma' },
  ]);
  compreface.reconnaitre.mockResolvedValue([
    { subjects: [{ subject: 'emma-b', similarity: 0.55 }] },
  ]);
  prisma.photoTag.create.mockResolvedValue({});
  prisma.photo.update.mockResolvedValue({});

  await processPhoto({ id: 43, fichierPath: '/data/photos/pending/test2.jpg', semaineId: 1 }, prisma);

  expect(prisma.photoTag.create).not.toHaveBeenCalled();
});
```

- [ ] **Étape 3 : Lancer le test — vérifier qu'il échoue**

```bash
npx jest tests/faceQueue.test.js --no-coverage
# Expected: FAIL — "Cannot find module '../src/services/faceQueue'"
```

- [ ] **Étape 4 : Créer `api/src/services/faceQueue.js`**

```js
const { PrismaClient } = require('@prisma/client');
const compreface = require('./compreface');

const CONFIDENCE_THRESHOLD = 0.70;
let running = false;

async function processPhoto(photo, prisma) {
  const campeurs = await prisma.campeur.findMany({
    where: { compreFaceSubjectId: { not: null } },
  });

  const results = await compreface.reconnaitre(photo.fichierPath);

  for (const face of results) {
    const best = face.subjects?.[0];
    if (!best || best.similarity < CONFIDENCE_THRESHOLD) continue;

    const campeur = campeurs.find(c => c.compreFaceSubjectId === best.subject);
    if (!campeur) continue;

    await prisma.photoTag.upsert({
      where: { photoId_campeurId: { photoId: photo.id, campeurId: campeur.id } },
      create: { photoId: photo.id, campeurId: campeur.id, confidence: best.similarity, confirmeParHumain: false },
      update: { confidence: best.similarity },
    });
  }

  await prisma.photo.update({
    where: { id: photo.id },
    data: { statut: 'PENDING' }, // reste pending — approbateur doit valider
  });
}

function startWorker() {
  const prisma = new PrismaClient();
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const photo = await prisma.photo.findFirst({ where: { statut: 'PENDING' }, orderBy: { uploadedAt: 'asc' } });
      if (photo) await processPhoto(photo, prisma);
    } catch (err) {
      console.error('[faceQueue] Erreur:', err.message);
    } finally {
      running = false;
    }
  }, 3000);
}

module.exports = { startWorker, processPhoto };
```

- [ ] **Étape 5 : Lancer le test — vérifier qu'il passe**

```bash
npx jest tests/faceQueue.test.js --no-coverage
# Expected: PASS (2 tests)
```

- [ ] **Étape 6 : Commit**

```bash
git add api/src/services/compreface.js api/src/services/faceQueue.js api/tests/faceQueue.test.js
git commit -m "feat: CompreFace client + async face recognition queue"
```

---

## Task 7 : Routes photos (upload, approbation, tags)

**Files:**
- Create: `api/src/routes/photos.js`
- Create: `api/tests/photos.test.js`

- [ ] **Étape 1 : Écrire les tests**

```js
// api/tests/photos.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';
process.env.PHOTOS_PATH = '/tmp/test-photos';

jest.mock('@prisma/client', () => {
  const m = {
    photo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    photoTag: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    notification: { createMany: jest.fn() },
    parent: { findMany: jest.fn() },
    pushSubscription: { findMany: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => m) };
});
jest.mock('../src/services/push', () => ({ sendToParents: jest.fn() }));

const { app } = require('../src/server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const approbateurToken = jwt.sign({ id: 99, type: 'employe', role: 'APPROBATEUR' }, 'test-secret-32-chars-minimum-xxxx');

test('GET /api/photos/pending retourne la file d\'approbation', async () => {
  prisma.photo.findMany.mockResolvedValue([
    { id: 1, fichierPath: '/photos/pending/a.jpg', statut: 'PENDING', tags: [] },
  ]);
  const res = await request(app)
    .get('/api/photos/pending')
    .set('Authorization', `Bearer ${approbateurToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});

test('POST /api/photos/:id/approve met à jour le statut', async () => {
  prisma.photo.findUnique.mockResolvedValue({ id: 1, statut: 'PENDING', tags: [] });
  prisma.photo.update.mockResolvedValue({ id: 1, statut: 'APPROVED' });
  prisma.photoTag.findMany.mockResolvedValue([]);
  prisma.notification.createMany.mockResolvedValue({});

  const res = await request(app)
    .post('/api/photos/1/approve')
    .set('Authorization', `Bearer ${approbateurToken}`);
  expect(res.status).toBe(200);
  expect(prisma.photo.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ statut: 'APPROVED' }) })
  );
});
```

- [ ] **Étape 2 : Lancer le test — vérifier qu'il échoue**

```bash
npx jest tests/photos.test.js --no-coverage
# Expected: FAIL
```

- [ ] **Étape 3 : Créer `api/src/services/push.js`**

```js
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendToParents(parentIds, payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { parentId: { in: parentIds } },
  });
  const unique = Object.values(
    Object.fromEntries(subs.map(s => [s.endpoint, s]))
  );
  await Promise.allSettled(
    unique.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
}

module.exports = { sendToParents };
```

- [ ] **Étape 4 : Créer `api/src/routes/photos.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendToParents } = require('../services/push');

const prisma = new PrismaClient();
const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];
const approuvateurOnly = [requireAuth, requireRole('APPROBATEUR', 'ADMIN')];

// POST /api/photos/upload — upload batch de photos
router.post('/upload', ...staffOnly, upload.array('photos', 50), async (req, res) => {
  const created = [];
  for (const file of req.files) {
    const thumbDir = path.join(process.env.PHOTOS_PATH, 'thumbs');
    fs.mkdirSync(thumbDir, { recursive: true });
    const thumbPath = path.join(thumbDir, file.filename);
    await sharp(file.path).resize(400, 400, { fit: 'cover' }).toFile(thumbPath);

    const photo = await prisma.photo.create({
      data: {
        fichierPath: file.path,
        thumbnailPath: thumbPath,
        uploadedById: req.user.id,
        statut: 'PENDING',
      },
    });
    created.push(photo.id);
  }
  res.status(201).json({ uploaded: created.length, ids: created });
});

// GET /api/photos/pending — file d'approbation avec tags IA
router.get('/pending', ...approuvateurOnly, async (req, res) => {
  const photos = await prisma.photo.findMany({
    where: { statut: 'PENDING' },
    include: { tags: { include: { campeur: true } } },
    orderBy: { uploadedAt: 'asc' },
  });
  res.json(photos);
});

// POST /api/photos/:id/approve — approuver avec tags finaux
router.post('/:id/approve', ...approuvateurOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { tags } = req.body; // [{ campeurId, confidence }] — optionnel, override IA

  const photo = await prisma.photo.findUnique({ where: { id }, include: { tags: true } });
  if (!photo) return res.status(404).json({ error: 'Photo introuvable' });

  if (tags) {
    await prisma.photoTag.deleteMany({ where: { photoId: id } });
    if (tags.length) {
      await prisma.photoTag.createMany({
        data: tags.map(t => ({ photoId: id, campeurId: t.campeurId, confidence: t.confidence, confirmeParHumain: true })),
      });
    }
  }

  const updated = await prisma.photo.update({
    where: { id },
    data: { statut: 'APPROVED', approuveParId: req.user.id, approuveAt: new Date() },
    include: { tags: { include: { campeur: { include: { parents: true } } } } },
  });

  // Notifications push
  const parentIds = updated.tags.flatMap(t => t.campeur.parents.map(p => p.id));
  if (parentIds.length) {
    const uniqueParentIds = [...new Set(parentIds)];
    const prenoms = [...new Set(updated.tags.map(t => t.campeur.prenom))];
    await sendToParents(uniqueParentIds, {
      title: 'Bruchési Photos',
      body: `📸 Nouvelle photo de ${prenoms.join(', ')} !`,
      photoId: id,
    });
    await prisma.notification.createMany({
      data: uniqueParentIds.map(pId => ({ parentId: pId, photoId: id, type: 'new_photo' })),
      skipDuplicates: true,
    });
  }

  res.json(updated);
});

// POST /api/photos/:id/reject
router.post('/:id/reject', ...approuvateurOnly, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.photo.update({
    where: { id },
    data: { statut: 'REJECTED', approuveParId: req.user.id, approuveAt: new Date() },
  });
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Étape 5 : Lancer les tests**

```bash
npx jest tests/photos.test.js --no-coverage
# Expected: PASS (2 tests)
```

- [ ] **Étape 6 : Commit**

```bash
git add api/src/routes/photos.js api/src/services/push.js api/tests/photos.test.js
git commit -m "feat: photo upload, approval queue, push notifications"
```

---

## Task 8 : Routes campeurs + enrôlement CompreFace

**Files:**
- Create: `api/src/routes/campeurs.js`

- [ ] **Étape 1 : Créer `api/src/routes/campeurs.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const compreface = require('../services/compreface');

const prisma = new PrismaClient();
const staffOnly = [requireAuth, requireRole('PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN')];

// GET /api/campeurs?semaine=:id&q=:nom
router.get('/', ...staffOnly, async (req, res) => {
  const where = {};
  if (req.query.semaine) where.semaineId = Number(req.query.semaine);
  if (req.query.q) {
    where.OR = [
      { prenom: { contains: req.query.q, mode: 'insensitive' } },
      { nom: { contains: req.query.q, mode: 'insensitive' } },
    ];
  }
  const campeurs = await prisma.campeur.findMany({
    where,
    include: { semaine: true, faceProfiles: true },
    orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
  });
  res.json(campeurs);
});

// POST /api/campeurs/:id/enroll-profile — photo de référence (parent ou selfie station)
// Champ: file (image), type: parent_submit | selfie_station
router.post('/:id/enroll-profile', ...staffOnly, upload.memory.single('file'), async (req, res) => {
  const campeurId = Number(req.params.id);
  const type = req.body.type || 'selfie_station';

  const campeur = await prisma.campeur.findUnique({ where: { id: campeurId } });
  if (!campeur) return res.status(404).json({ error: 'Campeur introuvable' });

  // Sauvegarder l'image
  const profileDir = path.join(process.env.PHOTOS_PATH, 'profiles');
  fs.mkdirSync(profileDir, { recursive: true });
  const filename = `${campeurId}-${type}-${Date.now()}.jpg`;
  const filePath = path.join(profileDir, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  // Créer sujet CompreFace si inexistant
  let subjectId = campeur.compreFaceSubjectId;
  if (!subjectId) {
    const subjectName = `campeur-${campeurId}`;
    await compreface.creerSujet(subjectName);
    subjectId = subjectName;
    await prisma.campeur.update({ where: { id: campeurId }, data: { compreFaceSubjectId: subjectId } });
  }

  // Ajouter l'image au sujet
  await compreface.ajouterImage(subjectId, filePath);

  // Enregistrer le profil
  await prisma.faceProfile.create({ data: { campeurId, type, fichierPath: filePath } });

  // Mettre à jour le statut d'enrôlement
  const profiles = await prisma.faceProfile.count({ where: { campeurId } });
  const newStatut = profiles >= 2 ? 'CONFIRME' : 'PARTIEL';
  await prisma.campeur.update({ where: { id: campeurId }, data: { statut: newStatut } });

  res.json({ ok: true, statut: newStatut });
});

module.exports = router;
```

- [ ] **Étape 2 : Commit**

```bash
git add api/src/routes/campeurs.js
git commit -m "feat: campeur routes + CompreFace enrollment"
```

---

## Task 9 : Route parents (galerie + ZIP)

**Files:**
- Create: `api/src/routes/parents.js`
- Create: `api/src/services/zip.js`
- Create: `api/src/routes/push.js`

- [ ] **Étape 1 : Créer `api/src/services/zip.js`**

```js
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

function streamZip(res, files, zipName) {
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Type', 'application/zip');
  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(res);
  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: path.basename(filePath) });
    }
  }
  archive.finalize();
}

module.exports = { streamZip };
```

- [ ] **Étape 2 : Créer `api/src/routes/parents.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');
const { streamZip } = require('../services/zip');
const upload = require('../middleware/upload');
const path = require('path');
const compreface = require('../services/compreface');
const fs = require('fs');

const prisma = new PrismaClient();
const parentOnly = [requireAuth, requireRole('parent')];

// GET /api/parents/me — profil et campeur(s) liés
router.get('/me', ...parentOnly, async (req, res) => {
  const parents = await prisma.parent.findMany({
    where: { id: req.user.id },
    include: { campeur: { include: { semaine: true, faceProfiles: true } } },
  });
  res.json(parents);
});

// GET /api/parents/photos — photos approuvées de la semaine de l'enfant
router.get('/photos', ...parentOnly, async (req, res) => {
  // Trouver tous les campeurs de ce parent
  const parents = await prisma.parent.findMany({ where: { id: req.user.id } });
  const campeurIds = parents.map(p => p.campeurId);

  const photos = await prisma.photo.findMany({
    where: {
      statut: 'APPROVED',
      tags: { some: { campeurId: { in: campeurIds } } },
    },
    include: { tags: { where: { campeurId: { in: campeurIds } }, include: { campeur: true } } },
    orderBy: { approuveAt: 'desc' },
  });
  res.json(photos);
});

// GET /api/parents/photos/download — ZIP de toutes les photos
router.get('/photos/download', ...parentOnly, async (req, res) => {
  const parents = await prisma.parent.findMany({ where: { id: req.user.id } });
  const campeurIds = parents.map(p => p.campeurId);

  const photos = await prisma.photo.findMany({
    where: { statut: 'APPROVED', tags: { some: { campeurId: { in: campeurIds } } } },
  });
  streamZip(res, photos.map(p => p.fichierPath), 'bruchesi-photos.zip');
});

// GET /api/parents/notifications — historique
router.get('/notifications', ...parentOnly, async (req, res) => {
  const notifs = await prisma.notification.findMany({
    where: { parentId: req.user.id },
    include: { photo: { select: { thumbnailPath: true } } },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });
  res.json(notifs);
});

// POST /api/parents/reference-photo — upload photo de référence enfant
router.post('/reference-photo', ...parentOnly, upload.memory.single('file'), async (req, res) => {
  const parent = await prisma.parent.findUnique({ where: { id: req.user.id } });
  if (!parent) return res.status(404).json({ error: 'Parent introuvable' });

  const profileDir = path.join(process.env.PHOTOS_PATH, 'profiles');
  fs.mkdirSync(profileDir, { recursive: true });
  const filename = `${parent.campeurId}-parent_submit-${Date.now()}.jpg`;
  const filePath = path.join(profileDir, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  await prisma.faceProfile.create({
    data: { campeurId: parent.campeurId, type: 'PARENT_SUBMIT', fichierPath: filePath },
  });

  res.json({ ok: true, message: 'Photo soumise — en attente de validation par l\'admin.' });
});

module.exports = router;
```

- [ ] **Étape 3 : Créer `api/src/routes/push.js`**

```js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
router.post('/subscribe', requireAuth, requireRole('parent'), async (req, res) => {
  const { endpoint, keys } = req.body;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { parentId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { parentId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.json({ ok: true });
});

// DELETE /api/push/subscribe
router.delete('/subscribe', requireAuth, requireRole('parent'), async (req, res) => {
  const { endpoint } = req.body;
  await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
  res.json({ ok: true });
});

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

module.exports = router;
```

- [ ] **Étape 4 : Commit**

```bash
git add api/src/routes/parents.js api/src/services/zip.js api/src/routes/push.js
git commit -m "feat: parent gallery, ZIP download, push subscribe routes"
```

---

## Task 10 : Frontend PWA — scaffold Vue.js

**Files:**
- Create: `pwa/package.json`
- Create: `pwa/vite.config.js`
- Create: `pwa/src/main.js`
- Create: `pwa/src/router/index.js`
- Create: `pwa/public/manifest.json`

- [ ] **Étape 1 : Créer `pwa/package.json`**

```json
{
  "name": "bruchesi-photos-pwa",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "pinia": "^2.1.7",
    "vue": "^3.4.27",
    "vue-router": "^4.3.3"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.1",
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

- [ ] **Étape 2 : Créer `pwa/vite.config.js`**

```js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bruchési Photos',
        short_name: 'BruchésiPhotos',
        theme_color: '#16a34a',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/parents\/photos/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-photos', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
```

- [ ] **Étape 3 : Créer `pwa/src/main.js`**

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).mount('#app');
```

- [ ] **Étape 4 : Créer `pwa/src/router/index.js`**

```js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/auth/verify', component: () => import('../views/AuthVerify.vue'), meta: { public: true } },
  { path: '/', component: () => import('../views/ParentGallery.vue'), meta: { role: 'parent' } },
  { path: '/alertes', component: () => import('../views/ParentAlerts.vue'), meta: { role: 'parent' } },
  { path: '/profil', component: () => import('../views/ParentProfile.vue'), meta: { role: 'parent' } },
  { path: '/approbation', component: () => import('../views/ApprovalQueue.vue'), meta: { role: 'employe' } },
  { path: '/upload', component: () => import('../views/UploadView.vue'), meta: { role: 'employe' } },
  { path: '/selfie-station', component: () => import('../views/SelfieStation.vue'), meta: { role: 'employe' } },
  { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { role: 'admin' } },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.token) return '/login';
});

export default router;
```

- [ ] **Étape 5 : Créer `pwa/src/stores/auth.js`**

```js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'));
  const user = computed(() => {
    if (!token.value) return null;
    try { return JSON.parse(atob(token.value.split('.')[1])); } catch { return null; }
  });

  function setToken(t) {
    token.value = t;
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  }

  function logout() {
    token.value = null;
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  }

  if (token.value) axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;

  return { token, user, setToken, logout };
});
```

- [ ] **Étape 6 : Créer `pwa/src/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Étape 7 : Créer `pwa/src/style.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
```

- [ ] **Étape 8 : Créer `pwa/tailwind.config.js`**

```js
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Étape 9 : Créer `pwa/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bruchési Photos</title>
  <link rel="manifest" href="/manifest.json" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Étape 10 : Commit**

```bash
git add pwa/
git commit -m "feat: Vue.js PWA scaffold with router and auth store"
```

---

## Task 11 : Vues Vue.js — parent

**Files:**
- Create: `pwa/src/views/LoginView.vue`
- Create: `pwa/src/views/AuthVerify.vue`
- Create: `pwa/src/views/ParentGallery.vue`
- Create: `pwa/src/views/ParentAlerts.vue`
- Create: `pwa/src/views/ParentProfile.vue`
- Create: `pwa/src/components/PhotoCard.vue`

- [ ] **Étape 1 : Créer `pwa/src/views/LoginView.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
      <div class="text-center">
        <div class="text-4xl mb-2">📸</div>
        <h1 class="text-xl font-bold text-white">Bruchési Photos</h1>
        <p class="text-gray-400 text-sm mt-1">Entrez votre email pour recevoir un lien de connexion</p>
      </div>
      <form @submit.prevent="submit" class="space-y-4">
        <input
          v-model="email"
          type="email"
          placeholder="votre@email.com"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50"
        >
          {{ loading ? 'Envoi...' : 'Recevoir mon lien' }}
        </button>
      </form>
      <p v-if="sent" class="text-green-400 text-sm text-center">
        ✓ Si cet email est enregistré, vous recevrez un lien sous peu.
      </p>
      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const email = ref('');
const loading = ref(false);
const sent = ref(false);
const error = ref('');

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await axios.post('/api/auth/magic-link', { email: email.value });
    sent.value = true;
  } catch {
    error.value = 'Erreur réseau. Réessayez.';
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Étape 2 : Créer `pwa/src/views/AuthVerify.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center">
    <div class="text-center text-white space-y-4">
      <div v-if="loading" class="text-gray-400">Connexion en cours...</div>
      <div v-if="error" class="text-red-400">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loading = ref(true);
const error = ref('');

import { ref } from 'vue';

onMounted(async () => {
  const token = route.query.token;
  if (!token) { error.value = 'Lien invalide.'; loading.value = false; return; }
  try {
    const res = await axios.get(`/api/auth/verify?token=${token}`);
    auth.setToken(res.data.token);
    router.push('/');
  } catch {
    error.value = 'Lien expiré ou déjà utilisé. Demandez un nouveau lien.';
    loading.value = false;
  }
});
</script>
```

- [ ] **Étape 3 : Créer `pwa/src/components/PhotoCard.vue`**

```vue
<template>
  <div class="relative aspect-square cursor-pointer group" @click="$emit('click', photo)">
    <img
      :src="`/api/photos/file/${photo.id}/thumb`"
      :alt="`Photo approuvée`"
      class="w-full h-full object-cover rounded-lg"
      loading="lazy"
    />
    <div class="absolute bottom-1 left-1 flex gap-1 flex-wrap">
      <span
        v-for="tag in photo.tags"
        :key="tag.campeurId"
        class="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded"
      >
        {{ tag.campeur.prenom }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({ photo: Object });
defineEmits(['click']);
</script>
```

- [ ] **Étape 4 : Créer `pwa/src/views/ParentGallery.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <div class="bg-gray-900 px-4 py-4 flex items-center justify-between">
      <div>
        <h1 class="font-bold text-lg">📸 Bruchési Photos</h1>
        <p class="text-gray-400 text-sm">{{ semaineLabel }}</p>
      </div>
      <button @click="downloadZip" class="text-green-400 text-sm">⬇ ZIP</button>
    </div>

    <!-- Grille photos -->
    <div v-if="photos.length" class="p-2 grid grid-cols-3 gap-1">
      <PhotoCard v-for="p in photos" :key="p.id" :photo="p" />
    </div>
    <div v-else class="flex items-center justify-center h-64 text-gray-500">
      Aucune photo pour le moment
    </div>

    <!-- Bottom nav -->
    <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
      <router-link to="/" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">📸 Photos</router-link>
      <router-link to="/alertes" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">🔔 Alertes</router-link>
      <router-link to="/profil" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">👤 Profil</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import PhotoCard from '../components/PhotoCard.vue';

const photos = ref([]);
const me = ref([]);

const semaineLabel = computed(() => {
  const semaines = [...new Set(me.value.map(p => p.campeur?.semaine?.nom))].filter(Boolean);
  return semaines.join(', ') || '';
});

onMounted(async () => {
  const [photosRes, meRes] = await Promise.all([
    axios.get('/api/parents/photos'),
    axios.get('/api/parents/me'),
  ]);
  photos.value = photosRes.data;
  me.value = meRes.data;
});

async function downloadZip() {
  window.location.href = '/api/parents/photos/download';
}
</script>
```

- [ ] **Étape 5 : Créer `pwa/src/views/ParentAlerts.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white pb-16">
    <div class="bg-gray-900 px-4 py-4">
      <h1 class="font-bold text-lg">🔔 Alertes</h1>
    </div>
    <div class="p-3 space-y-2">
      <div v-for="n in notifs" :key="n.id" class="bg-gray-900 rounded-lg p-3 flex gap-3 items-center">
        <img v-if="n.photo?.thumbnailPath" :src="`/api/photos/file/${n.photoId}/thumb`" class="w-12 h-12 rounded object-cover" />
        <div>
          <p class="text-sm text-white">📸 Nouvelle photo</p>
          <p class="text-xs text-gray-400">{{ new Date(n.sentAt).toLocaleString('fr-CA') }}</p>
        </div>
      </div>
      <p v-if="!notifs.length" class="text-center text-gray-500 py-12">Aucune alerte</p>
    </div>
    <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
      <router-link to="/" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">📸 Photos</router-link>
      <router-link to="/alertes" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">🔔 Alertes</router-link>
      <router-link to="/profil" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">👤 Profil</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
const notifs = ref([]);
onMounted(async () => { notifs.value = (await axios.get('/api/parents/notifications')).data; });
</script>
```

- [ ] **Étape 6 : Créer `pwa/src/views/ParentProfile.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white pb-16">
    <div class="bg-gray-900 px-4 py-4">
      <h1 class="font-bold text-lg">👤 Mon profil</h1>
    </div>
    <div class="p-4 space-y-4">
      <div v-for="p in me" :key="p.id" class="bg-gray-900 rounded-xl p-4">
        <p class="font-semibold">{{ p.campeur.prenom }} {{ p.campeur.nom }}</p>
        <p class="text-sm text-gray-400">{{ p.campeur.semaine?.nom }}</p>
        <p class="text-xs mt-2" :class="p.campeur.statut === 'CONFIRME' ? 'text-green-400' : 'text-yellow-400'">
          Enrôlement : {{ p.campeur.statut }}
        </p>
      </div>

      <div class="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 class="font-semibold text-sm">Photo de référence de votre enfant</h2>
        <p class="text-xs text-gray-400">Une photo claire du visage de votre enfant améliore la précision de la reconnaissance.</p>
        <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer">
          <input type="file" accept="image/*" class="hidden" @change="uploadRef" />
          <span class="text-gray-400 text-sm">Sélectionner une photo</span>
        </label>
        <p v-if="refSuccess" class="text-green-400 text-sm">✓ Photo soumise — en attente de validation.</p>
      </div>

      <button @click="auth.logout(); $router.push('/login')" class="w-full bg-gray-800 rounded-xl py-3 text-sm text-gray-400">
        Se déconnecter
      </button>
    </div>
    <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
      <router-link to="/" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">📸 Photos</router-link>
      <router-link to="/alertes" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">🔔 Alertes</router-link>
      <router-link to="/profil" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">👤 Profil</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const me = ref([]);
const refSuccess = ref(false);
onMounted(async () => { me.value = (await axios.get('/api/parents/me')).data; });
async function uploadRef(e) {
  const form = new FormData();
  form.append('file', e.target.files[0]);
  await axios.post('/api/parents/reference-photo', form);
  refSuccess.value = true;
}
</script>
```

- [ ] **Étape 7 : Commit**

```bash
git add pwa/src/views/ pwa/src/components/PhotoCard.vue
git commit -m "feat: parent views — login, gallery, alerts, profile, auth verify"
```

---

## Task 12 : Vues Vue.js — employé (upload, approbation, selfie station)

**Files:**
- Create: `pwa/src/views/UploadView.vue`
- Create: `pwa/src/views/ApprovalQueue.vue`
- Create: `pwa/src/views/SelfieStation.vue`
- Create: `pwa/src/components/CameraCapture.vue`

- [ ] **Étape 1 : Créer `pwa/src/components/CameraCapture.vue`**

```vue
<template>
  <div class="space-y-3">
    <video ref="video" autoplay playsinline class="w-full rounded-lg bg-gray-800 aspect-video" />
    <button
      @click="capture"
      class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-3 font-semibold"
    >
      📸 Prendre la photo
    </button>
    <canvas ref="canvas" class="hidden" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits(['captured']);
const video = ref(null);
const canvas = ref(null);
let stream = null;

onMounted(async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  video.value.srcObject = stream;
});

onUnmounted(() => stream?.getTracks().forEach(t => t.stop()));

function capture() {
  canvas.value.width = video.value.videoWidth;
  canvas.value.height = video.value.videoHeight;
  canvas.value.getContext('2d').drawImage(video.value, 0, 0);
  canvas.value.toBlob(blob => emit('captured', blob), 'image/jpeg', 0.92);
}
</script>
```

- [ ] **Étape 2 : Créer `pwa/src/views/SelfieStation.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-4">
    <div class="bg-blue-900/50 rounded-xl p-4">
      <h1 class="font-bold text-lg">📸 Selfie Station</h1>
      <p class="text-gray-400 text-sm">Semaine en cours</p>
    </div>

    <input
      v-model="query"
      @input="search"
      type="text"
      placeholder="Chercher un campeur..."
      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
    />

    <div v-if="campeur" class="bg-gray-900 rounded-xl p-4 space-y-3">
      <div>
        <p class="font-bold text-lg">{{ campeur.prenom }} {{ campeur.nom }}</p>
        <p class="text-sm text-gray-400">{{ campeur.semaine?.nom }}</p>
        <div class="flex gap-2 mt-2">
          <span :class="hasParentPhoto ? 'text-green-400' : 'text-yellow-400'" class="text-xs">
            {{ hasParentPhoto ? '✓' : '○' }} Photo parent
          </span>
          <span :class="hasSelfie ? 'text-green-400' : 'text-yellow-400'" class="text-xs">
            {{ hasSelfie ? '✓' : '○' }} Selfie station
          </span>
        </div>
      </div>
      <CameraCapture @captured="enrollSelfie" />
      <p v-if="success" class="text-green-400 text-sm text-center">✓ Enrôlé avec succès !</p>
      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
    </div>

    <div v-if="results.length && !campeur" class="space-y-2">
      <div
        v-for="c in results"
        :key="c.id"
        @click="selectCampeur(c)"
        class="bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800"
      >
        <p class="font-medium">{{ c.prenom }} {{ c.nom }}</p>
        <p class="text-xs text-gray-400">{{ c.semaine?.nom }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';
import CameraCapture from '../components/CameraCapture.vue';

const query = ref('');
const results = ref([]);
const campeur = ref(null);
const success = ref(false);
const error = ref('');

const hasParentPhoto = computed(() => campeur.value?.faceProfiles?.some(p => p.type === 'PARENT_SUBMIT'));
const hasSelfie = computed(() => campeur.value?.faceProfiles?.some(p => p.type === 'SELFIE_STATION'));

async function search() {
  if (query.value.length < 2) { results.value = []; return; }
  const res = await axios.get(`/api/campeurs?q=${query.value}`);
  results.value = res.data;
}

function selectCampeur(c) { campeur.value = c; results.value = []; }

async function enrollSelfie(blob) {
  error.value = '';
  success.value = false;
  const form = new FormData();
  form.append('file', blob, 'selfie.jpg');
  form.append('type', 'selfie_station');
  try {
    await axios.post(`/api/campeurs/${campeur.value.id}/enroll-profile`, form);
    success.value = true;
    campeur.value.faceProfiles.push({ type: 'SELFIE_STATION' });
  } catch {
    error.value = 'Erreur lors de l\'enrôlement.';
  }
}
</script>
```

- [ ] **Étape 3 : Créer `pwa/src/views/ApprovalQueue.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="bg-orange-900/50 px-4 py-4">
      <h1 class="font-bold text-lg">File d'approbation</h1>
      <p class="text-gray-400 text-sm">{{ photos.length }} photo(s) en attente</p>
    </div>

    <div class="p-3 space-y-3 pb-20">
      <div v-for="photo in photos" :key="photo.id" class="bg-gray-900 rounded-xl overflow-hidden">
        <img :src="`/api/photos/file/${photo.id}/thumb`" class="w-full aspect-video object-cover" />
        <div class="p-3 space-y-2">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in photo.tags"
              :key="tag.campeurId"
              class="bg-gray-700 text-xs px-2 py-1 rounded-full"
            >
              {{ tag.campeur.prenom }} {{ (tag.confidence * 100).toFixed(0) }}%
            </span>
            <span v-if="!photo.tags.length" class="text-gray-500 text-xs">Aucun visage détecté</span>
          </div>
          <div class="flex gap-2">
            <button @click="approve(photo.id)" class="flex-1 bg-green-700 hover:bg-green-600 rounded-lg py-2 text-sm font-semibold">✓ Approuver</button>
            <button @click="reject(photo.id)" class="flex-1 bg-red-900 hover:bg-red-800 rounded-lg py-2 text-sm font-semibold">✗ Rejeter</button>
          </div>
        </div>
      </div>

      <button
        v-if="photos.length > 1"
        @click="approveAll"
        class="w-full bg-blue-700 hover:bg-blue-600 rounded-xl py-3 font-semibold"
      >
        ✓ Tout approuver ({{ photos.length }})
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const photos = ref([]);

onMounted(async () => {
  photos.value = (await axios.get('/api/photos/pending')).data;
});

async function approve(id) {
  await axios.post(`/api/photos/${id}/approve`);
  photos.value = photos.value.filter(p => p.id !== id);
}

async function reject(id) {
  await axios.post(`/api/photos/${id}/reject`);
  photos.value = photos.value.filter(p => p.id !== id);
}

async function approveAll() {
  await Promise.all(photos.value.map(p => axios.post(`/api/photos/${p.id}/approve`)));
  photos.value = [];
}
</script>
```

- [ ] **Étape 4 : Créer `pwa/src/views/UploadView.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-4">
    <h1 class="font-bold text-lg">📤 Upload photos</h1>

    <label class="block w-full border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 transition">
      <input type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
      <div class="text-gray-400 space-y-2">
        <div class="text-3xl">📁</div>
        <p>Glisser-déposer ou cliquer pour sélectionner</p>
        <p class="text-xs">JPG, PNG — max 20 MB par photo</p>
      </div>
    </label>

    <div v-if="queue.length" class="space-y-2">
      <div v-for="(item, i) in queue" :key="i" class="bg-gray-900 rounded-lg p-3 flex items-center gap-3">
        <div class="flex-1 truncate text-sm">{{ item.name }}</div>
        <div class="text-xs" :class="item.status === 'done' ? 'text-green-400' : item.status === 'error' ? 'text-red-400' : 'text-gray-400'">
          {{ item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : '...' }}
        </div>
      </div>
    </div>

    <button
      v-if="queue.length && !uploading"
      @click="upload"
      class="w-full bg-green-600 hover:bg-green-500 rounded-xl py-3 font-semibold"
    >
      Uploader {{ queue.length }} photo(s)
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const queue = ref([]);
const uploading = ref(false);

function onFiles(e) {
  queue.value = Array.from(e.target.files).map(f => ({ file: f, name: f.name, status: 'pending' }));
}

async function upload() {
  uploading.value = true;
  const form = new FormData();
  queue.value.forEach(item => form.append('photos', item.file));
  try {
    await axios.post('/api/photos/upload', form);
    queue.value.forEach(item => item.status = 'done');
  } catch {
    queue.value.forEach(item => item.status = 'error');
  } finally {
    uploading.value = false;
  }
}
</script>
```

- [ ] **Étape 5 : Commit**

```bash
git add pwa/src/views/UploadView.vue pwa/src/views/ApprovalQueue.vue pwa/src/views/SelfieStation.vue pwa/src/components/CameraCapture.vue
git commit -m "feat: employee views — upload, approval queue, selfie station"
```

---

## Task 13 : Vue admin + route fichier photo

**Files:**
- Create: `pwa/src/views/AdminView.vue`
- Modify: `api/src/routes/photos.js` — ajouter GET /api/photos/file/:id/thumb

- [ ] **Étape 1 : Ajouter la route fichier dans `api/src/routes/photos.js`**

Ajouter avant `module.exports` :

```js
// GET /api/photos/file/:id/thumb — sert la miniature
router.get('/file/:id/thumb', requireAuth, async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: Number(req.params.id) } });
  if (!photo) return res.status(404).end();
  res.sendFile(photo.thumbnailPath);
});

// GET /api/photos/file/:id — sert l'originale (parents approuvés seulement)
router.get('/file/:id', requireAuth, async (req, res) => {
  const photo = await prisma.photo.findUnique({
    where: { id: Number(req.params.id) },
    include: { tags: { include: { campeur: { include: { parents: true } } } } },
  });
  if (!photo || photo.statut !== 'APPROVED') return res.status(404).end();
  if (req.user.type === 'parent') {
    const allowed = photo.tags.some(t => t.campeur.parents.some(p => p.id === req.user.id));
    if (!allowed) return res.status(403).end();
  }
  res.sendFile(photo.fichierPath);
});
```

- [ ] **Étape 2 : Créer `pwa/src/views/AdminView.vue`**

```vue
<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-6">
    <h1 class="font-bold text-xl">⚙️ Administration</h1>

    <!-- Dashboard -->
    <div v-if="dashboard" class="grid grid-cols-2 gap-3">
      <div class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-green-400">{{ dashboard.approvedPhotos }}</div>
        <div class="text-xs text-gray-400 mt-1">Photos approuvées</div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-orange-400">{{ dashboard.pendingPhotos }}</div>
        <div class="text-xs text-gray-400 mt-1">En attente</div>
      </div>
      <div v-for="s in dashboard.campeurs" :key="s.statut" class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-blue-400">{{ s._count }}</div>
        <div class="text-xs text-gray-400 mt-1">Campeurs {{ s.statut.toLowerCase() }}</div>
      </div>
    </div>

    <!-- Import CSV -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold">Import CSV campeurs</h2>
      <p class="text-xs text-gray-400">Format: prenom_enfant, nom_enfant, semaine, prenom_parent, email_parent</p>
      <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer">
        <input type="file" accept=".csv" class="hidden" @change="importCsv" />
        <span class="text-gray-400 text-sm">Sélectionner un fichier CSV</span>
      </label>
      <p v-if="csvResult" class="text-green-400 text-sm">{{ csvResult }}</p>
    </div>

    <!-- Semaines -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold">Créer une semaine</h2>
      <input v-model="newSemaine.nom" placeholder="Nom (ex: Semaine 1)" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="newSemaine.dateDebut" type="date" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="newSemaine.dateFin" type="date" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <button @click="createSemaine" class="w-full bg-blue-700 hover:bg-blue-600 rounded-lg py-2 text-sm font-semibold">Créer la semaine</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const dashboard = ref(null);
const csvResult = ref('');
const newSemaine = ref({ nom: '', dateDebut: '', dateFin: '' });

onMounted(async () => {
  dashboard.value = (await axios.get('/api/admin/dashboard')).data;
});

async function importCsv(e) {
  const form = new FormData();
  form.append('file', e.target.files[0]);
  const res = await axios.post('/api/admin/import-csv', form);
  csvResult.value = `${res.data.created} parent(s) créés sur ${res.data.total} lignes.`;
}

async function createSemaine() {
  await axios.post('/api/admin/semaines', newSemaine.value);
  newSemaine.value = { nom: '', dateDebut: '', dateFin: '' };
  dashboard.value = (await axios.get('/api/admin/dashboard')).data;
}
</script>
```

- [ ] **Étape 3 : Commit**

```bash
git add pwa/src/views/AdminView.vue api/src/routes/photos.js
git commit -m "feat: admin view + photo file serving routes"
```

---

## Task 14 : Déploiement NAS — connexion SSH + premier lancement

**Files:**
- Create: `scripts/deploy.sh`
- Create: `scripts/generate-vapid.js`

- [ ] **Étape 1 : Générer les clés VAPID**

```bash
cd api && node -e "
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
"
```

Copier les deux valeurs dans `.env` sur le NAS.

- [ ] **Étape 2 : Créer `scripts/deploy.sh`**

```bash
#!/bin/bash
# Usage: ./scripts/deploy.sh user@nas-ip
# Déploie l'app sur le NAS via SSH

set -e
TARGET=$1
REMOTE_DIR="/volume1/docker/bruchesi-photos"

echo "==> Sync files vers $TARGET:$REMOTE_DIR"
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.env' \
  ./ "$TARGET:$REMOTE_DIR/"

echo "==> Build PWA sur le NAS"
ssh "$TARGET" "cd $REMOTE_DIR/pwa && npm ci && npm run build"

echo "==> Docker Compose up"
ssh "$TARGET" "cd $REMOTE_DIR && docker-compose pull && docker-compose up -d --build"

echo "==> Done! App disponible sur le NAS."
```

- [ ] **Étape 3 : Rendre le script exécutable et vérifier**

```bash
chmod +x scripts/deploy.sh
# Tester la connexion SSH d'abord:
ssh user@NAS_IP "docker --version"
# Expected: Docker version 24.x.x
```

- [ ] **Étape 4 : Préparer `.env` sur le NAS**

Via SSH, créer `/volume1/docker/bruchesi-photos/.env` à partir de `.env.example`, remplir :
- `JWT_SECRET` — chaîne aléatoire 32 chars : `openssl rand -base64 32`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — depuis étape 1
- `SMTP_USER` / `SMTP_PASS` — credentials Brevo
- `APP_URL` — ton domaine ou IP locale pour les tests

- [ ] **Étape 5 : Premier déploiement**

```bash
./scripts/deploy.sh admin@NAS_IP
```

Expected output :
```
==> Sync files...
==> Build PWA...
==> Docker Compose up...
==> Done!
```

- [ ] **Étape 6 : Vérifier les containers**

```bash
ssh admin@NAS_IP "cd /volume1/docker/bruchesi-photos && docker-compose ps"
# Expected: nginx, app, postgres, compreface — tous "Up"
```

- [ ] **Étape 7 : Créer le premier compte admin**

```bash
ssh admin@NAS_IP "cd /volume1/docker/bruchesi-photos && \
  docker-compose exec app node -e \"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
bcrypt.hash('MOT_DE_PASSE', 12).then(h =>
  prisma.employe.create({ data: { email: 'admin@bruchesi.com', prenom: 'Admin', nom: 'Bruchési', role: 'ADMIN', passwordHash: h } })
).then(e => { console.log('Admin créé:', e.id); process.exit(0); });
\""
```

- [ ] **Étape 8 : Commit final**

```bash
git add scripts/
git commit -m "feat: deployment scripts + VAPID key generation"
```

---

## Task 15 : SSL Let's Encrypt (optionnel si domaine configuré)

**Files:**
- Modify: `nginx/nginx.conf`
- Create: `scripts/init-ssl.sh`

- [ ] **Étape 1 : Créer `scripts/init-ssl.sh`**

```bash
#!/bin/bash
# Usage: ./scripts/init-ssl.sh user@nas-ip ton-domaine.com admin@email.com
TARGET=$1
DOMAIN=$2
EMAIL=$3
REMOTE_DIR="/volume1/docker/bruchesi-photos"

ssh "$TARGET" "docker run --rm \
  -v $REMOTE_DIR/nginx/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  --email $EMAIL --agree-tos --no-eff-email \
  -d $DOMAIN"

echo "Certificat généré dans nginx/ssl/live/$DOMAIN/"
echo "Mettre à jour nginx.conf avec les bons chemins de certificat."
```

- [ ] **Étape 2 : Pour les tests locaux sans domaine**

Générer un certificat auto-signé :

```bash
ssh admin@NAS_IP "mkdir -p /volume1/docker/bruchesi-photos/nginx/ssl && \
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /volume1/docker/bruchesi-photos/nginx/ssl/privkey.pem \
  -out /volume1/docker/bruchesi-photos/nginx/ssl/fullchain.pem \
  -subj '/CN=localhost'"
```

- [ ] **Étape 3 : Redémarrer nginx**

```bash
ssh admin@NAS_IP "cd /volume1/docker/bruchesi-photos && docker-compose restart nginx"
```

- [ ] **Étape 4 : Tester**

Ouvrir `https://NAS_IP` dans le navigateur. Accepter le certificat auto-signé pour les tests.

- [ ] **Étape 5 : Commit**

```bash
git add scripts/init-ssl.sh
git commit -m "feat: SSL init script (Let's Encrypt + auto-signé)"
```

---

## Ordre d'exécution recommandé

1. Task 1 — Infrastructure Docker Compose
2. Task 2 — Schéma Prisma + serveur Express
3. Task 3 — Middleware auth
4. Task 4 — Magic links parents
5. Task 5 — Auth employés + admin
6. Task 6 — CompreFace + queue
7. Task 7 — Routes photos
8. Task 8 — Routes campeurs + enrôlement
9. Task 9 — Routes parents + ZIP + push
10. Task 10 — Scaffold Vue PWA
11. Task 11 — Vues parent
12. Task 12 — Vues employé
13. Task 13 — Vue admin + serving fichiers
14. Task 14 — Déploiement NAS
15. Task 15 — SSL
