const db = require('./db');

async function listByBoardgame(boardgameId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgame_links WHERE boardgameId = ? ORDER BY createdAt ASC',
    args: [boardgameId]
  });
  return result.rows;
}

async function listByBoardgameIds(boardgameIds) {
  if (boardgameIds.length === 0) return [];

  const placeholders = boardgameIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT * FROM boardgame_links WHERE boardgameId IN (${placeholders}) ORDER BY createdAt ASC`,
    args: boardgameIds
  });
  return result.rows;
}

async function create(link) {
  await db.execute({
    sql: `
      INSERT INTO boardgame_links (id, boardgameId, label, url, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [link.id, link.boardgameId, link.label, link.url, link.createdAt]
  });
  return link;
}

async function remove(id, boardgameId) {
  const result = await db.execute({
    sql: 'DELETE FROM boardgame_links WHERE id = ? AND boardgameId = ?',
    args: [id, boardgameId]
  });
  return result.rowsAffected > 0;
}

module.exports = { listByBoardgame, listByBoardgameIds, create, remove };
