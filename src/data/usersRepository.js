const crypto = require('crypto');
const db = require('./db');

async function create({ name, email, passwordHash }) {
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  await db.execute({
    sql: `
      INSERT INTO users (id, name, email, passwordHash, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [user.id, user.name, user.email, user.passwordHash, user.createdAt]
  });

  return user;
}

async function findByEmail(email) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

async function updateName(id, name) {
  await db.execute({
    sql: 'UPDATE users SET name = ? WHERE id = ?',
    args: [name, id]
  });
  return findById(id);
}

async function updatePassword(id, passwordHash) {
  await db.execute({
    sql: 'UPDATE users SET passwordHash = ? WHERE id = ?',
    args: [passwordHash, id]
  });
}

async function markVerified(id) {
  await db.execute({
    sql: 'UPDATE users SET emailVerifiedAt = ? WHERE id = ?',
    args: [new Date().toISOString(), id]
  });
  return findById(id);
}

module.exports = { create, findByEmail, findById, updateName, updatePassword, markVerified };
