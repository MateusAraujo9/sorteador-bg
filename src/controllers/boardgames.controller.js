const repository = require('../data/boardgamesRepository');

function list(req, res) {
  res.json(repository.readAll());
}

function create(req, res) {
  const { name, minPlayers, maxPlayers, duration, category, imageUrl, minAge } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  const newGame = {
    id: Date.now().toString(),
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

function remove(req, res) {
  const removed = repository.remove(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }
  res.json({ message: 'Boardgame removido com sucesso' });
}

function random(req, res) {
  const game = repository.randomOne();
  if (!game) {
    return res.status(404).json({ error: 'Nenhum boardgame cadastrado para sortear' });
  }
  res.json(game);
}

module.exports = { list, create, remove, random };
