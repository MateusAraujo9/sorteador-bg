import { icons } from './icons.js';
import { spineIndex } from './spine.js';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

export function renderStats({ total, categories, avgDuration }) {
  document.getElementById('totalCount').textContent = total;
  document.getElementById('categoriesCount').textContent = categories;
  document.getElementById('avgDuration').textContent = avgDuration;
}

export function renderEmptyState(container, { title, message }) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__mark">${icons.die}</div>
      <p class="empty-state__title">${title}</p>
      <p class="empty-state__message">${message}</p>
    </div>`;
}

export function renderGameList(container, games, onDelete, onEdit) {
  if (games.length === 0) {
    renderEmptyState(container, {
      title: 'Sua estante está vazia.',
      message: 'Cadastre o primeiro jogo na aba "Cadastrar" para começar sua coleção.'
    });
    return;
  }

  container.innerHTML = games.map(gameCardTemplate).join('');

  container.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', () => onDelete(btn.dataset.deleteId, btn.dataset.deleteName));
  });

  container.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => onEdit(games.find(g => g.id === btn.dataset.editId)));
  });
}

function statItem(icon, value) {
  return `<div class="stat-item">${icon}<span>${value}</span></div>`;
}

function gameStatsMarkup(game) {
  const items = [];
  if (game.minPlayers || game.maxPlayers) {
    items.push(statItem(icons.players, `${game.minPlayers || '?'}–${game.maxPlayers || '?'} jogadores`));
  }
  if (game.duration) items.push(statItem(icons.clock, `${escapeHtml(game.duration)} min`));
  if (game.category) items.push(statItem(icons.tag, escapeHtml(game.category)));
  if (game.minAge) items.push(statItem(icons.age, `${escapeHtml(game.minAge)}+`));
  return items.join('');
}

function gameCardTemplate(game) {
  const spine = spineIndex(game.category);
  const media = game.imageUrl
    ? `<img src="${escapeHtml(game.imageUrl)}" alt="${escapeHtml(game.name)}" loading="lazy" onerror="this.remove()">`
    : `<span class="game-card__media-fallback">${icons.die}</span>`;

  return `
    <article class="game-card">
      <span class="game-card__spine spine-${spine}"></span>
      <div class="game-card__media">${media}</div>
      <div class="game-card__body">
        <h3 class="game-card__title">${escapeHtml(game.name)}</h3>
        <div class="game-card__stats">${gameStatsMarkup(game)}</div>
      </div>
      <div class="game-card__actions">
        <button class="icon-btn" type="button" data-edit-id="${game.id}" aria-label="Editar ${escapeHtml(game.name)}">
          ${icons.edit}
        </button>
        <button class="icon-btn icon-btn--danger" type="button" data-delete-id="${game.id}" data-delete-name="${escapeHtml(game.name)}" aria-label="Remover ${escapeHtml(game.name)}">
          ${icons.trash}
        </button>
      </div>
    </article>`;
}

export function renderTicket(container, game) {
  const media = game.imageUrl
    ? `<div class="ticket__media"><img src="${escapeHtml(game.imageUrl)}" alt="${escapeHtml(game.name)}" onerror="this.parentElement.remove()"></div>`
    : '';
  const ticketNumber = String(100 + Math.floor(Math.random() * 900));

  container.innerHTML = `
    <div class="ticket__stub">
      <span>Bilhete da sorte</span>
      <span>Nº ${ticketNumber}</span>
    </div>
    <div class="ticket__perf" aria-hidden="true"></div>
    <div class="ticket__body">
      ${media}
      <h3 class="ticket__title">${escapeHtml(game.name)}</h3>
      <div class="ticket__details">${gameStatsMarkup(game)}</div>
    </div>`;

  container.hidden = false;
}
