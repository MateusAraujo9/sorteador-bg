const repository = require('../data/boardgamesRepository');

function list(req, res) {
  res.json(repository.readAllByUser(req.user.id));
}

function create(req, res) {
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

  repository.create(newGame);
  res.status(201).json(newGame);
}

function update(req, res) {
  const { name, minPlayers, maxPlayers, duration, category, imageUrl, minAge } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const updated = repository.update(req.params.id, req.user.id, {
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
}

function remove(req, res) {
  const removed = repository.remove(req.params.id, req.user.id);
  if (!removed) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }
  res.json({ message: 'Boardgame removido com sucesso' });
}

function random(req, res) {
  const game = repository.randomOneByUser(req.user.id);
  if (!game) {
    return res.status(404).json({ error: 'Nenhum boardgame cadastrado para sortear' });
  }
  res.json(game);
}

module.exports = { list, create, update, remove, random };
