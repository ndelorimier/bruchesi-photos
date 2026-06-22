const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';
process.env.PHOTOS_PATH = '/tmp/test-photos';

jest.mock('@prisma/client', () => {
  const m = {
    photo: { findUnique: jest.fn(), findMany: jest.fn() },
    parent: { findMany: jest.fn() },
    notification: { findMany: jest.fn() },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => m) };
});
jest.mock('../src/services/push', () => ({ sendToParents: jest.fn() }));
jest.mock('../src/services/faceQueue', () => ({ startWorker: jest.fn() }));

const { app } = require('../src/server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SECRET = 'test-secret-32-chars-minimum-xxxx';
const tokenFor = (email) => jwt.sign({ email, type: 'parent' }, SECRET);

beforeEach(() => jest.clearAllMocks());

// --- IDOR : un parent ne doit pas voir la miniature d'un enfant qui n'est pas le sien ---
test('GET /file/:id/thumb — 403 si la photo n\'est pas taguée à un enfant du parent', async () => {
  prisma.photo.findUnique.mockResolvedValue({
    id: 7, statut: 'APPROVED', thumbnailPath: '/tmp/test-photos/thumbs/7.jpg',
    tags: [{ campeur: { parents: [{ id: 50, email: 'autre@parent.com' }] } }],
  });
  const res = await request(app)
    .get('/api/photos/file/7/thumb')
    .set('Authorization', `Bearer ${tokenFor('moi@parent.com')}`);
  expect(res.status).toBe(403);
});

test('GET /file/:id/thumb — 404 pour un parent si la photo n\'est pas APPROVED', async () => {
  prisma.photo.findUnique.mockResolvedValue({
    id: 8, statut: 'PENDING', thumbnailPath: '/tmp/test-photos/thumbs/8.jpg',
    tags: [{ campeur: { parents: [{ id: 50, email: 'moi@parent.com' }] } }],
  });
  const res = await request(app)
    .get('/api/photos/file/8/thumb')
    .set('Authorization', `Bearer ${tokenFor('moi@parent.com')}`);
  expect(res.status).toBe(404);
});

// --- IDOR sur l'originale ---
test('GET /file/:id — 403 si le parent ne possède pas la photo', async () => {
  prisma.photo.findUnique.mockResolvedValue({
    id: 9, statut: 'APPROVED', fichierPath: '/tmp/test-photos/9.jpg',
    tags: [{ campeur: { parents: [{ id: 50, email: 'autre@parent.com' }] } }],
  });
  const res = await request(app)
    .get('/api/photos/file/9')
    .set('Authorization', `Bearer ${tokenFor('moi@parent.com')}`);
  expect(res.status).toBe(403);
});

// --- Multi-enfants : la galerie agrège les campeurs de TOUTES les lignes du courriel ---
test('GET /api/parents/photos — résout les campeurs de tous les enfants du courriel', async () => {
  prisma.parent.findMany.mockResolvedValue([{ campeurId: 1 }, { campeurId: 2 }]);
  prisma.photo.findMany.mockResolvedValue([]);
  const res = await request(app)
    .get('/api/parents/photos')
    .set('Authorization', `Bearer ${tokenFor('famille@parent.com')}`);
  expect(res.status).toBe(200);
  // la requête Parent cible le courriel, pas un id unique
  expect(prisma.parent.findMany).toHaveBeenCalledWith({ where: { email: 'famille@parent.com' } });
  // les photos sont filtrées sur les DEUX enfants
  expect(prisma.photo.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        statut: 'APPROVED',
        tags: { some: { campeurId: { in: [1, 2] } } },
      }),
    })
  );
});

// --- Rétrocompatibilité : un ancien jeton { id } continue de fonctionner ---
test('ancien jeton { id } — la galerie retombe sur la recherche par id', async () => {
  prisma.parent.findMany.mockResolvedValue([{ campeurId: 3 }]);
  prisma.photo.findMany.mockResolvedValue([]);
  const oldToken = jwt.sign({ id: 42, type: 'parent' }, SECRET);
  const res = await request(app)
    .get('/api/parents/photos')
    .set('Authorization', `Bearer ${oldToken}`);
  expect(res.status).toBe(200);
  expect(prisma.parent.findMany).toHaveBeenCalledWith({ where: { id: 42 } });
});
