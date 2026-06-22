#!/bin/sh
set -e
# Applique les migrations versionnées (api/prisma/migrations/).
#  - BD vierge : migrate deploy applique 0_init et crée tout le schéma.
#  - BD existante (créée jadis par db push) : baseliner UNE fois, hors bande, via
#    `prisma migrate resolve --applied 0_init` ; ensuite migrate deploy est un no-op.
./node_modules/.bin/prisma migrate deploy
exec node src/server.js
