const db = require('./db');
const linksRepository = require('./boardgameLinksRepository');

async function readAllByUser(userId, { includeDeleted = false } = {}) {
  const result = await db.execute({
    sql: includeDeleted
      ? 'SELECT * FROM boardgames WHERE userId = ? ORDER BY createdAt ASC'
      : 'SELECT * FROM boardgames WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt ASC',
    args: [userId]
  });
  const games = result.rows;

  const links = await linksRepository.listByBoardgameIds(games.map(g => g.id));
  const linksByGame = new Map();
  for (const link of links) {
    if (!linksByGame.has(link.boardgameId)) linksByGame.set(link.boardgameId, []);
    linksByGame.get(link.boardgameId).push(link);
  }

  return games.map(g => ({ ...g, links: linksByGame.get(g.id) || [] }));
}

async function findByIdForUser(id, userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgames WHERE id = ? AND userId = ? AND deletedAt IS NULL',
    args: [id, userId]
  });
  return result.rows[0] || null;
}

async function create(game) {
  await db.execute({
    sql: `
      INSERT INTO boardgames (id, userId, name, minPlayers, maxPlayers, duration, category, imageUrl, minAge, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
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
    ]
  });
  return game;
}

async function update(id, userId, fields) {
  const result = await db.execute({
    sql: `
      UPDATE boardgames
      SET name = ?, minPlayers = ?, maxPlayers = ?, duration = ?, category = ?, imageUrl = ?, minAge = ?
      WHERE id = ? AND userId = ? AND deletedAt IS NULL
    `,
    args: [
      fields.name,
      fields.minPlayers,
      fields.maxPlayers,
      fields.duration,
      fields.category,
      fields.imageUrl,
      fields.minAge,
      id,
      userId
    ]
  });

  if (result.rowsAffected === 0) return null;

  const updated = await db.execute({ sql: 'SELECT * FROM boardgames WHERE id = ?', args: [id] });
  return updated.rows[0];
}

async function remove(id, userId) {
  const result = await db.execute({
    sql: 'UPDATE boardgames SET deletedAt = ? WHERE id = ? AND userId = ? AND deletedAt IS NULL',
    args: [new Date().toISOString(), id, userId]
  });
  return result.rowsAffected > 0;
}

async function restore(id, userId) {
  const result = await db.execute({
    sql: 'UPDATE boardgames SET deletedAt = NULL WHERE id = ? AND userId = ? AND deletedAt IS NOT NULL',
    args: [id, userId]
  });
  return result.rowsAffected > 0;
}

async function randomOneByUser(userId, filters = {}) {
  const conditions = ['userId = ?', 'deletedAt IS NULL'];
  const args = [userId];

  if (filters.players) {
    conditions.push('(minPlayers IS NULL OR CAST(minPlayers AS INTEGER) <= ?)');
    args.push(Number(filters.players));
    conditions.push('(maxPlayers IS NULL OR CAST(maxPlayers AS INTEGER) >= ?)');
    args.push(Number(filters.players));
  }

  if (filters.minAge) {
    conditions.push('(minAge IS NULL OR CAST(minAge AS INTEGER) <= ?)');
    args.push(Number(filters.minAge));
  }

  if (filters.category) {
    conditions.push('category = ?');
    args.push(filters.category);
  }

  const result = await db.execute({
    sql: `SELECT * FROM boardgames WHERE ${conditions.join(' AND ')} ORDER BY RANDOM() LIMIT 1`,
    args
  });
  const game = result.rows[0];
  if (!game) return null;

  const links = await linksRepository.listByBoardgame(game.id);
  return { ...game, links };
}

async function countByUser() {
  const result = await db.execute('SELECT userId, COUNT(*) as count FROM boardgames WHERE deletedAt IS NULL GROUP BY userId');
  return result.rows;
}

module.exports = { readAllByUser, findByIdForUser, create, update, remove, restore, randomOneByUser, countByUser };
