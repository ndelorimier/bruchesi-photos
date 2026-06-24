const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-minimum-xxxx';

jest.mock('@prisma/client', () => {
  const m = {
    employe: { findUnique: jest.fn(), update: jest.fn() },
    passwordReset: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn((arr) => Promise.all(arr)),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => m) };
});
jest.mock('../src/services/email', () => ({ sendMagicLink: jest.fn(), sendPasswordReset: jest.fn().mockResolvedValue() }));
jest.mock('../src/services/push', () => ({ sendToParents: jest.fn() }));
jest.mock('../src/services/faceQueue', () => ({ startWorker: jest.fn() }));

const { app } = require('../src/server');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordReset } = require('../src/services/email');
const prisma = new PrismaClient();

beforeEach(() => jest.clearAllMocks());

test('POST /forgot-password — réponse générique + crée un lien si le compte existe', async () => {
  prisma.employe.findUnique.mockResolvedValue({ id: 9, email: 'admin@x.ca' });
  prisma.passwordReset.create.mockResolvedValue({ token: 'tok-123' });

  const res = await request(app).post('/api/employes/forgot-password').send({ email: 'Admin@X.ca' });
  expect(res.status).toBe(200);
  expect(prisma.passwordReset.create).toHaveBeenCalled();
  expect(sendPasswordReset).toHaveBeenCalledWith('admin@x.ca', 'tok-123');
});

test('POST /forgot-password — compte inexistant : même réponse, aucun lien créé (anti-énumération)', async () => {
  prisma.employe.findUnique.mockResolvedValue(null);
  const res = await request(app).post('/api/employes/forgot-password').send({ email: 'inconnu@x.ca' });
  expect(res.status).toBe(200);
  expect(prisma.passwordReset.create).not.toHaveBeenCalled();
});

test('POST /reset-password — jeton invalide → 400', async () => {
  prisma.passwordReset.findUnique.mockResolvedValue(null);
  const res = await request(app).post('/api/employes/reset-password').send({ token: 'bad', newPassword: 'nouveau123' });
  expect(res.status).toBe(400);
  expect(prisma.employe.update).not.toHaveBeenCalled();
});

test('POST /reset-password — jeton expiré → 400', async () => {
  prisma.passwordReset.findUnique.mockResolvedValue({ id: 1, employeId: 9, usedAt: null, expiresAt: new Date(Date.now() - 1000) });
  const res = await request(app).post('/api/employes/reset-password').send({ token: 'old', newPassword: 'nouveau123' });
  expect(res.status).toBe(400);
  expect(prisma.employe.update).not.toHaveBeenCalled();
});

test('POST /reset-password — jeton valide → 200 + met à jour le mot de passe', async () => {
  prisma.passwordReset.findUnique.mockResolvedValue({ id: 1, employeId: 9, usedAt: null, expiresAt: new Date(Date.now() + 3600000) });
  prisma.employe.update.mockResolvedValue({});
  prisma.passwordReset.update.mockResolvedValue({});
  prisma.passwordReset.updateMany.mockResolvedValue({});

  const res = await request(app).post('/api/employes/reset-password').send({ token: 'good', newPassword: 'nouveau123' });
  expect(res.status).toBe(200);
  expect(prisma.employe.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 9 }, data: expect.objectContaining({ passwordHash: expect.any(String) }) })
  );
});

test('POST /reset-password — mot de passe trop court → 400', async () => {
  const res = await request(app).post('/api/employes/reset-password').send({ token: 'good', newPassword: 'court' });
  expect(res.status).toBe(400);
});
