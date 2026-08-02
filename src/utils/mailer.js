const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const FELT = '#14302b';
const CARD = '#f4ecd8';
const INK = '#241b12';
const INK_SOFT = '#6b6154';
const EMBER = '#d1495b';
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function passwordResetEmailHtml(resetUrl) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir senha</title>
</head>
<body style="margin:0; padding:0; background-color:${FELT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${FELT};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:24px; font-family:${SANS}; font-size:15px; color:#f4ecd8;">
              🎲&nbsp;&nbsp;<strong>Sorteador de Boardgames</strong>
            </td>
          </tr>
          <tr>
            <td style="background-color:${CARD}; border-radius:16px; padding:40px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-family:${SERIF}; font-size:24px; font-weight:bold; color:${EMBER}; padding-bottom:16px;">
                    Redefinir sua senha
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:${SANS}; font-size:15px; line-height:1.6; color:${INK}; padding-bottom:28px;">
                    Recebemos um pedido para redefinir a senha da sua conta.<br>
                    Clique no botão abaixo para escolher uma nova senha.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="background-color:${EMBER}; border-radius:999px;">
                          <a href="${resetUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-family:${SANS}; font-size:15px; font-weight:bold; color:#f4ecd8; text-decoration:none;">
                            Redefinir senha
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:${SANS}; font-size:13px; color:${INK_SOFT}; padding-bottom:24px;">
                    Esse link expira em 1 hora.
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid rgba(36,27,18,0.12); padding-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:${SANS}; font-size:12px; line-height:1.6; color:${INK_SOFT};">
                          Se o botão não funcionar, copie e cole este link no navegador:<br>
                          <a href="${resetUrl}" target="_blank" style="color:${EMBER}; word-break:break-all;">${resetUrl}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:${SANS}; font-size:12px; line-height:1.6; color:${INK_SOFT}; padding-top:16px;">
                          Se você não pediu a redefinição de senha, pode ignorar este e-mail com segurança — sua conta continua protegida.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px; font-family:${SANS}; font-size:12px; color:rgba(244,236,216,0.55);">
              Sorteador de Boardgames
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function passwordResetEmailText(resetUrl) {
  return [
    'Sorteador de Boardgames',
    '',
    'Redefinir sua senha',
    '',
    'Recebemos um pedido para redefinir a senha da sua conta.',
    'Acesse o link abaixo para escolher uma nova senha (expira em 1 hora):',
    '',
    resetUrl,
    '',
    'Se você não pediu a redefinição de senha, pode ignorar este e-mail com segurança.'
  ].join('\n');
}

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
      subject: '🎲 Redefinir sua senha — Sorteador de Boardgames',
      htmlContent: passwordResetEmailHtml(resetUrl),
      textContent: passwordResetEmailText(resetUrl)
    })
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail via Brevo (${response.status}): ${errorBody}`);
  }
}

module.exports = { sendPasswordResetEmail };
