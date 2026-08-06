const db = require('./db');
const participantsRepository = require('./matchParticipantsRepository');

async function attachParticipants(matches) {
  const participants = await participantsRepository.listByMatchIds(matches.map(m => m.id));
  const byMatch = new Map();
  for (const participant of participants) {
    if (!byMatch.has(participant.matchId)) byMatch.set(participant.matchId, []);
    byMatch.get(participant.matchId).push(participant);
  }
  return matches.map(m => ({ ...m, participants: byMatch.get(m.id) || [] }));
}

async function findActiveByUser(userId) {
  const result = await db.execute({
    sql: "SELECT * FROM matches WHERE userId = ? AND status = 'in_progress' LIMIT 1",
    args: [userId]
  });
  if (result.rows.length === 0) return null;
  const [match] = await attachParticipants(result.rows);
  return match;
}

async function findByIdForUser(id, userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM matches WHERE id = ? AND userId = ?',
    args: [id, userId]
  });
  if (result.rows.length === 0) return null;
  const [match] = await attachParticipants(result.rows);
  return match;
}

async function create(match) {
  await db.execute({
    sql: `
      INSERT INTO matches (id, userId, boardgameId, status, startedAt, runningSince, elapsedMs, createdAt)
      VALUES (?, ?, ?, 'in_progress', ?, ?, 0, ?)
    `,
    args: [match.id, match.userId, match.boardgameId, match.startedAt, match.runningSince, match.createdAt]
  });
  return { ...match, status: 'in_progress', elapsedMs: 0, participants: [] };
}

async function pause(id, userId, elapsedMs) {
  const result = await db.execute({
    sql: `
      UPDATE matches SET elapsedMs = ?, runningSince = NULL
      WHERE id = ? AND userId = ? AND status = 'in_progress' AND runningSince IS NOT NULL
    `,
    args: [elapsedMs, id, userId]
  });
  return result.rowsAffected > 0;
}

async function resume(id, userId, runningSince) {
  const result = await db.execute({
    sql: `
      UPDATE matches SET runningSince = ?
      WHERE id = ? AND userId = ? AND status = 'in_progress' AND runningSince IS NULL
    `,
    args: [runningSince, id, userId]
  });
  return result.rowsAffected > 0;
}

async function finish(id, userId, { elapsedMs, endedAt, winnerParticipantId, isTie }) {
  await db.execute({
    sql: `
      UPDATE matches
      SET status = 'finished', runningSince = NULL, elapsedMs = ?, endedAt = ?, winnerParticipantId = ?, isTie = ?
      WHERE id = ? AND userId = ? AND status = 'in_progress'
    `,
    args: [elapsedMs, endedAt, winnerParticipantId, isTie ? 1 : 0, id, userId]
  });
  return findByIdForUser(id, userId);
}

async function remove(id, userId) {
  const result = await db.execute({
    sql: "DELETE FROM matches WHERE id = ? AND userId = ? AND status = 'in_progress'",
    args: [id, userId]
  });
  if (result.rowsAffected > 0) {
    await db.execute({ sql: 'DELETE FROM match_participants WHERE matchId = ?', args: [id] });
  }
  return result.rowsAffected > 0;
}

module.exports = { findActiveByUser, findByIdForUser, create, pause, resume, finish, remove };
