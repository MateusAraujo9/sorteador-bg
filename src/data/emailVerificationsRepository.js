const crypto = require('crypto');
const db = require('./db');

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

async function create(userId) {
  const now = Date.now();
  const verification = {
    userId,
    code: generateCode(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CODE_TTL_MS).toISOString()
  };

  await db.execute({
    sql: `
      INSERT INTO email_verifications (userId, code, createdAt, expiresAt, attempts)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(userId) DO UPDATE SET
        code = excluded.code,
        createdAt = excluded.createdAt,
        expiresAt = excluded.expiresAt,
        attempts = 0
    `,
    args: [verification.userId, verification.code, verification.createdAt, verification.expiresAt]
  });

  return verification;
}

async function findByUserId(userId) {
  const result = await db.execute({ sql: 'SELECT * FROM email_verifications WHERE userId = ?', args: [userId] });
  const verification = result.rows[0];
  if (!verification) return null;

  if (new Date(verification.expiresAt).getTime() < Date.now()) {
    await remove(userId);
    return null;
  }

  return verification;
}

async function incrementAttempts(userId) {
  await db.execute({ sql: 'UPDATE email_verifications SET attempts = attempts + 1 WHERE userId = ?', args: [userId] });
}

async function remove(userId) {
  await db.execute({ sql: 'DELETE FROM email_verifications WHERE userId = ?', args: [userId] });
}

module.exports = { create, findByUserId, incrementAttempts, remove, MAX_ATTEMPTS };
