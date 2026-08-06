const BASE_URL = '/api';

async function request(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = 'Algo deu errado. Tente novamente.';
    let data = null;
    try {
      data = await response.json();
      message = data.error || message;
    } catch {
      // resposta sem corpo JSON, mantém mensagem padrão
    }
    const error = new Error(message);
    error.status = response.status;
    if (data && data.needsVerification) {
      error.needsVerification = true;
      error.email = data.email;
    }
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function jsonBody(body) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export const api = {
  list: (includeDeleted = false) => request(`/boardgames${includeDeleted ? '?includeDeleted=true' : ''}`),
  create: game => request('/boardgames', { method: 'POST', ...jsonBody(game) }),
  update: (id, game) => request(`/boardgames/${id}`, { method: 'PUT', ...jsonBody(game) }),
  remove: id => request(`/boardgames/${id}`, { method: 'DELETE' }),
  restore: id => request(`/boardgames/${id}/restore`, { method: 'POST' }),
  drawRandom: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.players) params.set('players', filters.players);
    if (filters.minAge) params.set('minAge', filters.minAge);
    if (filters.category) params.set('category', filters.category);
    const qs = params.toString();
    return request(`/boardgames/random${qs ? `?${qs}` : ''}`);
  },

  createLink: (gameId, link) => request(`/boardgames/${gameId}/links`, { method: 'POST', ...jsonBody(link) }),
  removeLink: (gameId, linkId) => request(`/boardgames/${gameId}/links/${linkId}`, { method: 'DELETE' }),

  auth: {
    me: () => request('/auth/me'),
    register: data => request('/auth/register', { method: 'POST', ...jsonBody(data) }),
    login: data => request('/auth/login', { method: 'POST', ...jsonBody(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    updateProfile: data => request('/auth/me', { method: 'PATCH', ...jsonBody(data) }),
    verifyEmail: data => request('/auth/verify-email', { method: 'POST', ...jsonBody(data) }),
    resendVerification: data => request('/auth/resend-verification', { method: 'POST', ...jsonBody(data) }),
    forgotPassword: data => request('/auth/forgot-password', { method: 'POST', ...jsonBody(data) }),
    resetPassword: data => request('/auth/reset-password', { method: 'POST', ...jsonBody(data) })
  },

  admin: {
    listUsers: () => request('/admin/users'),
    updateUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', ...jsonBody({ role }) })
  },

  bgg: {
    search: query => request(`/bgg/search?q=${encodeURIComponent(query)}`),
    getDetails: id => request(`/bgg/${id}`)
  },

  matches: {
    getActive: () => request('/matches/active'),
    start: boardgameId => request('/matches', { method: 'POST', ...jsonBody({ boardgameId }) }),
    addParticipant: (matchId, name) => request(`/matches/${matchId}/participants`, { method: 'POST', ...jsonBody({ name }) }),
    removeParticipant: (matchId, participantId) => request(`/matches/${matchId}/participants/${participantId}`, { method: 'DELETE' }),
    updateScore: (matchId, participantId, score) => request(`/matches/${matchId}/participants/${participantId}`, { method: 'PATCH', ...jsonBody({ score }) }),
    pause: matchId => request(`/matches/${matchId}/pause`, { method: 'POST' }),
    resume: matchId => request(`/matches/${matchId}/resume`, { method: 'POST' }),
    finish: matchId => request(`/matches/${matchId}/finish`, { method: 'POST' }),
    cancel: matchId => request(`/matches/${matchId}`, { method: 'DELETE' })
  }
};
