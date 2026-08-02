import { api } from './api.js';
import { showToast } from './toast.js';
import { renderGameList, renderStats, renderTicket } from './render.js';
import { rollDie } from './dice.js';

let currentUser = null;
let editingGameId = null;

function handleAuthError(err) {
  if (err && err.status === 401) {
    currentUser = null;
    showAuthView();
    switchAuthMode('login');
    showToast('Sua sessão expirou. Entre novamente.', 'error');
    return true;
  }
  return false;
}

function showAuthView() {
  document.getElementById('appView').hidden = true;
  document.getElementById('authView').hidden = false;
  document.getElementById('userBadge').hidden = true;
}

function showAppView(user) {
  currentUser = user;
  document.getElementById('authView').hidden = true;
  document.getElementById('appView').hidden = false;
  document.getElementById('userBadge').hidden = false;
  document.getElementById('userBadgeName').textContent = user.name;
  fillProfileForm(user);
  switchTab('register');
}

function fillProfileForm(user) {
  const form = document.getElementById('profileForm');
  form.name.value = user.name;
  form.email.value = user.email;
  form.currentPassword.value = '';
  form.newPassword.value = '';
  form.confirmPassword.value = '';
}

function switchAuthMode(mode) {
  document.querySelectorAll('.auth-toggle__btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.authMode === mode);
  });
  document.getElementById('loginForm').classList.toggle('is-active', mode === 'login');
  document.getElementById('signupForm').classList.toggle('is-active', mode === 'register');
  document.getElementById('forgotForm').classList.toggle('is-active', mode === 'forgot');
}

