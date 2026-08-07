const db = require('./db');

async function listByMatch(matchId) {
  const result = await db.execute({
    sql: 'SELECT * FROM match_participants WHERE matchId = ? ORDER BY createdAt ASC',
    args: [matchId]
  });
  return result.rows;
}

async function listByMatchIds(matchIds) {
  if (matchIds.length === 0) return [];

  const placeholders = matchIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT * FROM match_participants WHERE matchId IN (${placeholders}) ORDER BY createdAt ASC`,
    args: matchIds
  });
  return result.rows;
}

async function create(participant) {
  await db.execute({
    sql: `
      INSERT INTO match_participants (id, matchId, name, score, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [participant.id, participant.matchId, participant.name, participant.score, participant.createdAt]
  });
  return participant;
}

async function updateScore(id, matchId, score) {
  const result = await db.execute({
    sql: 'UPDATE match_participants SET score = ? WHERE id = ? AND matchId = ?',
    args: [score, id, matchId]
  });
  return result.rowsAffected > 0;
}

async function remove(id, matchId) {
  const result = await db.execute({
    sql: 'DELETE FROM match_participants WHERE id = ? AND matchId = ?',
    args: [id, matchId]
  });
  return result.rowsAffected > 0;
}

module.exports = { listByMatch, listByMatchIds, create, updateScore, remove };
