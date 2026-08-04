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

export function renderGameList(container, games, onDelete, onEdit, onRestore) {
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

  container.querySelectorAll('[data-restore-id]').forEach(btn => {
    btn.addEventListener('click', () => onRestore(btn.dataset.restoreId, btn.dataset.restoreName));
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

function docChip(link) {
  return `
    <a class="doc-chip" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
      ${icons.document}<span>${escapeHtml(link.label)}</span>
    </a>`;
}

function gameLinksMarkup(game) {
  if (!game.links || game.links.length === 0) return '';
  return `<div class="doc-chips">${game.links.map(docChip).join('')}</div>`;
}

function gameCardTemplate(game) {
  const spine = spineIndex(game.category);
  const isDeleted = Boolean(game.deletedAt);
  const media = game.imageUrl
    ? `<img src="${escapeHtml(game.imageUrl)}" alt="${escapeHtml(game.name)}" loading="lazy" onerror="this.remove()">`
    : `<span class="game-card__media-fallback">${icons.die}</span>`;

  const actions = isDeleted ? `
      <div class="game-card__actions">
        <button class="icon-btn icon-btn--restore" type="button" data-restore-id="${game.id}" data-restore-name="${escapeHtml(game.name)}" aria-label="Reativar ${escapeHtml(game.name)}">
          ${icons.restore}
        </button>
      </div>` : `
      <div class="game-card__actions">
        <button class="icon-btn" type="button" data-edit-id="${game.id}" aria-label="Editar ${escapeHtml(game.name)}">
          ${icons.edit}
        </button>
        <button class="icon-btn icon-btn--danger" type="button" data-delete-id="${game.id}" data-delete-name="${escapeHtml(game.name)}" aria-label="Remover ${escapeHtml(game.name)}">
          ${icons.trash}
        </button>
      </div>`;

  return `
    <article class="game-card${isDeleted ? ' game-card--deleted' : ''}">
      <span class="game-card__spine spine-${spine}"></span>
      <div class="game-card__media">${media}</div>
      <div class="game-card__body">
        <h3 class="game-card__title">${escapeHtml(game.name)}${isDeleted ? '<span class="game-card__badge">Excluído</span>' : ''}</h3>
        <div class="game-card__stats">${gameStatsMarkup(game)}</div>
        ${gameLinksMarkup(game)}
      </div>
      ${actions}
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
      ${gameLinksMarkup(game)}
    </div>`;

  container.hidden = false;
}

function adminUserRowTemplate(user, currentUserId) {
  const isSelf = user.id === currentUserId;

  return `
    <div class="admin-user-row">
      <div class="admin-user-row__info">
        <span class="admin-user-row__name">${escapeHtml(user.name)}${isSelf ? ' <span class="admin-user-row__you">(você)</span>' : ''}</span>
        <span class="admin-user-row__email">${escapeHtml(user.email)}</span>
      </div>
      <div class="admin-user-row__stat">
        <span class="admin-user-row__count">${user.gameCount}</span>
        <span class="admin-user-row__count-label">jogo${user.gameCount === 1 ? '' : 's'}</span>
      </div>
      <select class="role-select" data-user-id="${user.id}"${isSelf ? ' disabled title="Você não pode alterar seu próprio perfil"' : ''}>
        <option value="user"${user.role === 'user' ? ' selected' : ''}>Usuário</option>
        <option value="admin"${user.role === 'admin' ? ' selected' : ''}>Administrador</option>
      </select>
    </div>`;
}

export function renderAdminUsers(container, users, currentUserId, onRoleChange) {
  if (users.length === 0) {
    renderEmptyState(container, { title: 'Nenhum usuário encontrado.', message: '' });
    return;
  }

  container.innerHTML = users.map(u => adminUserRowTemplate(u, currentUserId)).join('');

  container.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', () => onRoleChange(select.dataset.userId, select.value));
  });
}

export function renderBggResults(container, results, onSelect) {
  if (results.length === 0) {
    container.innerHTML = '<p class="bgg-search__empty">Nenhum resultado encontrado.</p>';
    return;
  }

  container.innerHTML = results.map(game => `
    <button type="button" class="bgg-result" data-bgg-id="${escapeHtml(game.id)}">
      <span class="bgg-result__name">${escapeHtml(game.name)}</span>
      ${game.yearPublished ? `<span class="bgg-result__year">${escapeHtml(game.yearPublished)}</span>` : ''}
    </button>
  `).join('');

  container.querySelectorAll('[data-bgg-id]').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.bggId));
  });
}

export function renderLinksList(container, links, onRemove) {
  if (links.length === 0) {
    container.innerHTML = '<p class="links-empty">Nenhum documento adicionado ainda.</p>';
    return;
  }

  container.innerHTML = links.map(link => `
    <div class="link-row">
      <div class="link-row__info">
        <span class="link-row__label">${escapeHtml(link.label)}</span>
        <a class="link-row__url" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">Abrir ↗</a>
      </div>
      <button type="button" class="icon-btn icon-btn--danger" data-remove-link-key="${escapeHtml(link.key)}" aria-label="Remover ${escapeHtml(link.label)}">
        ${icons.trash}
      </button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-link-key]').forEach(btn => {
    btn.addEventListener('click', () => onRemove(btn.dataset.removeLinkKey));
  });
}