function switchTab(tab) {
  if (tab !== 'register' && editingGameId) exitEditMode();

  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('is-active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('is-active'));

  document.getElementById(`tab-${tab}`).classList.add('is-active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('is-active');

  if (tab === 'list') loadGames();
  if (tab === 'profile' && currentUser) fillProfileForm(currentUser);
}

function enterEditMode(game) {
  editingGameId = game.id;

  const form = document.getElementById('registerForm');
  form.name.value = game.name || '';
  form.minPlayers.value = game.minPlayers || '';
  form.maxPlayers.value = game.maxPlayers || '';
  form.duration.value = game.duration || '';
  form.category.value = game.category || '';
  form.imageUrl.value = game.imageUrl || '';
  form.minAge.value = game.minAge || '';

  document.getElementById('registerPanelTitle').textContent = 'Editar boardgame';
  document.getElementById('registerSubmitBtn').textContent = 'Salvar alterações';
  document.getElementById('cancelEditBtn').hidden = false;

  switchTab('register');
}

function exitEditMode() {
  editingGameId = null;
  document.getElementById('registerPanelTitle').textContent = 'Cadastrar boardgame';
  document.getElementById('registerSubmitBtn').textContent = 'Cadastrar boardgame';
  document.getElementById('cancelEditBtn').hidden = true;
  document.getElementById('registerForm').reset();
}

function computeStats(games) {
  const total = games.length;
  const categories = new Set(games.map(g => g.category).filter(Boolean)).size;
  const durations = games.map(g => Number(g.duration)).filter(d => d > 0);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  return { total, categories, avgDuration };
}

async function loadGames() {
  const listEl = document.getElementById('boardgamesList');
  try {
    const games = await api.list();
    renderGameList(listEl, games, handleDelete, enterEditMode);
    renderStats(computeStats(games));
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível carregar sua coleção.', 'error');
  }
}

async function handleDelete(id, name) {
  if (!confirm(`Remover "${name}" da sua coleção?`)) return;

  try {
    await api.remove(id);
    showToast(`"${name}" foi removido.`, 'success');
    loadGames();
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível remover o jogo. Tente novamente.', 'error');
  }
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const payload = {
    name: form.name.value.trim(),
    minPlayers: form.minPlayers.value || null,
    maxPlayers: form.maxPlayers.value || null,
    duration: form.duration.value || null,
    category: form.category.value.trim() || null,
    imageUrl: form.imageUrl.value.trim() || null,
    minAge: form.minAge.value || null
  };

  if (!payload.name) {
    showToast('Dê um nome ao jogo antes de cadastrar.', 'error');
    return;
  }

  const isEditing = Boolean(editingGameId);
  const request = isEditing ? api.update(editingGameId, payload) : api.create(payload);

  request
    .then(() => {
      showToast(
        isEditing ? `"${payload.name}" foi atualizado.` : `"${payload.name}" entrou na coleção.`,
        'success'
      );
      exitEditMode();
    })
    .catch(err => {
      if (!handleAuthError(err)) {
        showToast(err.message || 'Não foi possível salvar o jogo.', 'error');
      }
    });
}

async function handleDraw() {
  const stage = document.getElementById('drawStage');
  const trigger = document.getElementById('drawTrigger');
  const dieFace = document.getElementById('dieFace');
  const ticket = document.getElementById('resultTicket');

  trigger.disabled = true;
  trigger.textContent = 'Rolando...';

  const [result] = await Promise.all([
    api.drawRandom().catch(err => ({ __error: err })),
    rollDie(dieFace)
  ]);

  trigger.disabled = false;

  if (result && result.__error) {
    trigger.textContent = 'Rolar os dados';
    const err = result.__error;
    if (!handleAuthError(err)) {
      showToast(
        err.message === 'Nenhum boardgame cadastrado para sortear'
          ? 'Cadastre ao menos um jogo antes de rolar os dados.'
          : err.message,
        'error'
      );
    }
    return;
  }

  trigger.textContent = 'Rolar novamente';
  renderTicket(ticket, result);
  stage.classList.add('has-result');
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;

  try {
    const user = await api.auth.login({
      email: form.email.value.trim(),
      password: form.password.value
    });
    form.reset();
    showToast(`Bem-vindo, ${user.name}!`, 'success');
    showAppView(user);
  } catch (err) {
    showToast(err.message || 'Não foi possível entrar.', 'error');
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;

  try {
    const user = await api.auth.register({
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value
    });
    form.reset();
    showToast(`Conta criada! Bem-vindo, ${user.name}.`, 'success');
    showAppView(user);
  } catch (err) {
    showToast(err.message || 'Não foi possível criar a conta.', 'error');
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const form = event.target;

  try {
    const { message } = await api.auth.forgotPassword({ email: form.email.value.trim() });
    showToast(message, 'success');
    form.reset();
    switchAuthMode('login');
  } catch (err) {
    showToast(err.message || 'Não foi possível enviar o e-mail.', 'error');
  }
}

async function handleLogout() {
  try {
    await api.auth.logout();
  } catch {
    // encerra a sessão local mesmo se a chamada falhar
  }
  currentUser = null;
  showToast('Você saiu da sua conta.', 'info');
  switchAuthMode('login');
  showAuthView();
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.target;

  const newPassword = form.newPassword.value;
  const confirmPassword = form.confirmPassword.value;

  if (newPassword && newPassword !== confirmPassword) {
    showToast('A confirmação de senha não confere.', 'error');
    return;
  }

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim()
  };

  if (newPassword) {
    payload.currentPassword = form.currentPassword.value;
    payload.newPassword = newPassword;
  }

  try {
    const user = await api.auth.updateProfile(payload);
    currentUser = user;
    document.getElementById('userBadgeName').textContent = user.name;
    fillProfileForm(user);
    showToast('Perfil atualizado com sucesso.', 'success');
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível atualizar o perfil.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('.auth-toggle__btn').forEach(btn => {
    btn.addEventListener('click', () => switchAuthMode(btn.dataset.authMode));
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('signupForm').addEventListener('submit', handleSignup);
  document.getElementById('forgotForm').addEventListener('submit', handleForgotPassword);
  document.getElementById('forgotPasswordLink').addEventListener('click', () => switchAuthMode('forgot'));
  document.getElementById('backToLoginLink').addEventListener('click', () => switchAuthMode('login'));
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('cancelEditBtn').addEventListener('click', exitEditMode);
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
  document.getElementById('drawTrigger').addEventListener('click', handleDraw);

  try {
    const user = await api.auth.me();
    showAppView(user);
  } catch {
    showAuthView();
  }
});
