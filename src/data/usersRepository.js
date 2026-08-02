const crypto = require('crypto');
const db = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

function create({ name, email, passwordHash }) {
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, user.name, user.email, user.passwordHash, user.createdAt);

  return user;
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

function update(id, { name, email }) {
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, id);
  return findById(id);
}

function updatePassword(id, passwordHash) {
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, id);
}

module.exports = { create, findByEmail, findById, update, updatePassword };
