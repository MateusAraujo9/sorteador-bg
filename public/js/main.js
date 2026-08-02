import { api } from './api.js';
import { showToast } from './toast.js';
import { renderGameList, renderStats, renderTicket } from './render.js';
import { rollDie } from './dice.js';

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('is-active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('is-active'));

  document.getElementById(`tab-${tab}`).classList.add('is-active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('is-active');

  if (tab === 'list') loadGames();
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
    renderGameList(listEl, games, handleDelete);
    renderStats(computeStats(games));
  } catch {
    showToast('Não foi possível carregar sua coleção.', 'error');
  }
}

async function handleDelete(id, name) {
  if (!confirm(`Remover "${name}" da sua coleção?`)) return;

  try {
    await api.remove(id);
    showToast(`"${name}" foi removido.`, 'success');
    loadGames();
  } catch {
    showToast('Não foi possível remover o jogo. Tente novamente.', 'error');
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

  api.create(payload)
    .then(() => {
      showToast(`"${payload.name}" entrou na coleção.`, 'success');
      form.reset();
    })
    .catch(err => showToast(err.message || 'Não foi possível cadastrar o jogo.', 'error'));
}

async function handleDraw() {
  const stage = document.getElementById('drawStage');
  const trigger = document.getElementById('drawTrigger');
  const dieFace = document.getElementById('dieFace');
  const ticket = document.getElementById('resultTicket');

  trigger.disabled = true;
  trigger.textContent = 'Rolando...';

  const [result] = await Promise.all([
    api.drawRandom().catch(err => ({ __error: err.message })),
    rollDie(dieFace)
  ]);

  trigger.disabled = false;

  if (result && result.__error) {
    trigger.textContent = 'Rolar os dados';
    showToast(
      result.__error === 'Nenhum boardgame cadastrado para sortear'
        ? 'Cadastre ao menos um jogo antes de rolar os dados.'
        : result.__error,
      'error'
    );
    return;
  }

  trigger.textContent = 'Rolar novamente';
  renderTicket(ticket, result);
  stage.classList.add('has-result');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('registerForm').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('drawTrigger').addEventListener('click', handleDraw);

  loadGames();
});
