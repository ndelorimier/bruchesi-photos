const { PrismaClient } = require('@prisma/client');

// Singleton — une seule pool de connexions pour tout le process
const prisma = new PrismaClient();

module.exports = prisma;
