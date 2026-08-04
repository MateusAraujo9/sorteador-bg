const crypto = require('crypto');
const db = require('./db');

async function create({ name, email, passwordHash }) {
  // a primeira conta cadastrada num banco novo vira admin — cobre o caso de instalação do zero,
  // já que a migração de backfill em migrate.js só alcança contas que já existiam quando ela rodou
  const { rows } = await db.execute('SELECT COUNT(*) as count FROM users');
  const role = rows[0].count === 0 ? 'admin' : 'user';

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  await db.execute({
    sql: `
      INSERT INTO users (id, name, email, passwordHash, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt]
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

async function listAll() {
  const result = await db.execute('SELECT * FROM users ORDER BY createdAt ASC');
  return result.rows;
}

async function updateRole(id, role) {
  await db.execute({
    sql: 'UPDATE users SET role = ? WHERE id = ?',
    args: [role, id]
  });
  return findById(id);
}

module.exports = { create, findByEmail, findById, updateName, updatePassword, markVerified, listAll, updateRole };
