#!/usr/bin/env node
/**
 * Génère les clés VAPID pour les notifications push Web.
 * Usage: node scripts/generate-vapid.js
 * Copier les valeurs dans .env sur le NAS.
 */

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('# Copier ces valeurs dans .env sur le NAS:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
