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

  const userColumns = await db.execute('PRAGMA table_info(users)');
  if (!userColumns.rows.some(col => col.name === 'emailVerifiedAt')) {
    await db.execute('ALTER TABLE users ADD COLUMN emailVerifiedAt TEXT');
    // contas criadas antes deste recurso já eram funcionais sem verificação — considera todas já verificadas
    // para não bloquear quem já tinha conta. Só cadastros novos a partir daqui passam pelo fluxo de código.
    await db.execute('UPDATE users SET emailVerifiedAt = createdAt');
  }
  if (!userColumns.rows.some(col => col.name === 'role')) {
    await db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    // o primeiro usuário já cadastrado (por ordem de criação) vira administrador nesta migração única;
    // cadastros novos a partir daqui sempre nascem como 'user' (ver usersRepository.create)
    await db.execute(`
      UPDATE users SET role = 'admin' WHERE id = (
        SELECT id FROM users ORDER BY createdAt ASC, rowid ASC LIMIT 1
      )
    `);
  }

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
  if (!columns.rows.some(col => col.name === 'deletedAt')) {
    await db.execute('ALTER TABLE boardgames ADD COLUMN deletedAt TEXT');
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      userId TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      boardgameId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      startedAt TEXT NOT NULL,
      runningSince TEXT,
      elapsedMs INTEGER NOT NULL DEFAULT 0,
      endedAt TEXT,
      winnerParticipantId TEXT,
      isTie INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS match_participants (
      id TEXT PRIMARY KEY,
      matchId TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    )
  `);
}

module.exports = runMigrations;
