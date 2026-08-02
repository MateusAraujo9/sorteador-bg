const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'boardgames.db');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS boardgames (
    id TEXT PRIMARY KEY,
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

function readAll() {
  return db.prepare('SELECT * FROM boardgames ORDER BY createdAt ASC').all();
}

function create(game) {
  db.prepare(`
    INSERT INTO boardgames (id, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    game.id,
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

function remove(id) {
  const result = db.prepare('DELETE FROM boardgames WHERE id = ?').run(id);
  return result.changes > 0;
}

function randomOne() {
  return db.prepare('SELECT * FROM boardgames ORDER BY RANDOM() LIMIT 1').get() || null;
}

module.exports = { readAll, create, remove, randomOne };
