const { XMLParser } = require('fast-xml-parser');

const BGG_API_URL = 'https://boardgamegeek.com/xmlapi2';
const USER_AGENT = 'Sorteador-de-Boardgames/1.0 (+https://github.com/MateusAraujo9/sorteador-bg)';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function primaryName(item) {
  const names = toArray(item.name);
  const primary = names.find(n => n.type === 'primary') || names[0];
  return primary ? primary.value : '';
}

function parseSearchXml(xml) {
  const data = parser.parse(xml);
  const items = toArray(data.items && data.items.item);

  return items
    .map(item => ({
      id: String(item.id),
      name: primaryName(item),
      yearPublished: item.yearpublished ? item.yearpublished.value : null
    }))
    .filter(game => game.name);
}

function parseThingXml(xml) {
  const data = parser.parse(xml);
  const item = toArray(data.items && data.items.item)[0];
  if (!item) return null;

  const links = toArray(item.link);
  const category = links.find(link => link.type === 'boardgamecategory');

  const playingtime = item.playingtime && item.playingtime.value;
  const duration = playingtime && playingtime !== '0'
    ? playingtime
    : (item.maxplaytime ? item.maxplaytime.value : null);

  return {
    name: primaryName(item),
    minPlayers: item.minplayers ? item.minplayers.value : null,
    maxPlayers: item.maxplayers ? item.maxplayers.value : null,
    duration: duration || null,
    minAge: item.minage ? item.minage.value : null,
    category: category ? category.value : null,
    imageUrl: typeof item.image === 'string' ? item.image : null
  };
}

async function fetchBgg(path) {
  if (!process.env.BGG_API_TOKEN) {
    throw new Error(
      'BGG_API_TOKEN não configurado — a BGG passou a exigir um token de aplicação para usar a API XML ' +
      '(registre-se em https://boardgamegeek.com/applications/create e preencha BGG_API_TOKEN no .env).'
    );
  }

  const response = await fetch(`${BGG_API_URL}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${process.env.BGG_API_TOKEN}`
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`BGG respondeu ${response.status}`);
  }

  return response.text();
}

async function searchGames(query) {
  const xml = await fetchBgg(`/search?type=boardgame&query=${encodeURIComponent(query)}`);
  return parseSearchXml(xml);
}

async function getGameDetails(id) {
  const xml = await fetchBgg(`/thing?id=${encodeURIComponent(id)}`);
  return parseThingXml(xml);
}

module.exports = { searchGames, getGameDetails, parseSearchXml, parseThingXml };
