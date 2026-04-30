export function showToast(message, type = 'success') {
  const previousToast = document.querySelector('.toast');
  previousToast?.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => toast.remove(), 2600);
}
