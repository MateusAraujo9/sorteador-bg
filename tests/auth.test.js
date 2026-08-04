require('./helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  startTestServer,
  getVerificationCode,
  cleanupDbFile,
  uniqueEmail,
  registerAndVerify
} = require('./helpers/testServer');

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
  await cleanupDbFile();
});

test('register cria conta não verificada, sem logar automaticamente', async () => {
  const client = server.client();
  const email = uniqueEmail('register');

  const res = await client.post('/api/auth/register', { name: 'Fulano', email, password: 'senha123' });

  assert.equal(res.status, 201);
  assert.equal(res.body.email, email);
  assert.equal(client.hasCookie(), false, 'register não deveria setar cookie de sessão');

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 401, 'usuário recém-cadastrado ainda não está logado');
});

test('register valida nome, e-mail e senha', async () => {
  const client = server.client();
  const email = uniqueEmail('invalid');

  const noName = await client.post('/api/auth/register', { email, password: 'senha123' });
  assert.equal(noName.status, 400);

  const badEmail = await client.post('/api/auth/register', { name: 'X', email: 'nao-e-email', password: 'senha123' });
  assert.equal(badEmail.status, 400);

  const shortPassword = await client.post('/api/auth/register', { name: 'X', email, password: '123' });
  assert.equal(shortPassword.status, 400);
});

test('register com e-mail já verificado retorna 409', async () => {
  const client = server.client();
  const { email } = await registerAndVerify(client);

  const other = server.client();
  const res = await other.post('/api/auth/register', { name: 'Outro', email, password: 'outrasenha' });

  assert.equal(res.status, 409);
});

test('register com e-mail ainda não verificado reaproveita a conta em vez de 409', async () => {
  const client = server.client();
  const email = uniqueEmail('reregister');

  const first = await client.post('/api/auth/register', { name: 'Nome Original', email, password: 'senha111' });
  const firstCode = await getVerificationCode(email);

  const second = await client.post('/api/auth/register', { name: 'Nome Novo', email, password: 'senha222' });
  const secondCode = await getVerificationCode(email);

  assert.equal(second.status, 201);
  assert.equal(first.body.email, second.body.email);
  assert.notEqual(firstCode, secondCode, 'reenvio deveria gerar um código novo');

  // o código antigo não deve mais funcionar, o novo (com a senha nova) sim
  const verifyOld = await client.post('/api/auth/verify-email', { email, code: firstCode });
  assert.equal(verifyOld.status, 400);

  const verifyNew = await client.post('/api/auth/verify-email', { email, code: secondCode });
  assert.equal(verifyNew.status, 200);
  assert.equal(verifyNew.body.name, 'Nome Novo');
});

test('login com senha errada retorna 401', async () => {
  const client = server.client();
  const { email } = await registerAndVerify(client);

  const wrongClient = server.client();
  const res = await wrongClient.post('/api/auth/login', { email, password: 'senhaerrada' });

  assert.equal(res.status, 401);
});

test('login com senha certa mas e-mail não verificado retorna 403 needsVerification', async () => {
  const client = server.client();
  const email = uniqueEmail('unverified-login');
  await client.post('/api/auth/register', { name: 'X', email, password: 'senha123' });

  const res = await client.post('/api/auth/login', { email, password: 'senha123' });

  assert.equal(res.status, 403);
  assert.equal(res.body.needsVerification, true);
  assert.equal(res.body.email, email);
});

test('verify-email com código errado não verifica e incrementa tentativas', async () => {
  const client = server.client();
  const email = uniqueEmail('wrong-code');
  await client.post('/api/auth/register', { name: 'X', email, password: 'senha123' });

  const res = await client.post('/api/auth/verify-email', { email, code: '0000' });
  assert.equal(res.status, 400);
  assert.equal(client.hasCookie(), false);

  const login = await client.post('/api/auth/login', { email, password: 'senha123' });
  assert.equal(login.status, 403, 'conta continua não verificada após código errado');
});

test('verify-email com código certo loga (seta cookie) e habilita login normal depois', async () => {
  const client = server.client();
  const email = uniqueEmail('correct-code');
  await client.post('/api/auth/register', { name: 'X', email, password: 'senha123' });
  const code = await getVerificationCode(email);

  const res = await client.post('/api/auth/verify-email', { email, code });
  assert.equal(res.status, 200);
  assert.equal(client.hasCookie(), true);

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.email, email);

  const freshClient = server.client();
  const login = await freshClient.post('/api/auth/login', { email, password: 'senha123' });
  assert.equal(login.status, 200);
});

test('verify-email numa conta já verificada retorna 400', async () => {
  const client = server.client();
  const { email } = await registerAndVerify(client);

  const res = await client.post('/api/auth/verify-email', { email, code: '1234' });
  assert.equal(res.status, 400);
});

test('resend-verification gera um novo código e invalida o anterior', async () => {
  const client = server.client();
  const email = uniqueEmail('resend');
  await client.post('/api/auth/register', { name: 'X', email, password: 'senha123' });
  const oldCode = await getVerificationCode(email);

  const resend = await client.post('/api/auth/resend-verification', { email });
  assert.equal(resend.status, 200);

  const newCode = await getVerificationCode(email);
  assert.notEqual(oldCode, newCode);

  const verifyOld = await client.post('/api/auth/verify-email', { email, code: oldCode });
  assert.equal(verifyOld.status, 400);

  const verifyNew = await client.post('/api/auth/verify-email', { email, code: newCode });
  assert.equal(verifyNew.status, 200);
});

test('resend-verification responde 200 genérico mesmo para e-mail inexistente', async () => {
  const client = server.client();
  const res = await client.post('/api/auth/resend-verification', { email: uniqueEmail('ghost') });
  assert.equal(res.status, 200);
});

test('logout limpa a sessão', async () => {
  const client = server.client();
  await registerAndVerify(client);

  const logout = await client.post('/api/auth/logout');
  assert.equal(logout.status, 200);

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 401);
});

test('/me sem cookie retorna 401', async () => {
  const client = server.client();
  const res = await client.get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('forgot-password responde 200 genérico exista ou não a conta', async () => {
  const client = server.client();
  const { email } = await registerAndVerify(client);

  const known = await client.post('/api/auth/forgot-password', { email });
  const unknown = await client.post('/api/auth/forgot-password', { email: uniqueEmail('ghost') });

  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.body.message, unknown.body.message);
});

test('reset-password com token inválido retorna 400', async () => {
  const client = server.client();
  const res = await client.post('/api/auth/reset-password', { token: 'token-que-nao-existe', newPassword: 'novaSenha1' });
  assert.equal(res.status, 400);
});
