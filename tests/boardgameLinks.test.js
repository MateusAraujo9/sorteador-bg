require('./helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cleanupDbFile, registerAndVerify } = require('./helpers/testServer');

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
  await cleanupDbFile();
});

async function createGame(client, name = 'Jogo com Documentos') {
  const res = await client.post('/api/boardgames', { name });
  return res.body.id;
}

test('cria, lista e remove documentos de um jogo', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const create = await client.post(`/api/boardgames/${gameId}/links`, {
    label: 'Regras base',
    url: 'https://exemplo.com/regras.pdf'
  });
  assert.equal(create.status, 201);
  const linkId = create.body.id;

  const list = await client.get(`/api/boardgames/${gameId}/links`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, linkId);

  const remove = await client.delete(`/api/boardgames/${gameId}/links/${linkId}`);
  assert.equal(remove.status, 200);

  const listAfter = await client.get(`/api/boardgames/${gameId}/links`);
  assert.equal(listAfter.body.length, 0);
});

test('valida label e url ao criar documento', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const noLabel = await client.post(`/api/boardgames/${gameId}/links`, { label: '', url: 'https://exemplo.com' });
  assert.equal(noLabel.status, 400);

  const badUrl = await client.post(`/api/boardgames/${gameId}/links`, { label: 'X', url: 'nao-e-url' });
  assert.equal(badUrl.status, 400);
});

test('documentos são acessíveis apenas através do dono do jogo', async () => {
  const ownerClient = server.client();
  await registerAndVerify(ownerClient);
  const gameId = await createGame(ownerClient);
  const link = await ownerClient.post(`/api/boardgames/${gameId}/links`, {
    label: 'Regras',
    url: 'https://exemplo.com/regras.pdf'
  });

  const intruderClient = server.client();
  await registerAndVerify(intruderClient);

  const list = await intruderClient.get(`/api/boardgames/${gameId}/links`);
  assert.equal(list.status, 404);

  const create = await intruderClient.post(`/api/boardgames/${gameId}/links`, { label: 'X', url: 'https://exemplo.com' });
  assert.equal(create.status, 404);

  const remove = await intruderClient.delete(`/api/boardgames/${gameId}/links/${link.body.id}`);
  assert.equal(remove.status, 404);
});

test('documentos de um jogo excluído (soft delete) ficam inacessíveis', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);
  await client.post(`/api/boardgames/${gameId}/links`, { label: 'Regras', url: 'https://exemplo.com/regras.pdf' });

  await client.delete(`/api/boardgames/${gameId}`);

  const list = await client.get(`/api/boardgames/${gameId}/links`);
  assert.equal(list.status, 404);
});
