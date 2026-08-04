const usersRepository = require('../data/usersRepository');
const boardgamesRepository = require('../data/boardgamesRepository');
const asyncHandler = require('../utils/asyncHandler');

const VALID_ROLES = ['user', 'admin'];

function toAdminUser(user, gameCount) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    gameCount
  };
}

const listUsers = asyncHandler(async function listUsers(req, res) {
  const [users, counts] = await Promise.all([
    usersRepository.listAll(),
    boardgamesRepository.countByUser()
  ]);

  const countByUserId = new Map(counts.map(c => [c.userId, c.count]));
  res.json(users.map(u => toAdminUser(u, countByUserId.get(u.id) || 0)));
});

const updateUserRole = asyncHandler(async function updateUserRole(req, res) {
  const { role } = req.body;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Perfil inválido' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode alterar seu próprio perfil' });
  }

  const target = await usersRepository.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const updated = await usersRepository.updateRole(req.params.id, role);
  res.json(toAdminUser(updated, null));
});

module.exports = { listUsers, updateUserRole };
