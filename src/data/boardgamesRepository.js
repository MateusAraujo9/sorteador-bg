const db = require('./db');

async function readAllByUser(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgames WHERE userId = ? ORDER BY createdAt ASC',
    args: [userId]
  });
  return result.rows;
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
  return result.rowsAffected > 0;
}

async function randomOneByUser(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM boardgames WHERE userId = ? ORDER BY RANDOM() LIMIT 1',
    args: [userId]
  });
  return result.rows[0] || null;
}

module.exports = { readAllByUser, create, update, remove, randomOneByUser };
