require('./helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cleanupDbFile, registerAndVerify, uniqueEmail } = require('./helpers/testServer');

let server;
let adminClient;
let adminUser;

before(async () => {
  server = await startTestServer();
  // primeiro usuário registrado neste banco isolado (um por arquivo de teste, ver helpers/env.js)
  // vira admin automaticamente — os demais testes reutilizam este client já logado como admin.
  adminClient = server.client();
  const result = await registerAndVerify(adminClient, { name: 'Admin', email: uniqueEmail('admin') });
  adminUser = result.user;
});

after(async () => {
  await server.close();
  await cleanupDbFile();
});

test('o primeiro usuário cadastrado no banco vira admin', async () => {
  assert.equal(adminUser.role, 'admin');
});

test('usuários seguintes nascem como user', async () => {
  const client = server.client();
  const { user } = await registerAndVerify(client, { email: uniqueEmail('regular') });
  assert.equal(user.role, 'user');
});

test('usuário comum não acessa rotas de admin (403)', async () => {
  const client = server.client();
  await registerAndVerify(client, { email: uniqueEmail('blocked') });

  const list = await client.get('/api/admin/users');
  assert.equal(list.status, 403);

  const patch = await client.patch('/api/admin/users/algum-id/role', { role: 'admin' });
  assert.equal(patch.status, 403);
});

test('rotas de admin exigem autenticação', async () => {
  const client = server.client();
  const res = await client.get('/api/admin/users');
  assert.equal(res.status, 401);
});

test('admin lista usuários com a contagem de jogos ativos de cada um', async () => {
  const client = server.client();
  const { user, email } = await registerAndVerify(client, { email: uniqueEmail('withgames') });
  await client.post('/api/boardgames', { name: 'Jogo 1' });
  await client.post('/api/boardgames', { name: 'Jogo 2' });
  const deleted = await client.post('/api/boardgames', { name: 'Jogo Excluído' });
  await client.delete(`/api/boardgames/${deleted.body.id}`);

  const list = await adminClient.get('/api/admin/users');
  assert.equal(list.status, 200);

  const entry = list.body.find(u => u.id === user.id);
  assert.ok(entry, 'usuário deveria aparecer na listagem do admin');
  assert.equal(entry.gameCount, 2, 'jogo excluído (soft delete) não deve contar');
  assert.equal(entry.email, email);
  assert.equal(entry.role, 'user');
  assert.equal(entry.passwordHash, undefined, 'nunca deve vazar o hash da senha');
});

test('admin promove outro usuário a admin', async () => {
  const client = server.client();
  const { user } = await registerAndVerify(client, { email: uniqueEmail('promote') });

  const patch = await adminClient.patch(`/api/admin/users/${user.id}/role`, { role: 'admin' });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.role, 'admin');

  const list = await adminClient.get('/api/admin/users');
  const entry = list.body.find(u => u.id === user.id);
  assert.equal(entry.role, 'admin');
});

test('admin não pode alterar o próprio perfil', async () => {
  const res = await adminClient.patch(`/api/admin/users/${adminUser.id}/role`, { role: 'user' });
  assert.equal(res.status, 400);
});

test('role inválida retorna 400, usuário inexistente retorna 404', async () => {
  const client = server.client();
  const { user } = await registerAndVerify(client, { email: uniqueEmail('invalidrole') });

  const invalid = await adminClient.patch(`/api/admin/users/${user.id}/role`, { role: 'superadmin' });
  assert.equal(invalid.status, 400);

  const missing = await adminClient.patch('/api/admin/users/nao-existe/role', { role: 'admin' });
  assert.equal(missing.status, 404);
});
