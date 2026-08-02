const crypto = require('crypto');
const db = require('./db');

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

async function create(userId) {
  const now = Date.now();
  const reset = {
    token: crypto.randomBytes(32).toString('hex'),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESET_TTL_MS).toISOString()
  };

  await db.execute({
    sql: `
      INSERT INTO password_resets (token, userId, createdAt, expiresAt)
      VALUES (?, ?, ?, ?)
    `,
    args: [reset.token, reset.userId, reset.createdAt, reset.expiresAt]
  });

  return reset;
}

async function findValid(token) {
  const result = await db.execute({ sql: 'SELECT * FROM password_resets WHERE token = ?', args: [token] });
  const reset = result.rows[0];
  if (!reset) return null;

  if (new Date(reset.expiresAt).getTime() < Date.now()) {
    await remove(token);
    return null;
  }

  return reset;
}

async function remove(token) {
  await db.execute({ sql: 'DELETE FROM password_resets WHERE token = ?', args: [token] });
}

module.exports = { create, findValid, remove };
