const fs = require('fs');
const crypto = require('crypto');
const { dbFile } = require('./env'); // precisa ser o primeiro require do arquivo de teste

const runMigrations = require('../../src/data/migrate');
const createApp = require('../../src/app');
const db = require('../../src/data/db');

async function startTestServer() {
  await runMigrations();
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;

  return {
    baseUrl,
    client: () => createClient(baseUrl),
    close: () => new Promise(resolve => server.close(resolve))
  };
}

function createClient(baseUrl) {
  let cookie = null;

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const opts = { method, headers: { ...headers } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (cookie) opts.headers.Cookie = cookie;

    const res = await fetch(`${baseUrl}${path}`, opts);

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const sidCookie = setCookies.find(c => c.startsWith('sid='));
    if (sidCookie) cookie = sidCookie.split(';')[0];

    let json = null;
    try { json = await res.json(); } catch { /* resposta sem corpo JSON */ }

    return { status: res.status, body: json };
  }

  return {
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
    patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
    delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
    hasCookie: () => cookie !== null,
    clearCookie: () => { cookie = null; }
  };
}

// Não há e-mail real em teste (mailer.js pula o envio quando NODE_ENV=test) — os testes leem
// o código/token direto do banco, do mesmo jeito que foi validado manualmente durante o desenvolvimento.
async function getVerificationCode(email) {
  const result = await db.execute({
    sql: 'SELECT code FROM email_verifications WHERE userId = (SELECT id FROM users WHERE email = ?)',
    args: [email]
  });
  return result.rows[0] ? result.rows[0].code : null;
}

async function getUserByEmail(email) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return result.rows[0] || null;
}

// Best-effort: fecha a conexão e tenta apagar o arquivo temporário. No Windows, o binding nativo
// do libsql não solta o handle do arquivo de forma síncrona nem logo após close() (confirmado —
// nem um pequeno delay ajuda), então o unlink pode falhar com EBUSY e o arquivo só some quando o
// processo do node --test encerra e o SO libera o handle. Sem efeito no Linux/macOS (CI), onde
// apagar um arquivo aberto é uma operação POSIX válida. Cosmético — cada arquivo é pequeno e fica
// isolado no diretório temp do SO, não no repositório.
async function cleanupDbFile() {
  try { await db.close(); } catch { /* já fechado ou nunca chegou a abrir */ }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbFile + suffix); } catch { /* ver comentário acima sobre EBUSY no Windows */ }
  }
}

function uniqueEmail(prefix) {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

// Cadastra e já verifica um usuário (fluxo completo), deixando o client logado (cookie de sessão setado).
// Usado por testes que só precisam de "um usuário autenticado", sem testar o fluxo de verificação em si.
async function registerAndVerify(client, { name = 'Teste', email, password = 'senha123' } = {}) {
  const userEmail = email || uniqueEmail('user');
  await client.post('/api/auth/register', { name, email: userEmail, password });
  const code = await getVerificationCode(userEmail);
  const { body } = await client.post('/api/auth/verify-email', { email: userEmail, code });
  return { email: userEmail, password, user: body };
}

module.exports = {
  startTestServer,
  getVerificationCode,
  getUserByEmail,
  cleanupDbFile,
  uniqueEmail,
  registerAndVerify
};
