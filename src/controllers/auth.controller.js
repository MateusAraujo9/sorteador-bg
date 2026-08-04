const usersRepository = require('../data/usersRepository');
const sessionsRepository = require('../data/sessionsRepository');
const passwordResetsRepository = require('../data/passwordResetsRepository');
const emailVerificationsRepository = require('../data/emailVerificationsRepository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE = 'sid';

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function setSessionCookie(req, res, session) {
  res.cookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    expires: new Date(session.expiresAt),
    path: '/'
  });
}

const register = asyncHandler(async function register(req, res) {
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
  const existing = await usersRepository.findByEmail(normalizedEmail);

  let user;
  if (existing) {
    if (existing.emailVerifiedAt) {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail' });
    }
    // conta criada mas nunca verificada: reaproveita a linha (nome/senha podem ter mudado) e reenvia o código
    await usersRepository.updateName(existing.id, name.trim());
    await usersRepository.updatePassword(existing.id, hashPassword(password));
    user = existing;
  } else {
    user = await usersRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password)
    });
  }

  const verification = await emailVerificationsRepository.create(user.id);
  await sendVerificationEmail(user.email, verification.code);

  res.status(201).json({ email: user.email, message: 'Enviamos um código de verificação para o seu e-mail.' });
});

const login = asyncHandler(async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  const user = await usersRepository.findByEmail(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  }

  if (!user.emailVerifiedAt) {
    return res.status(403).json({
      error: 'Confirme seu e-mail para continuar.',
      needsVerification: true,
      email: user.email
    });
  }

  const session = await sessionsRepository.create(user.id);
  setSessionCookie(req, res, session);
  res.json(toPublicUser(user));
});

const logout = asyncHandler(async function logout(req, res) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) await sessionsRepository.remove(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ message: 'Sessão encerrada' });
});

function me(req, res) {
  res.json(toPublicUser(req.user));
}

const updateProfile = asyncHandler(async function updateProfile(req, res) {
  const { name, currentPassword, newPassword } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome é obrigatório' });
  }

  if (newPassword) {
    if (!currentPassword || !verifyPassword(currentPassword, req.user.passwordHash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }
    await usersRepository.updatePassword(req.user.id, hashPassword(newPassword));
  }

  const updated = await usersRepository.updateName(req.user.id, name.trim());
  res.json(toPublicUser(updated));
});

const verifyEmail = asyncHandler(async function verifyEmail(req, res) {
  const { email, code } = req.body;

  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }
  if (!code || !/^\d{4}$/.test(code.trim())) {
    return res.status(400).json({ error: 'Informe o código de 4 dígitos' });
  }

  const user = await usersRepository.findByEmail(email.trim().toLowerCase());
  if (!user || user.emailVerifiedAt) {
    return res.status(400).json({ error: 'Código inválido ou expirado' });
  }

  const verification = await emailVerificationsRepository.findByUserId(user.id);
  if (!verification) {
    return res.status(400).json({ error: 'Código inválido ou expirado' });
  }

  if (verification.attempts >= emailVerificationsRepository.MAX_ATTEMPTS) {
    await emailVerificationsRepository.remove(user.id);
    return res.status(400).json({ error: 'Muitas tentativas. Solicite um novo código.' });
  }

  if (verification.code !== code.trim()) {
    await emailVerificationsRepository.incrementAttempts(user.id);
    return res.status(400).json({ error: 'Código incorreto' });
  }

  const verifiedUser = await usersRepository.markVerified(user.id);
  await emailVerificationsRepository.remove(user.id);

  const session = await sessionsRepository.create(verifiedUser.id);
  setSessionCookie(req, res, session);
  res.json(toPublicUser(verifiedUser));
});

const GENERIC_RESEND_MESSAGE = 'Se essa conta existir e ainda não tiver sido verificada, reenviamos o código.';

const resendVerification = asyncHandler(async function resendVerification(req, res) {
  const { email } = req.body;

  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  const user = await usersRepository.findByEmail(email.trim().toLowerCase());

  if (user && !user.emailVerifiedAt) {
    const verification = await emailVerificationsRepository.create(user.id);
    await sendVerificationEmail(user.email, verification.code);
  }

  // Mesma resposta em qualquer caso, para não revelar se o e-mail está cadastrado ou já verificado.
  res.json({ message: GENERIC_RESEND_MESSAGE });
});

const GENERIC_FORGOT_MESSAGE = 'Se esse e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.';

const forgotPassword = asyncHandler(async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido' });
  }

  const user = await usersRepository.findByEmail(email.trim().toLowerCase());

  if (user) {
    const reset = await passwordResetsRepository.create(user.id);
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${reset.token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  res.json({ message: GENERIC_FORGOT_MESSAGE });
});

const resetPassword = asyncHandler(async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Link inválido ou expirado' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  }

  const reset = await passwordResetsRepository.findValid(token);
  if (!reset) {
    return res.status(400).json({ error: 'Link inválido ou expirado' });
  }

  await usersRepository.updatePassword(reset.userId, hashPassword(newPassword));
  await passwordResetsRepository.remove(token);
  await sessionsRepository.removeAllForUser(reset.userId);

  res.json({ message: 'Senha redefinida com sucesso' });
});

module.exports = {
  register,
  login,
  logout,
  me,
  updateProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
};
