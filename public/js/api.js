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
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  list: () => request('/boardgames'),
  create: game => request('/boardgames', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(game)
  }),
  remove: id => request(`/boardgames/${id}`, { method: 'DELETE' }),
  drawRandom: () => request('/boardgames/random')
};
