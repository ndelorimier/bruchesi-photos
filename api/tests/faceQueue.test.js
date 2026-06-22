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
    photoTag: { create: jest.fn(), upsert: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const { processPhoto } = require('../src/services/faceQueue');
const compreface = require('../src/services/compreface');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

beforeEach(() => {
  jest.clearAllMocks();
  prisma.photo.update.mockResolvedValue({});
  prisma.campeur.findMany.mockResolvedValue([]);
});

test('processPhoto crée un tag pour chaque visage reconnu avec similarity >= 0.7', async () => {
  prisma.campeur.findMany.mockResolvedValue([
    { id: 1, compreFaceSubjectId: 'theo-t', prenom: 'Théo' },
  ]);
  compreface.reconnaitre.mockResolvedValue([
    { subjects: [{ subject: 'theo-t', similarity: 0.92 }] },
  ]);
  prisma.photoTag.upsert.mockResolvedValue({});

  await processPhoto({ id: 42, fichierPath: '/data/photos/pending/test.jpg' }, prisma);

  expect(prisma.photoTag.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({ photoId: 42, campeurId: 1, confidence: 0.92 }),
    })
  );
});

test('processPhoto ignore les résultats avec similarity < 0.7', async () => {
  prisma.campeur.findMany.mockResolvedValue([
    { id: 2, compreFaceSubjectId: 'emma-b', prenom: 'Emma' },
  ]);
  compreface.reconnaitre.mockResolvedValue([
    { subjects: [{ subject: 'emma-b', similarity: 0.55 }] },
  ]);
  prisma.photoTag.upsert.mockResolvedValue({});

  await processPhoto({ id: 43, fichierPath: '/data/photos/pending/test2.jpg' }, prisma);

  expect(prisma.photoTag.upsert).not.toHaveBeenCalled();
});

test('processPhoto marque la photo iaTraitee=true (sort de la file même sans visage reconnu)', async () => {
  prisma.campeur.findMany.mockResolvedValue([]);
  compreface.reconnaitre.mockResolvedValue([]); // aucun visage reconnu

  await processPhoto({ id: 44, fichierPath: '/data/photos/pending/test3.jpg' }, prisma);

  expect(prisma.photo.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 44 },
      data: { iaTraitee: true },
    })
  );
});
