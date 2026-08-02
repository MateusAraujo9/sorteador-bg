const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendPasswordResetEmail(to, resetUrl) {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'Sorteador de Boardgames' },
      to: [{ email: to }],
      subject: 'Redefinir sua senha — Sorteador de Boardgames',
      htmlContent: `
        <p>Você pediu para redefinir sua senha no Sorteador de Boardgames.</p>
        <p><a href="${resetUrl}">Clique aqui para escolher uma nova senha</a></p>
        <p>Esse link expira em 1 hora. Se você não pediu isso, pode ignorar este e-mail.</p>
      `
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail via Brevo (${response.status}): ${errorBody}`);
  }
}

module.exports = { sendPasswordResetEmail };
