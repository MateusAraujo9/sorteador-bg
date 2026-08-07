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

async function createGame(client, name = 'Jogo de Teste') {
  const res = await client.post('/api/boardgames', { name });
  return res.body.id;
}

test('inicia, adiciona participantes, atualiza placar e finaliza com um vencedor', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  assert.equal(start.status, 201);
  assert.equal(start.body.status, 'in_progress');
  assert.equal(start.body.boardgame.id, gameId);
  const matchId = start.body.id;

  const active = await client.get('/api/matches/active');
  assert.equal(active.status, 200);
  assert.equal(active.body.id, matchId);

  const p1 = await client.post(`/api/matches/${matchId}/participants`, { name: 'Ana' });
  assert.equal(p1.status, 201);
  const p2 = await client.post(`/api/matches/${matchId}/participants`, { name: 'Bruno' });
  assert.equal(p2.status, 201);

  const score1 = await client.patch(`/api/matches/${matchId}/participants/${p1.body.id}`, { score: 10 });
  assert.equal(score1.status, 200);
  const score2 = await client.patch(`/api/matches/${matchId}/participants/${p2.body.id}`, { score: 5 });
  assert.equal(score2.status, 200);

  const finish = await client.post(`/api/matches/${matchId}/finish`, {});
  assert.equal(finish.status, 200);
  assert.equal(finish.body.status, 'finished');
  assert.equal(finish.body.isTie, 0);
  assert.equal(finish.body.winnerParticipantId, p1.body.id);

  const activeAfter = await client.get('/api/matches/active');
  assert.equal(activeAfter.status, 404);
});

test('a partida traz os documentos (manual) do jogo sorteado', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);
  await client.post(`/api/boardgames/${gameId}/links`, {
    label: 'Regras base',
    url: 'https://exemplo.com/regras.pdf'
  });

  const start = await client.post('/api/matches', { boardgameId: gameId });
  assert.equal(start.body.boardgame.links.length, 1);
  assert.equal(start.body.boardgame.links[0].label, 'Regras base');

  const active = await client.get('/api/matches/active');
  assert.equal(active.body.boardgame.links.length, 1);
});

test('empate entre participantes não define vencedor', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const matchId = start.body.id;

  const p1 = await client.post(`/api/matches/${matchId}/participants`, { name: 'Carla' });
  const p2 = await client.post(`/api/matches/${matchId}/participants`, { name: 'Duda' });
  await client.patch(`/api/matches/${matchId}/participants/${p1.body.id}`, { score: 7 });
  await client.patch(`/api/matches/${matchId}/participants/${p2.body.id}`, { score: 7 });

  const finish = await client.post(`/api/matches/${matchId}/finish`, {});
  assert.equal(finish.status, 200);
  assert.equal(finish.body.isTie, 1);
  assert.equal(finish.body.winnerParticipantId, null);
});

test('finalizar sem participantes não define vencedor nem empate', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const finish = await client.post(`/api/matches/${start.body.id}/finish`, {});

  assert.equal(finish.status, 200);
  assert.equal(finish.body.isTie, 0);
  assert.equal(finish.body.winnerParticipantId, null);
});

test('remove participante antes de finalizar', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const matchId = start.body.id;
  const p1 = await client.post(`/api/matches/${matchId}/participants`, { name: 'Eva' });

  const remove = await client.delete(`/api/matches/${matchId}/participants/${p1.body.id}`);
  assert.equal(remove.status, 200);

  const active = await client.get('/api/matches/active');
  assert.equal(active.body.participants.length, 0);
});

test('pausa e retoma o cronômetro', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const matchId = start.body.id;

  const pause = await client.post(`/api/matches/${matchId}/pause`, {});
  assert.equal(pause.status, 200);
  assert.equal(pause.body.runningSince, null);
  assert.ok(pause.body.elapsedMs >= 0);

  const pauseAgain = await client.post(`/api/matches/${matchId}/pause`, {});
  assert.equal(pauseAgain.status, 400);

  const resume = await client.post(`/api/matches/${matchId}/resume`, {});
  assert.equal(resume.status, 200);
  assert.ok(resume.body.runningSince);

  const resumeAgain = await client.post(`/api/matches/${matchId}/resume`, {});
  assert.equal(resumeAgain.status, 400);
});

test('cancela uma partida em andamento', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const cancel = await client.delete(`/api/matches/${start.body.id}`);
  assert.equal(cancel.status, 200);

  const active = await client.get('/api/matches/active');
  assert.equal(active.status, 404);
});

test('só permite uma partida ativa por vez', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  await client.post('/api/matches', { boardgameId: gameId });
  const second = await client.post('/api/matches', { boardgameId: gameId });
  assert.equal(second.status, 409);
});

test('não inicia partida com jogo de outro usuário', async () => {
  const ownerClient = server.client();
  await registerAndVerify(ownerClient);
  const gameId = await createGame(ownerClient);

  const otherClient = server.client();
  await registerAndVerify(otherClient);
  const start = await otherClient.post('/api/matches', { boardgameId: gameId });
  assert.equal(start.status, 404);
});

test('partidas e participantes são isolados por usuário', async () => {
  const ownerClient = server.client();
  await registerAndVerify(ownerClient);
  const gameId = await createGame(ownerClient);
  const ownerMatch = await ownerClient.post('/api/matches', { boardgameId: gameId });
  const matchId = ownerMatch.body.id;

  const otherClient = server.client();
  await registerAndVerify(otherClient);

  const addParticipant = await otherClient.post(`/api/matches/${matchId}/participants`, { name: 'Intruso' });
  assert.equal(addParticipant.status, 404);

  const finish = await otherClient.post(`/api/matches/${matchId}/finish`, {});
  assert.equal(finish.status, 404);

  const cancel = await otherClient.delete(`/api/matches/${matchId}`);
  assert.equal(cancel.status, 404);
});

test('não edita participantes de uma partida já finalizada', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const matchId = start.body.id;
  await client.post(`/api/matches/${matchId}/finish`, {});

  const addAfterFinish = await client.post(`/api/matches/${matchId}/participants`, { name: 'Tarde demais' });
  assert.equal(addAfterFinish.status, 404);
});

test('valida nome do participante e placar inteiro', async () => {
  const client = server.client();
  await registerAndVerify(client);
  const gameId = await createGame(client);

  const start = await client.post('/api/matches', { boardgameId: gameId });
  const matchId = start.body.id;

  const noName = await client.post(`/api/matches/${matchId}/participants`, { name: '' });
  assert.equal(noName.status, 400);

  const participant = await client.post(`/api/matches/${matchId}/participants`, { name: 'Fê' });
  const badScore = await client.patch(`/api/matches/${matchId}/participants/${participant.body.id}`, { score: 1.5 });
  assert.equal(badScore.status, 400);
});
