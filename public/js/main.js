import { api } from './api.js';
import { showToast } from './toast.js';
import { renderGameList, renderStats, renderTicket, renderLinksList, escapeHtml } from './render.js';
import { rollDie } from './dice.js';
import { confirmDialog } from './confirmDialog.js';

let currentUser = null;
let editingGameId = null;
let currentLinks = [];
let originalLinkIds = [];
let allGames = [];

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
  if (tab === 'draw') populateCategoryFilter();
  if (tab === 'profile' && currentUser) fillProfileForm(currentUser);
}

function categoryOptionsHtml(games, selectedValue) {
  const categories = [...new Set(games.map(g => g.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return `<option value="">Todas</option>${
    categories.map(c => `<option value="${escapeHtml(c)}"${c === selectedValue ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')
  }`;
}

async function populateCategoryFilter() {
  const select = document.getElementById('filterCategory');
  const previousValue = select.value;

  try {
    const games = await api.list();
    select.innerHTML = categoryOptionsHtml(games, previousValue);
  } catch (err) {
    handleAuthError(err);
  }
}

function populateListCategoryFilter() {
  const select = document.getElementById('filterListCategory');
  select.innerHTML = categoryOptionsHtml(allGames, select.value);
}

function gameMatchesFilters(game, filters) {
  if (filters.name) {
    if (!game.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  }
  if (filters.players) {
    const players = Number(filters.players);
    if (game.minPlayers && Number(game.minPlayers) > players) return false;
    if (game.maxPlayers && Number(game.maxPlayers) < players) return false;
  }
  if (filters.minAge) {
    if (game.minAge && Number(game.minAge) > Number(filters.minAge)) return false;
  }
  if (filters.category) {
    if (game.category !== filters.category) return false;
  }
  return true;
}

function applyListFilters() {
  const filters = {
    name: document.getElementById('filterListName').value.trim(),
    players: document.getElementById('filterListPlayers').value,
    minAge: document.getElementById('filterListAge').value,
    category: document.getElementById('filterListCategory').value
  };

  const filtered = allGames.filter(g => gameMatchesFilters(g, filters));
  renderGameList(document.getElementById('boardgamesList'), filtered, handleDelete, enterEditMode);
  renderStats(computeStats(filtered));
}

function clearListFilters() {
  document.getElementById('filterListName').value = '';
  document.getElementById('filterListPlayers').value = '';
  document.getElementById('filterListAge').value = '';
  document.getElementById('filterListCategory').value = '';
  applyListFilters();
}

function clearDrawFilters() {
  document.getElementById('filterPlayers').value = '';
  document.getElementById('filterAge').value = '';
  document.getElementById('filterCategory').value = '';
}

function renderCurrentLinks() {
  renderLinksList(document.getElementById('linksList'), currentLinks, handleRemoveLink);
}

function handleAddLink() {
  const labelInput = document.getElementById('linkLabelInput');
  const urlInput = document.getElementById('linkUrlInput');
  const label = labelInput.value.trim();
  const url = urlInput.value.trim();

  if (!label) {
    showToast('Dê um nome para o documento.', 'error');
    return;
  }
  if (!/^https?:\/\/.+/i.test(url)) {
    showToast('Informe um link válido (começando com http:// ou https://).', 'error');
    return;
  }

  currentLinks.push({ key: crypto.randomUUID(), id: null, label, url });
  labelInput.value = '';
  urlInput.value = '';
  labelInput.focus();
  renderCurrentLinks();
}

function handleRemoveLink(key) {
  currentLinks = currentLinks.filter(l => l.key !== key);
  renderCurrentLinks();
}

async function reconcileLinks(gameId) {
  const toCreate = currentLinks.filter(l => !l.id);
  const keptIds = currentLinks.filter(l => l.id).map(l => l.id);
  const toDelete = originalLinkIds.filter(id => !keptIds.includes(id));

  await Promise.all([
    ...toCreate.map(l => api.createLink(gameId, { label: l.label, url: l.url })),
    ...toDelete.map(id => api.removeLink(gameId, id))
  ]);
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

  currentLinks = (game.links || []).map(l => ({ key: l.id, id: l.id, label: l.label, url: l.url }));
  originalLinkIds = currentLinks.map(l => l.id);
  renderCurrentLinks();

  document.getElementById('registerPanelTitle').textContent = 'Editar boardgame';
  document.getElementById('registerSubmitBtn').textContent = 'Salvar alterações';
  document.getElementById('cancelEditBtn').hidden = false;

  switchTab('register');
}

function exitEditMode() {
  editingGameId = null;
  currentLinks = [];
  originalLinkIds = [];
  renderCurrentLinks();
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
  try {
    allGames = await api.list();
    populateListCategoryFilter();
    applyListFilters();
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível carregar sua coleção.', 'error');
  }
}

async function handleDelete(id, name) {
  const confirmed = await confirmDialog({
    title: 'Remover jogo',
    message: `Remover "${name}" da sua coleção?`,
    confirmLabel: 'Remover',
    cancelLabel: 'Cancelar'
  });
  if (!confirmed) return;

  try {
    await api.remove(id);
    showToast(`"${name}" foi removido.`, 'success');
    loadGames();
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível remover o jogo. Tente novamente.', 'error');
  }
}

async function handleRegisterSubmit(event) {
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

  try {
    const game = isEditing ? await api.update(editingGameId, payload) : await api.create(payload);
    await reconcileLinks(game.id);
    showToast(
      isEditing ? `"${payload.name}" foi atualizado.` : `"${payload.name}" entrou na coleção.`,
      'success'
    );
    exitEditMode();
  } catch (err) {
    if (!handleAuthError(err)) {
      showToast(err.message || 'Não foi possível salvar o jogo.', 'error');
    }
  }
}

async function handleDraw() {
  const stage = document.getElementById('drawStage');
  const trigger = document.getElementById('drawTrigger');
  const dieFace = document.getElementById('dieFace');
  const ticket = document.getElementById('resultTicket');

  const filters = {
    players: document.getElementById('filterPlayers').value || null,
    minAge: document.getElementById('filterAge').value || null,
    category: document.getElementById('filterCategory').value || null
  };

  trigger.disabled = true;
  trigger.textContent = 'Rolando...';

  const [result] = await Promise.all([
    api.drawRandom(filters).catch(err => ({ __error: err })),
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
    name: form.name.value.trim()
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
  document.getElementById('addLinkBtn').addEventListener('click', handleAddLink);
  ['linkLabelInput', 'linkUrlInput'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddLink();
      }
    });
  });
  renderCurrentLinks();
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
  document.getElementById('drawTrigger').addEventListener('click', handleDraw);

  ['filterListName', 'filterListPlayers', 'filterListAge'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyListFilters);
  });
  document.getElementById('filterListCategory').addEventListener('change', applyListFilters);
  document.getElementById('clearListFiltersBtn').addEventListener('click', clearListFilters);
  document.getElementById('clearDrawFiltersBtn').addEventListener('click', clearDrawFilters);

  try {
    const user = await api.auth.me();
    showAppView(user);
  } catch {
    showAuthView();
  }
});
