const crypto = require('crypto');
const boardgamesRepository = require('../data/boardgamesRepository');
const linksRepository = require('../data/boardgameLinksRepository');
const asyncHandler = require('../utils/asyncHandler');

const URL_RE = /^https?:\/\/.+/i;

const list = asyncHandler(async function list(req, res) {
  const game = await boardgamesRepository.findByIdForUser(req.params.gameId, req.user.id);
  if (!game) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }
  res.json(await linksRepository.listByBoardgame(game.id));
});

const create = asyncHandler(async function create(req, res) {
  const { label, url } = req.body;

  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Dê um nome para o documento' });
  }
  if (!url || !URL_RE.test(url.trim())) {
    return res.status(400).json({ error: 'Informe um link válido (começando com http:// ou https://)' });
  }

  const game = await boardgamesRepository.findByIdForUser(req.params.gameId, req.user.id);
  if (!game) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }

  const link = await linksRepository.create({
    id: crypto.randomUUID(),
    boardgameId: game.id,
    label: label.trim(),
    url: url.trim(),
    createdAt: new Date().toISOString()
  });

  res.status(201).json(link);
});

const remove = asyncHandler(async function remove(req, res) {
  const game = await boardgamesRepository.findByIdForUser(req.params.gameId, req.user.id);
  if (!game) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }

  const removed = await linksRepository.remove(req.params.linkId, game.id);
  if (!removed) {
    return res.status(404).json({ error: 'Documento não encontrado' });
  }

  res.json({ message: 'Documento removido com sucesso' });
});

module.exports = { list, create, remove };
