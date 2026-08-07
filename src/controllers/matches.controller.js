const crypto = require('crypto');
const repository = require('../data/matchesRepository');
const participantsRepository = require('../data/matchParticipantsRepository');
const boardgamesRepository = require('../data/boardgamesRepository');
const boardgameLinksRepository = require('../data/boardgameLinksRepository');
const asyncHandler = require('../utils/asyncHandler');

async function findActiveInProgress(id, userId) {
  const match = await repository.findByIdForUser(id, userId);
  if (!match || match.status !== 'in_progress') return null;
  return match;
}

// boardgamesRepository.findByIdForUser não anexa `links` (só readAllByUser/randomOneByUser fazem isso) —
// a tela de partida precisa dos documentos do jogo pra mostrar o "manual", então busca à parte aqui.
async function findBoardgameWithLinks(boardgameId, userId) {
  const boardgame = await boardgamesRepository.findByIdForUser(boardgameId, userId);
  if (!boardgame) return null;
  const links = await boardgameLinksRepository.listByBoardgame(boardgame.id);
  return { ...boardgame, links };
}

const getActive = asyncHandler(async function getActive(req, res) {
  const match = await repository.findActiveByUser(req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Nenhuma partida em andamento' });
  }
  const boardgame = await findBoardgameWithLinks(match.boardgameId, req.user.id);
  res.json({ ...match, boardgame });
});

const start = asyncHandler(async function start(req, res) {
  const { boardgameId } = req.body;
  if (!boardgameId) {
    return res.status(400).json({ error: 'Selecione um jogo' });
  }

  const boardgame = await findBoardgameWithLinks(boardgameId, req.user.id);
  if (!boardgame) {
    return res.status(404).json({ error: 'Boardgame não encontrado' });
  }

  const existing = await repository.findActiveByUser(req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'Você já tem uma partida em andamento' });
  }

  const now = new Date().toISOString();
  const match = await repository.create({
    id: crypto.randomUUID(),
    userId: req.user.id,
    boardgameId: boardgame.id,
    startedAt: now,
    runningSince: now,
    createdAt: now
  });

  res.status(201).json({ ...match, boardgame });
});

const addParticipant = asyncHandler(async function addParticipant(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Dê um nome ao participante' });
  }

  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }

  const participant = await participantsRepository.create({
    id: crypto.randomUUID(),
    matchId: match.id,
    name: name.trim(),
    score: 0,
    createdAt: new Date().toISOString()
  });

  res.status(201).json(participant);
});

const removeParticipant = asyncHandler(async function removeParticipant(req, res) {
  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }

  const removed = await participantsRepository.remove(req.params.participantId, match.id);
  if (!removed) {
    return res.status(404).json({ error: 'Participante não encontrado' });
  }

  res.json({ message: 'Participante removido' });
});

const updateParticipantScore = asyncHandler(async function updateParticipantScore(req, res) {
  const { score } = req.body;
  if (!Number.isInteger(score)) {
    return res.status(400).json({ error: 'Placar deve ser um número inteiro' });
  }

  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }

  const updated = await participantsRepository.updateScore(req.params.participantId, match.id, score);
  if (!updated) {
    return res.status(404).json({ error: 'Participante não encontrado' });
  }

  res.json({ message: 'Placar atualizado' });
});

const pause = asyncHandler(async function pause(req, res) {
  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }
  if (!match.runningSince) {
    return res.status(400).json({ error: 'A partida já está pausada' });
  }

  const now = Date.now();
  const elapsedMs = match.elapsedMs + (now - new Date(match.runningSince).getTime());
  await repository.pause(match.id, req.user.id, elapsedMs);

  res.json({ elapsedMs, runningSince: null });
});

const resume = asyncHandler(async function resume(req, res) {
  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }
  if (match.runningSince) {
    return res.status(400).json({ error: 'A partida já está em andamento' });
  }

  const runningSince = new Date().toISOString();
  await repository.resume(match.id, req.user.id, runningSince);

  res.json({ elapsedMs: match.elapsedMs, runningSince });
});

const finish = asyncHandler(async function finish(req, res) {
  const match = await findActiveInProgress(req.params.id, req.user.id);
  if (!match) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }

  const now = Date.now();
  const elapsedMs = match.runningSince
    ? match.elapsedMs + (now - new Date(match.runningSince).getTime())
    : match.elapsedMs;

  let winnerParticipantId = null;
  let isTie = false;
  if (match.participants.length > 0) {
    const maxScore = Math.max(...match.participants.map(p => p.score));
    const topScorers = match.participants.filter(p => p.score === maxScore);
    if (topScorers.length === 1) {
      winnerParticipantId = topScorers[0].id;
    } else {
      isTie = true;
    }
  }

  const finished = await repository.finish(match.id, req.user.id, {
    elapsedMs,
    endedAt: new Date(now).toISOString(),
    winnerParticipantId,
    isTie
  });

  res.json(finished);
});

const cancel = asyncHandler(async function cancel(req, res) {
  const removed = await repository.remove(req.params.id, req.user.id);
  if (!removed) {
    return res.status(404).json({ error: 'Partida não encontrada' });
  }
  res.json({ message: 'Partida cancelada' });
});

module.exports = {
  getActive,
  start,
  addParticipant,
  removeParticipant,
  updateParticipantScore,
  pause,
  resume,
  finish,
  cancel
};
