import { api } from './api.js';
import { showToast } from './toast.js';
import {
  renderGameList, renderStats, renderTicket, renderLinksList, renderAdminUsers, renderBggResults, escapeHtml,
  renderParticipantList, renderMatchHeader, renderMatchResult, formatElapsed
} from './render.js';
import { rollDie } from './dice.js';
import { confirmDialog } from './confirmDialog.js';
import { icons } from './icons.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

let currentUser = null;
let editingGameId = null;
let currentLinks = [];
let originalLinkIds = [];
let allGames = [];
let pendingVerificationEmail = null;
let verifySource = null;
let activeMatch = null;
let matchTickInterval = null;

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
  document.getElementById('adminTabBtn').hidden = user.role !== 'admin';
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
  document.getElementById('authToggle').classList.toggle('is-hidden', mode === 'verify');
  document.getElementById('loginForm').classList.toggle('is-active', mode === 'login');
  document.getElementById('signupForm').classList.toggle('is-active', mode === 'register');
  document.getElementById('forgotForm').classList.toggle('is-active', mode === 'forgot');
  document.getElementById('verifyForm').classList.toggle('is-active', mode === 'verify');
}

function enterVerifyMode(email, source) {
  pendingVerificationEmail = email;
  verifySource = source;
  document.getElementById('verifyEmailLabel').textContent = email;
  document.getElementById('verifyCode').value = '';
  switchAuthMode('verify');
}

