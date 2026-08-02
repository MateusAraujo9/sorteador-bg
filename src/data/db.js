const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const LOCAL_DB_FILE = path.join(__dirname, '..', '..', 'data', 'boardgames.db');

const url = process.env.TURSO_DATABASE_URL || `file:${LOCAL_DB_FILE}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!process.env.TURSO_DATABASE_URL) {
  fs.mkdirSync(path.dirname(LOCAL_DB_FILE), { recursive: true });
}

const db = createClient(authToken ? { url, authToken } : { url });

module.exports = db;
