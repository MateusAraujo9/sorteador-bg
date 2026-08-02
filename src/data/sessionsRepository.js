const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

async function create(userId) {
  const now = Date.now();
  const session = {
    token: crypto.randomBytes(32).toString('hex'),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };

  await db.execute({
    sql: `
      INSERT INTO sessions (token, userId, createdAt, expiresAt)
      VALUES (?, ?, ?, ?)
    `,
    args: [session.token, session.userId, session.createdAt, session.expiresAt]
  });

  return session;
}

async function findValid(token) {
  const result = await db.execute({ sql: 'SELECT * FROM sessions WHERE token = ?', args: [token] });
  const session = result.rows[0];
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await remove(token);
    return null;
  }

  return session;
}

async function remove(token) {
  await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
}

module.exports = { create, findValid, remove, SESSION_TTL_MS };
