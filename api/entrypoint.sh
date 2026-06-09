#!/bin/sh
set -e
# prisma db push crée les tables si absentes (idempotent, safe pour démarrage initial)
# Remplacer par prisma migrate deploy une fois les fichiers de migration générés
./node_modules/.bin/prisma db push --accept-data-loss
exec node src/server.js
