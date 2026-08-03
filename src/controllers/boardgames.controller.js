const repository = require('../data/boardgamesRepository');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async function list(req, res) {
  const includeDeleted = req.query.includeDeleted === 'true';
  res.json(await repository.readAllByUser(req.user.id, { includeDeleted }));
});

const create = asyncHandler(async function create(req, res) {
  const { name, minPlayers, maxPlayers, duration, category, imageUrl, minAge } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const newGame = {
    id: Date.now().toString(),
    userId: req.user.id,
    name: name.trim(),
    minPlayers: minPlayers || null,
    maxPlayers: maxPlayers || null,
    duration: duration || null,
    category: category || null,
    imageUrl: imageUrl || null,
    minAge: minAge || null,
    createdAt: new Date().toISOString()
  };

  await repository.create(newGame);
  res.status(201).json(newGame);
});

const update = asyncHandler(async function update(req, res) {
  const { name, minPlayers, maxPlayers, duration, category, imageUrl, minAge } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const updated = await repository.update(req.params.id, req.user.id, {
    name: name.trim(),
    minPlayers: minPlayers || null,
    maxPlayers: maxPlayers || null,
    duration: duration || null,
    category: category || null,
    imageUrl: imageUrl || null,
    minAge: minAge || null
  });

  if (!updated) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }

  res.json(updated);
});

const remove = asyncHandler(async function remove(req, res) {
  const removed = await repository.remove(req.params.id, req.user.id);
  if (!removed) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }
  res.json({ message: 'Boardgame removido com sucesso' });
});

const restore = asyncHandler(async function restore(req, res) {
  const restored = await repository.restore(req.params.id, req.user.id);
  if (!restored) {
    return res.status(404).json({ error: 'Boardgame excluído não encontrado' });
  }
  res.json({ message: 'Boardgame reativado com sucesso' });
});

const random = asyncHandler(async function random(req, res) {
  const { players, minAge, category } = req.query;
  const hasFilters = Boolean(players || minAge || category);

  const game = await repository.randomOneByUser(req.user.id, { players, minAge, category });
  if (!game) {
    return res.status(404).json({
      error: hasFilters
        ? 'Nenhum jogo encontrado com esses filtros.'
        : 'Nenhum boardgame cadastrado para sortear'
    });
  }
  res.json(game);
});

module.exports = { list, create, update, remove, restore, random };
