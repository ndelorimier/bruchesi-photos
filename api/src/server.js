const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/employes', require('./routes/employes'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/campeurs', require('./routes/campeurs'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;

async function start() {
  await prisma.$connect();
  require('./services/faceQueue').startWorker();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}

start().catch(console.error);

module.exports = { app, prisma };
