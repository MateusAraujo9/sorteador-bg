const usersRepository = require('../data/usersRepository');
const sessionsRepository = require('../data/sessionsRepository');
const { hashPassword, verifyPassword } = require('../utils/password');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE = 'sid';

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function setSessionCookie(res, session) {
  res.cookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(session.expiresAt),
    path: '/'
  });
}

function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (usersRepository.findByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail' });
  }

  const user = usersRepository.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password)
  });

  const session = sessionsRepository.create(user.id);
  setSessionCookie(res, session);
  res.status(201).json(toPublicUser(user));
}

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  const user = usersRepository.findByEmail(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  }

  const session = sessionsRepository.create(user.id);
  setSessionCookie(res, session);
  res.json(toPublicUser(user));
}

function logout(req, res) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) sessionsRepository.remove(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ message: 'Sessão encerrada' });
}

function me(req, res) {
  res.json(toPublicUser(req.user));
}

function updateProfile(req, res) {
  const { name, email, currentPassword, newPassword } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }
  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = usersRepository.findByEmail(normalizedEmail);
  if (existing && existing.id !== req.user.id) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail' });
  }

  if (newPassword) {
    if (!currentPassword || !verifyPassword(currentPassword, req.user.passwordHash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }
    usersRepository.updatePassword(req.user.id, hashPassword(newPassword));
  }

  const updated = usersRepository.update(req.user.id, { name: name.trim(), email: normalizedEmail });
  res.json(toPublicUser(updated));
}

module.exports = { register, login, logout, me, updateProfile };
