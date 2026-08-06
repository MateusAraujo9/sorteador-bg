import { api } from './api.js';
import { showToast } from './toast.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const token = new URLSearchParams(window.location.search).get('token');

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;

  if (form.newPassword.value !== form.confirmPassword.value) {
    showToast('A confirmação de senha não confere.', 'error');
    return;
  }

  try {
    await api.auth.resetPassword({ token, newPassword: form.newPassword.value });
    showToast('Senha redefinida com sucesso! Redirecionando...', 'success');
    setTimeout(() => window.location.assign('/'), 1500);
  } catch (err) {
    showToast(err.message || 'Não foi possível redefinir a senha.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!token) {
    document.getElementById('resetForm').classList.remove('is-active');
    document.getElementById('invalidState').hidden = false;
    return;
  }

  document.getElementById('resetForm').addEventListener('submit', handleSubmit);
});
