#!/usr/bin/env node
/**
 * Crée le premier compte admin.
 * Usage (sur le NAS): node scripts/create-admin.js
 * Ou via Docker: docker-compose exec app node /app/scripts/create-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const email = process.env.ADMIN_EMAIL || 'admin@bruchesi.com';
const password = process.env.ADMIN_PASSWORD || 'changeme123';
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.employe.upsert({
    where: { email },
    create: { email, prenom: 'Admin', nom: 'Bruchési', role: 'ADMIN', passwordHash: hash },
    update: { passwordHash: hash },
  });
  console.log(`✅ Admin créé/mis à jour: ${admin.email} (id: ${admin.id})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
