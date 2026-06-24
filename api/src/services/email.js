const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendMagicLink(email, token) {
  const url = `${process.env.APP_URL}/auth/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Votre lien de connexion — Bruchési Photos',
    html: `
      <p>Bonjour,</p>
      <p>Cliquez sur le lien ci-dessous pour accéder aux photos de votre enfant :</p>
      <p><a href="${url}">${url}</a></p>
      <p>Ce lien est à usage unique. S'il a expiré, demandez-en un nouveau depuis la page de connexion.</p>
    `,
  });
}

async function sendPasswordReset(email, token) {
  const url = `${process.env.APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Réinitialisation de votre mot de passe — Bruchési Photos',
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
      <p><a href="${url}">${url}</a></p>
      <p>Ce lien est valable 1 heure et à usage unique. Si vous n'êtes pas à l'origine de cette demande, ignorez ce courriel.</p>
    `,
  });
}

module.exports = { sendMagicLink, sendPasswordReset };
