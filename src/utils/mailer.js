const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.APP_PASS_GMAIL
      }
    });
  }
  return transporter;
}

async function sendPasswordResetEmail(to, resetUrl) {
  await getTransporter().sendMail({
    from: `"Sorteador de Boardgames" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Redefinir sua senha — Sorteador de Boardgames',
    html: `
      <p>Você pediu para redefinir sua senha no Sorteador de Boardgames.</p>
      <p><a href="${resetUrl}">Clique aqui para escolher uma nova senha</a></p>
      <p>Esse link expira em 1 hora. Se você não pediu isso, pode ignorar este e-mail.</p>
    `
  });
}

module.exports = { sendPasswordResetEmail };
