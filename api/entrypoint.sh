#!/bin/sh
./node_modules/.bin/prisma migrate deploy
exec node src/server.js
