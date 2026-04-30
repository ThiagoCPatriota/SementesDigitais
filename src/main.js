import { renderAdmin, renderCadastro, renderHome, renderProva, renderResultado } from './pages.js';

const app = document.querySelector('#app');

const routes = {
  home: renderHome,
  cadastro: renderCadastro,
  admin: renderAdmin,
  prova: renderProva,
  resultado: renderResultado
};

function getRoute() {
  return window.location.hash.replace('#', '') || 'home';
}

function render() {
  const route = getRoute();
  const renderer = routes[route] ?? routes.home;
  app.innerHTML = renderer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', render);
window.addEventListener('app:rerender', render);

if (!window.location.hash) {
  window.location.hash = '#home';
} else {
  render();
}
