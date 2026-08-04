const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Precisa rodar (e portanto ser exigido) antes de qualquer require que leve a src/data/db.js,
// já que db.js lê essas variáveis uma única vez, na primeira vez que é carregado.
process.env.NODE_ENV = 'test';
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.BREVO_API_KEY;
process.env.BREVO_SENDER_EMAIL = 'test@example.com';
process.env.DB_FILE = path.join(os.tmpdir(), `sorteador-test-${crypto.randomUUID()}.db`);

module.exports = { dbFile: process.env.DB_FILE };
