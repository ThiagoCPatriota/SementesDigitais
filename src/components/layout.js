import { APP_CONFIG } from '../config.js';

export function shell(content, activeRoute = 'home') {
  return `
    <header class="topbar">
      <a class="brand" href="#home" aria-label="Voltar para início">
        <span class="brand__mark">SD</span>
        <span>
          <strong>${APP_CONFIG.appName}</strong>
          <small>${APP_CONFIG.moduleName}</small>
        </span>
      </a>

      <nav class="nav" aria-label="Navegação principal">
        ${navItem('home', 'Início', activeRoute)}
        ${navItem('cadastro', 'Cadastro', activeRoute)}
        ${navItem('admin', 'Admin', activeRoute)}
        ${navItem('prova', 'Prova', activeRoute)}
      </nav>
    </header>

    <main class="page-shell">
      ${content}
    </main>
  `;
}

function navItem(route, label, activeRoute) {
  const activeClass = activeRoute === route ? 'nav__link--active' : '';
  return `<a class="nav__link ${activeClass}" href="#${route}">${label}</a>`;
}

export function emptyState({ title, description, actionLabel, actionHref }) {
  return `
    <section class="empty-state">
      <div class="empty-state__icon">🌱</div>
      <h2>${title}</h2>
      <p>${description}</p>
      ${actionLabel ? `<a class="button button--primary" href="${actionHref}">${actionLabel}</a>` : ''}
    </section>
  `;
}
