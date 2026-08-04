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

test('rotas de boardgames exigem autenticação', async () => {
  const client = server.client();

  assert.equal((await client.get('/api/boardgames')).status, 401);
  assert.equal((await client.post('/api/boardgames', { name: 'X' })).status, 401);
  assert.equal((await client.get('/api/boardgames/random')).status, 401);
});

test('ciclo completo: criar, listar, editar, sortear, excluir e reativar', async () => {
  const client = server.client();
  await registerAndVerify(client);

  const create = await client.post('/api/boardgames', {
    name: 'Catan',
    minPlayers: '3',
    maxPlayers: '4',
    duration: '90',
    category: 'Estratégia',
    minAge: '10'
  });
  assert.equal(create.status, 201);
  const gameId = create.body.id;

  const list = await client.get('/api/boardgames');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, gameId);

  const update = await client.put(`/api/boardgames/${gameId}`, { name: 'Catan Deluxe' });
  assert.equal(update.status, 200);
  assert.equal(update.body.name, 'Catan Deluxe');

  const random = await client.get('/api/boardgames/random');
  assert.equal(random.status, 200);
  assert.equal(random.body.id, gameId);

  const del = await client.delete(`/api/boardgames/${gameId}`);
  assert.equal(del.status, 200);

  const listAfterDelete = await client.get('/api/boardgames');
  assert.equal(listAfterDelete.body.length, 0, 'jogo excluído não deve aparecer na listagem padrão');

  const listIncludingDeleted = await client.get('/api/boardgames?includeDeleted=true');
  assert.equal(listIncludingDeleted.body.length, 1);
  assert.notEqual(listIncludingDeleted.body[0].deletedAt, null);

  const doubleDelete = await client.delete(`/api/boardgames/${gameId}`);
  assert.equal(doubleDelete.status, 404, 'excluir de novo um jogo já excluído deve dar 404');

  const restore = await client.post(`/api/boardgames/${gameId}/restore`);
  assert.equal(restore.status, 200);

  const listAfterRestore = await client.get('/api/boardgames');
  assert.equal(listAfterRestore.body.length, 1);

  const doubleRestore = await client.post(`/api/boardgames/${gameId}/restore`);
  assert.equal(doubleRestore.status, 404, 'reativar de novo um jogo já ativo deve dar 404');
});

test('um usuário não enxerga nem edita jogos de outro usuário', async () => {
  const ownerClient = server.client();
  await registerAndVerify(ownerClient);
  const created = await ownerClient.post('/api/boardgames', { name: 'Jogo do Dono' });
  const gameId = created.body.id;

  const intruderClient = server.client();
  await registerAndVerify(intruderClient);

  const list = await intruderClient.get('/api/boardgames');
  assert.equal(list.body.length, 0);

  const update = await intruderClient.put(`/api/boardgames/${gameId}`, { name: 'Hackeado' });
  assert.equal(update.status, 404);

  const del = await intruderClient.delete(`/api/boardgames/${gameId}`);
  assert.equal(del.status, 404);

  const restore = await intruderClient.post(`/api/boardgames/${gameId}/restore`);
  assert.equal(restore.status, 404);
});

test('POST /boardgames exige nome', async () => {
  const client = server.client();
  await registerAndVerify(client);

  const res = await client.post('/api/boardgames', { name: '  ' });
  assert.equal(res.status, 400);
});

test('GET /random filtra por jogadores, idade e categoria', async () => {
  const client = server.client();
  await registerAndVerify(client);

  await client.post('/api/boardgames', { name: 'Jogo Família', minPlayers: '2', maxPlayers: '4', minAge: '6', category: 'Família' });
  await client.post('/api/boardgames', { name: 'Jogo Pesado', minPlayers: '3', maxPlayers: '6', minAge: '14', category: 'Estratégia' });

  const forFamily = await client.get('/api/boardgames/random?players=2&minAge=6&category=Família');
  assert.equal(forFamily.status, 200);
  assert.equal(forFamily.body.name, 'Jogo Família');

  const noMatch = await client.get('/api/boardgames/random?category=Categoria+Inexistente');
  assert.equal(noMatch.status, 404);
  assert.match(noMatch.body.error, /filtros/);
});

test('GET /random sem nenhum jogo cadastrado retorna 404 com mensagem diferente', async () => {
  const client = server.client();
  await registerAndVerify(client);

  const res = await client.get('/api/boardgames/random');
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.body.error, /filtros/);
});
