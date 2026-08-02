const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  )
`);

function create(userId) {
  const now = Date.now();
  const session = {
    token: crypto.randomBytes(32).toString('hex'),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };

  db.prepare(`
    INSERT INTO sessions (token, userId, createdAt, expiresAt)
    VALUES (?, ?, ?, ?)
  `).run(session.token, session.userId, session.createdAt, session.expiresAt);

  return session;
}

function findValid(token) {
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    remove(token);
    return null;
  }

  return session;
}

function remove(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

module.exports = { create, findValid, remove, SESSION_TTL_MS };
