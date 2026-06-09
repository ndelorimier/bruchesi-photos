const express = require('express');
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

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

start().catch(err => { console.error(err); process.exit(1); });

module.exports = { app, prisma };
