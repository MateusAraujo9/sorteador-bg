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

async function update(id, { name, email }) {
  await db.execute({
    sql: 'UPDATE users SET name = ?, email = ? WHERE id = ?',
    args: [name, email, id]
  });
  return findById(id);
}

async function updatePassword(id, passwordHash) {
  await db.execute({
    sql: 'UPDATE users SET passwordHash = ? WHERE id = ?',
    args: [passwordHash, id]
  });
}

module.exports = { create, findByEmail, findById, update, updatePassword };
