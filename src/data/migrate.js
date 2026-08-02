const db = require('./db');

async function runMigrations() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    )
  `);

  await db.execute(`
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

  const columns = await db.execute('PRAGMA table_info(boardgames)');
  if (!columns.rows.some(col => col.name === 'userId')) {
    await db.execute('ALTER TABLE boardgames ADD COLUMN userId TEXT');
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS boardgame_links (
      id TEXT PRIMARY KEY,
      boardgameId TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
}

module.exports = runMigrations;