function switchTab(tab) {
  if (tab !== 'register' && editingGameId) exitEditMode();

  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('is-active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('is-active'));

  document.getElementById(`tab-${tab}`).classList.add('is-active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('is-active');

  if (tab === 'list') loadGames();
  if (tab === 'draw') {
    populateCategoryFilter();
    loadActiveMatch();
  }
  if (tab === 'profile' && currentUser) fillProfileForm(currentUser);
  if (tab === 'admin') loadAdminUsers();
}

async function loadAdminUsers() {
  try {
    const users = await api.admin.listUsers();
    renderAdminUsers(document.getElementById('adminUsersList'), users, currentUser.id, handleChangeUserRole);
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível carregar os usuários.', 'error');
  }
}

async function handleChangeUserRole(userId, role) {
  try {
    await api.admin.updateUserRole(userId, role);
    showToast('Perfil atualizado.', 'success');
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível atualizar o perfil.', 'error');
  }
  loadAdminUsers();
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
  const showDeleted = document.getElementById('filterListShowDeleted').checked;
  const games = showDeleted ? allGames : allGames.filter(g => !g.deletedAt);
  select.innerHTML = categoryOptionsHtml(games, select.value);
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
  if (!filters.showDeleted && game.deletedAt) return false;
  return true;
}

function applyListFilters() {
  const filters = {
    name: document.getElementById('filterListName').value.trim(),
    players: document.getElementById('filterListPlayers').value,
    minAge: document.getElementById('filterListAge').value,
    category: document.getElementById('filterListCategory').value,
    showDeleted: document.getElementById('filterListShowDeleted').checked
  };

  const filtered = allGames.filter(g => gameMatchesFilters(g, filters));
  renderGameList(document.getElementById('boardgamesList'), filtered, handleDelete, enterEditMode, handleRestore);
  renderStats(computeStats(filtered));
}

function clearListFilters() {
  document.getElementById('filterListName').value = '';
  document.getElementById('filterListPlayers').value = '';
  document.getElementById('filterListAge').value = '';
  document.getElementById('filterListCategory').value = '';
  document.getElementById('filterListShowDeleted').checked = false;
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

function updateImagePreview(url) {
  const preview = document.getElementById('imagePreview');
  const img = document.getElementById('imagePreviewImg');
  if (!url) {
    preview.hidden = true;
    img.removeAttribute('src');
    return;
  }
  img.src = url;
  preview.hidden = false;
}

async function handleBggSearch() {
  const input = document.getElementById('bggSearchInput');
  const query = input.value.trim();
  const resultsContainer = document.getElementById('bggSearchResults');
  if (!query) return;

  try {
    const results = await api.bgg.search(query);
    resultsContainer.hidden = false;
    renderBggResults(resultsContainer, results, handleBggSelect);
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível buscar no BoardGameGeek.', 'error');
  }
}

async function handleBggSelect(id) {
  try {
    const details = await api.bgg.getDetails(id);
    const form = document.getElementById('registerForm');
    form.name.value = details.name || '';
    form.minPlayers.value = details.minPlayers || '';
    form.maxPlayers.value = details.maxPlayers || '';
    form.duration.value = details.duration || '';
    form.category.value = details.category || '';
    form.imageUrl.value = details.imageUrl || '';
    form.minAge.value = details.minAge || '';
    updateImagePreview(details.imageUrl || '');

    document.getElementById('bggSearchResults').hidden = true;
    document.getElementById('bggSearchInput').value = '';
    showToast(`Dados de "${details.name}" preenchidos. Confira antes de salvar.`, 'success');
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível carregar os dados do jogo.', 'error');
  }
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
  updateImagePreview(game.imageUrl || '');

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
  updateImagePreview('');
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
    allGames = await api.list(true);
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

async function handleRestore(id, name) {
  try {
    await api.restore(id);
    showToast(`"${name}" foi reativado.`, 'success');
    loadGames();
  } catch (err) {
    if (!handleAuthError(err)) showToast('Não foi possível reativar o jogo. Tente novamente.', 'error');
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

function stopMatchTick() {
  if (matchTickInterval) {
    clearInterval(matchTickInterval);
    matchTickInterval = null;
  }
}

function currentElapsedMs() {
  if (!activeMatch) return 0;
  if (!activeMatch.runningSince) return activeMatch.elapsedMs;
  return activeMatch.elapsedMs + (Date.now() - new Date(activeMatch.runningSince).getTime());
}

function updateTimerDisplay() {
  document.getElementById('matchTimerDisplay').textContent = formatElapsed(currentElapsedMs());
}

function refreshTimer() {
  stopMatchTick();
  updateTimerDisplay();
  if (activeMatch && activeMatch.runningSince) {
    matchTickInterval = setInterval(updateTimerDisplay, 1000);
  }
}

function updatePauseToggle() {
  const btn = document.getElementById('matchPauseToggle');
  const isRunning = Boolean(activeMatch && activeMatch.runningSince);
  btn.innerHTML = isRunning ? icons.pause : icons.play;
  btn.setAttribute('aria-label', isRunning ? 'Pausar cronômetro' : 'Retomar cronômetro');
}

function rerenderParticipants() {
  renderParticipantList(document.getElementById('participantList'), activeMatch.participants, {
    onScoreChange: handleScoreChange,
    onRemove: handleRemoveParticipant
  });
}

function enterMatchStage(match) {
  activeMatch = match;
  document.getElementById('drawStage').classList.add('has-match');
  document.getElementById('matchStage').hidden = false;
  document.getElementById('matchStage').classList.remove('match-stage--finished');
  document.getElementById('matchResult').hidden = true;
  renderMatchHeader(match);
  rerenderParticipants();
  updatePauseToggle();
  refreshTimer();
}

function hideMatchStage() {
  activeMatch = null;
  stopMatchTick();
  document.getElementById('drawStage').classList.remove('has-match');
  document.getElementById('matchStage').hidden = true;
  document.getElementById('matchStage').classList.remove('match-stage--finished');
}

function resetDrawStage() {
  hideMatchStage();
  document.getElementById('drawStage').classList.remove('has-result');
  document.getElementById('resultTicket').hidden = true;
  document.getElementById('drawTrigger').textContent = 'Rolar os dados';
}

async function loadActiveMatch() {
  try {
    const match = await api.matches.getActive();
    document.getElementById('drawStage').classList.remove('has-result');
    enterMatchStage(match);
  } catch (err) {
    if (err.status === 404) {
      hideMatchStage();
    } else if (!handleAuthError(err)) {
      showToast('Não foi possível carregar a partida em andamento.', 'error');
    }
  }
}

async function handleStartMatch(boardgameId) {
  try {
    const match = await api.matches.start(boardgameId);
    document.getElementById('drawStage').classList.remove('has-result');
    enterMatchStage(match);
  } catch (err) {
    if (err.status === 409) {
      showToast('Você já tem uma partida em andamento.', 'error');
      loadActiveMatch();
    } else if (!handleAuthError(err)) {
      showToast(err.message || 'Não foi possível iniciar a partida.', 'error');
    }
  }
}

async function handleAddParticipant(event) {
  event.preventDefault();
  const input = document.getElementById('participantNameInput');
  const name = input.value.trim();
  if (!name) return;

  try {
    const participant = await api.matches.addParticipant(activeMatch.id, name);
    activeMatch.participants.push(participant);
    rerenderParticipants();
    input.value = '';
    input.focus();
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível adicionar o participante.', 'error');
  }
}

async function handleRemoveParticipant(participantId) {
  try {
    await api.matches.removeParticipant(activeMatch.id, participantId);
    activeMatch.participants = activeMatch.participants.filter(p => p.id !== participantId);
    rerenderParticipants();
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível remover o participante.', 'error');
  }
}

async function handleScoreChange(participantId, rawValue) {
  const score = Number(rawValue);
  if (rawValue.trim() === '' || !Number.isInteger(score)) {
    showToast('Informe um número inteiro para o placar.', 'error');
    rerenderParticipants();
    return;
  }

  try {
    await api.matches.updateScore(activeMatch.id, participantId, score);
    const participant = activeMatch.participants.find(p => p.id === participantId);
    if (participant) participant.score = score;
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível atualizar o placar.', 'error');
    rerenderParticipants();
  }
}

async function handleTogglePause() {
  if (!activeMatch) return;
  try {
    const isRunning = Boolean(activeMatch.runningSince);
    const result = isRunning ? await api.matches.pause(activeMatch.id) : await api.matches.resume(activeMatch.id);
    activeMatch.elapsedMs = result.elapsedMs;
    activeMatch.runningSince = result.runningSince;
    updatePauseToggle();
    refreshTimer();
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível atualizar o cronômetro.', 'error');
  }
}

async function handleFinishMatch() {
  if (!activeMatch) return;

  const confirmed = await confirmDialog({
    title: 'Finalizar partida',
    message: activeMatch.participants.length === 0
      ? 'Finalizar sem nenhum participante? A partida será encerrada sem vencedor.'
      : 'Encerrar a partida e apurar o vencedor pelo placar atual?',
    confirmLabel: 'Finalizar',
    cancelLabel: 'Cancelar'
  });
  if (!confirmed) return;

  try {
    const finished = await api.matches.finish(activeMatch.id);
    activeMatch = finished;
    stopMatchTick();
    document.getElementById('matchTimerDisplay').textContent = formatElapsed(finished.elapsedMs);
    document.getElementById('matchStage').classList.add('match-stage--finished');
    renderMatchResult(document.getElementById('matchResult'), finished);
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível finalizar a partida.', 'error');
  }
}

async function handleCancelMatch() {
  if (!activeMatch) return;

  const confirmed = await confirmDialog({
    title: 'Cancelar partida',
    message: 'A partida em andamento será perdida, incluindo o cronômetro e o placar. Cancelar mesmo assim?',
    confirmLabel: 'Cancelar partida',
    cancelLabel: 'Voltar'
  });
  if (!confirmed) return;

  try {
    await api.matches.cancel(activeMatch.id);
    resetDrawStage();
    showToast('Partida cancelada.', 'success');
  } catch (err) {
    if (!handleAuthError(err)) showToast(err.message || 'Não foi possível cancelar a partida.', 'error');
  }
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
    if (err.needsVerification) {
      enterVerifyMode(err.email, 'login');
      showToast('Confirme seu e-mail para continuar. Você pode reenviar o código abaixo.', 'info');
      return;
    }
    showToast(err.message || 'Não foi possível entrar.', 'error');
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();

  try {
    await api.auth.register({
      name: form.name.value.trim(),
      email,
      password: form.password.value
    });
    enterVerifyMode(email, 'register');
    showToast('Enviamos um código de verificação para o seu e-mail.', 'success');
  } catch (err) {
    showToast(err.message || 'Não foi possível criar a conta.', 'error');
  }
}

async function handleVerifyEmail(event) {
  event.preventDefault();
  const form = event.target;

  try {
    const user = await api.auth.verifyEmail({
      email: pendingVerificationEmail,
      code: form.code.value.trim()
    });
    document.getElementById(verifySource === 'login' ? 'loginForm' : 'signupForm').reset();
    form.reset();
    pendingVerificationEmail = null;
    verifySource = null;
    showToast(`Conta verificada! Bem-vindo, ${user.name}.`, 'success');
    showAppView(user);
  } catch (err) {
    showToast(err.message || 'Não foi possível verificar o código.', 'error');
  }
}

function handleBackFromVerify() {
  switchAuthMode(verifySource === 'login' ? 'login' : 'register');
}

async function handleResendCode() {
  if (!pendingVerificationEmail) return;

  try {
    const { message } = await api.auth.resendVerification({ email: pendingVerificationEmail });
    showToast(message, 'success');
  } catch (err) {
    showToast(err.message || 'Não foi possível reenviar o código.', 'error');
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
  document.getElementById('verifyForm').addEventListener('submit', handleVerifyEmail);
  document.getElementById('resendCodeLink').addEventListener('click', handleResendCode);
  document.getElementById('backFromVerifyLink').addEventListener('click', handleBackFromVerify);
  document.getElementById('verifyCode').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('cancelEditBtn').addEventListener('click', exitEditMode);
  document.getElementById('bggSearchBtn').addEventListener('click', handleBggSearch);
  document.getElementById('bggSearchInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleBggSearch();
    }
  });
  document.getElementById('imageUrl').addEventListener('input', e => updateImagePreview(e.target.value.trim()));
  document.getElementById('imagePreviewImg').addEventListener('error', () => {
    document.getElementById('imagePreview').hidden = true;
  });
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
  document.getElementById('filterListShowDeleted').addEventListener('change', () => {
    populateListCategoryFilter();
    applyListFilters();
  });
  document.getElementById('clearListFiltersBtn').addEventListener('click', clearListFilters);
  document.getElementById('clearDrawFiltersBtn').addEventListener('click', clearDrawFilters);

  document.getElementById('resultTicket').addEventListener('click', event => {
    const btn = event.target.closest('[data-start-match]');
    if (btn) handleStartMatch(btn.dataset.boardgameId);
  });
  document.getElementById('addParticipantForm').addEventListener('submit', handleAddParticipant);
  document.getElementById('matchPauseToggle').addEventListener('click', handleTogglePause);
  document.getElementById('finishMatchBtn').addEventListener('click', handleFinishMatch);
  document.getElementById('cancelMatchBtn').addEventListener('click', handleCancelMatch);
  document.getElementById('matchResult').addEventListener('click', event => {
    if (event.target.closest('#newDrawBtn')) {
      document.getElementById('matchStage').classList.remove('match-stage--finished');
      resetDrawStage();
    }
  });

  try {
    const user = await api.auth.me();
    showAppView(user);
  } catch {
    showAuthView();
  }
});
