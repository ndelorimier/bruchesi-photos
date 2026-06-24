#!/usr/bin/env node
/**
 * Crée le premier compte admin.
 * Usage (sur le NAS): node scripts/create-admin.js
 * Ou via Docker: docker-compose exec app node /app/scripts/create-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const prenom = process.env.ADMIN_PRENOM || 'Admin';
const nom = process.env.ADMIN_NOM || 'Bruchési';
const prisma = new PrismaClient();

// Pas de valeurs par défaut exploitables (dépôt public) : on exige des identifiants explicites.
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('❌ ADMIN_EMAIL requis et valide.');
  console.error('   Ex : ADMIN_EMAIL=vous@exemple.ca ADMIN_PASSWORD=motDePasseFort node scripts/create-admin.js');
  process.exit(1);
}
if (!password || password.length < 8 || password === 'changeme123') {
  console.error('❌ ADMIN_PASSWORD requis (8 caractères minimum, pas une valeur par défaut).');
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.employe.upsert({
    where: { email },
    create: { email, prenom, nom, role: 'ADMIN', passwordHash: hash },
    update: { passwordHash: hash },
  });
  console.log(`✅ Admin créé/mis à jour: ${admin.email} (id: ${admin.id})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
