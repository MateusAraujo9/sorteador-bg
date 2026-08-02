const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS boardgames (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    minPlayers TEXT,
    maxPlayers TEXT,
    duration TEXT,
    category TEXT,
    imageUrl TEXT,
    minAge TEXT,
    createdAt TEXT NOT NULL
  )
`);

const columns = db.prepare('PRAGMA table_info(boardgames)').all();
if (!columns.some(col => col.name === 'userId')) {
  db.exec('ALTER TABLE boardgames ADD COLUMN userId TEXT');
}

function readAllByUser(userId) {
  return db.prepare('SELECT * FROM boardgames WHERE userId = ? ORDER BY createdAt ASC').all(userId);
}

function create(game) {
  db.prepare(`
    INSERT INTO boardgames (id, userId, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    game.id,
    game.userId,
    game.name,
    game.minPlayers,
    game.maxPlayers,
    game.duration,
    game.category,
    game.imageUrl,
    game.minAge,
    game.createdAt
  );
  return game;
}

function update(id, userId, fields) {
  const result = db.prepare(`
    UPDATE boardgames
    SET name = ?, minPlayers = ?, maxPlayers = ?, duration = ?, category = ?, imageUrl = ?, minAge = ?
    WHERE id = ? AND userId = ?
  `).run(
    fields.name,
    fields.minPlayers,
    fields.maxPlayers,
    fields.duration,
    fields.category,
    fields.imageUrl,
    fields.minAge,
    id,
    userId
  );

  if (result.changes === 0) return null;
  return db.prepare('SELECT * FROM boardgames WHERE id = ?').get(id);
}

function remove(id, userId) {
  const result = db.prepare('DELETE FROM boardgames WHERE id = ? AND userId = ?').run(id, userId);
  return result.changes > 0;
}

function randomOneByUser(userId) {
  return db.prepare('SELECT * FROM boardgames WHERE userId = ? ORDER BY RANDOM() LIMIT 1').get(userId) || null;
}

module.exports = { readAllByUser, create, update, remove, randomOneByUser };
