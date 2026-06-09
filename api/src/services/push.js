const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@bruchesi.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

async function sendToParents(parentIds, payload) {
  const subs = await prisma.pushSubscription.findMany({
    where: { parentId: { in: parentIds } },
  });
  const unique = Object.values(
    Object.fromEntries(subs.map(s => [s.endpoint, s]))
  );
  const results = await Promise.allSettled(
    unique.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) console.warn(`[push] ${failed}/${results.length} notifications échouées`);
}

module.exports = { sendToParents };
