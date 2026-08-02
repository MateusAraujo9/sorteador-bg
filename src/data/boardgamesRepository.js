const db = require('./db');
const linksRepository = require('./boardgameLinksRepository');

async function readAllByUser(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgames WHERE userId = ? ORDER BY createdAt ASC',
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
    sql: 'SELECT * FROM boardgames WHERE id = ? AND userId = ?',
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
      WHERE id = ? AND userId = ?
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
    sql: 'DELETE FROM boardgames WHERE id = ? AND userId = ?',
    args: [id, userId]
  });
  if (result.rowsAffected === 0) return false;

  await db.execute({ sql: 'DELETE FROM boardgame_links WHERE boardgameId = ?', args: [id] });
  return true;
}

async function randomOneByUser(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgames WHERE userId = ? ORDER BY RANDOM() LIMIT 1',
    args: [userId]
  });
  const game = result.rows[0];
  if (!game) return null;

  const links = await linksRepository.listByBoardgame(game.id);
  return { ...game, links };
}

module.exports = { readAllByUser, findByIdForUser, create, update, remove, randomOneByUser };
