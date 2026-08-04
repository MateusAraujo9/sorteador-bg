require('./helpers/env');

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cleanupDbFile, registerAndVerify } = require('./helpers/testServer');
const bggClient = require('../src/utils/bgg');

let server;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
  await cleanupDbFile();
});

test('parseSearchXml extrai id, nome e ano de cada resultado', () => {
  const xml = `<?xml version="1.0"?>
    <items total="2">
      <item type="boardgame" id="13">
        <name type="primary" value="Catan"/>
        <yearpublished value="1995"/>
      </item>
      <item type="boardgame" id="223990">
        <name type="primary" value="Catan: Starfarers"/>
        <yearpublished value="2021"/>
      </item>
    </items>`;

  const results = bggClient.parseSearchXml(xml);

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], { id: '13', name: 'Catan', yearPublished: '1995' });
  assert.deepEqual(results[1], { id: '223990', name: 'Catan: Starfarers', yearPublished: '2021' });
});

test('parseSearchXml lida com um único resultado (sem virar array) e com zero resultados', () => {
  const single = `<?xml version="1.0"?>
    <items total="1">
      <item type="boardgame" id="1">
        <name type="primary" value="Solo"/>
      </item>
    </items>`;
  assert.deepEqual(bggClient.parseSearchXml(single), [{ id: '1', name: 'Solo', yearPublished: null }]);

  const empty = '<?xml version="1.0"?><items total="0"/>';
  assert.deepEqual(bggClient.parseSearchXml(empty), []);
});

test('parseThingXml extrai os campos usados pelo formulário de cadastro', () => {
  const xml = `<?xml version="1.0"?>
    <items>
      <item type="boardgame" id="13">
        <thumbnail>https://exemplo.com/thumb.jpg</thumbnail>
        <image>https://exemplo.com/original.jpg</image>
        <name type="primary" sortindex="1" value="Catan"/>
        <name type="alternate" sortindex="1" value="Catan (Kolonisten)"/>
        <minplayers value="3"/>
        <maxplayers value="4"/>
        <playingtime value="120"/>
        <minplaytime value="60"/>
        <maxplaytime value="120"/>
        <minage value="10"/>
        <link type="boardgamecategory" id="1021" value="Negotiation"/>
        <link type="boardgamecategory" id="1097" value="Territory Building"/>
        <link type="boardgamemechanic" id="2073" value="Dice Rolling"/>
      </item>
    </items>`;

  assert.deepEqual(bggClient.parseThingXml(xml), {
    name: 'Catan',
    minPlayers: '3',
    maxPlayers: '4',
    duration: '120',
    minAge: '10',
    category: 'Negotiation',
    imageUrl: 'https://exemplo.com/original.jpg'
  });
});

test('parseThingXml usa maxplaytime quando playingtime é 0, e retorna null para item inexistente', () => {
  const zeroPlaytime = `<?xml version="1.0"?>
    <items>
      <item type="boardgame" id="1">
        <name type="primary" value="X"/>
        <playingtime value="0"/>
        <maxplaytime value="45"/>
      </item>
    </items>`;
  assert.equal(bggClient.parseThingXml(zeroPlaytime).duration, '45');

  const notFound = '<?xml version="1.0"?><items termsofuse="x"/>';
  assert.equal(bggClient.parseThingXml(notFound), null);
});

test('GET /api/bgg/search exige autenticação', async () => {
  const client = server.client();
  const res = await client.get('/api/bgg/search?q=catan');
  assert.equal(res.status, 401);
});

test('GET /api/bgg/search retorna 400 sem termo de busca', async () => {
  const client = server.client();
  await registerAndVerify(client);

  const res = await client.get('/api/bgg/search?q=');
  assert.equal(res.status, 400);
});

test('GET /api/bgg/search retorna os resultados do client (mockado)', async t => {
  const client = server.client();
  await registerAndVerify(client);

  t.mock.method(bggClient, 'searchGames', async () => [{ id: '13', name: 'Catan', yearPublished: '1995' }]);

  const res = await client.get('/api/bgg/search?q=catan');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, [{ id: '13', name: 'Catan', yearPublished: '1995' }]);
});

test('GET /api/bgg/:id retorna 404 quando o jogo não existe no BGG', async t => {
  const client = server.client();
  await registerAndVerify(client);

  t.mock.method(bggClient, 'getGameDetails', async () => null);

  const res = await client.get('/api/bgg/999999');
  assert.equal(res.status, 404);
});

test('GET /api/bgg/:id retorna 502 quando a busca ao BGG falha', async t => {
  const client = server.client();
  await registerAndVerify(client);

  t.mock.method(bggClient, 'getGameDetails', async () => {
    throw new Error('boom');
  });

  const res = await client.get('/api/bgg/13');
  assert.equal(res.status, 502);
});
