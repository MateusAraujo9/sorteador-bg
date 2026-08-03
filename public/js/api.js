const BASE_URL = '/api';

async function request(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = 'Algo deu errado. Tente novamente.';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // resposta sem corpo JSON, mantém mensagem padrão
    }
    const error = new Error(message);
    error.status = response.status;
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
  list: () => request('/boardgames'),
  create: game => request('/boardgames', { method: 'POST', ...jsonBody(game) }),
  update: (id, game) => request(`/boardgames/${id}`, { method: 'PUT', ...jsonBody(game) }),
  remove: id => request(`/boardgames/${id}`, { method: 'DELETE' }),
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
    forgotPassword: data => request('/auth/forgot-password', { method: 'POST', ...jsonBody(data) }),
    resetPassword: data => request('/auth/reset-password', { method: 'POST', ...jsonBody(data) })
  }
};
