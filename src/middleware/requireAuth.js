const sessionsRepository = require('../data/sessionsRepository');
const usersRepository = require('../data/usersRepository');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.sid;
  const session = token ? await sessionsRepository.findValid(token) : null;

  if (!session) {
    return res.status(401).json({ error: 'Você precisa entrar para continuar.' });
  }

  const user = await usersRepository.findById(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Você precisa entrar para continuar.' });
  }

  req.user = user;
  next();
});

module.exports = requireAuth;
