const bggClient = require('../utils/bgg');
const asyncHandler = require('../utils/asyncHandler');

const BGG_ERROR_MESSAGE = 'Não foi possível buscar no BoardGameGeek. Tente novamente.';

const search = asyncHandler(async function search(req, res) {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Informe um termo de busca' });
  }

  let results;
  try {
    results = await bggClient.searchGames(query);
  } catch {
    return res.status(502).json({ error: BGG_ERROR_MESSAGE });
  }

  res.json(results.slice(0, 15));
});

const getDetails = asyncHandler(async function getDetails(req, res) {
  let details;
  try {
    details = await bggClient.getGameDetails(req.params.id);
  } catch {
    return res.status(502).json({ error: BGG_ERROR_MESSAGE });
  }

  if (!details) {
    return res.status(404).json({ error: 'Jogo não encontrado no BoardGameGeek' });
  }

  res.json(details);
});

module.exports = { search, getDetails };
