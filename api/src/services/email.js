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
      <p>Ce lien est valide 7 jours et à usage unique.</p>
    `,
  });
}

module.exports = { sendMagicLink };
