const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';
process.env.PHOTOS_PATH = '/tmp/test-photos';

jest.mock('@prisma/client', () => {
  const m = {
    photo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    photoTag: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    notification: { createMany: jest.fn() },
    parent: { findMany: jest.fn() },
    pushSubscription: { findMany: jest.fn() },
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
  prisma.photo.update.mockResolvedValue({ id: 1, statut: 'APPROVED', tags: [] });
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
