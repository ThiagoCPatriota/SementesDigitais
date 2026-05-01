import { APP_CONFIG } from '../config.js';
import { Icon } from './Icon.jsx';

export function Layout({ route, session, children, navigate }) {
  const isSignedIn = Boolean(session);
  const isAdmin = session?.role === 'admin';

  const items = [
    ['home', 'Início'],
    [isSignedIn ? 'conta' : 'acesso', isSignedIn ? 'Conta' : 'Acesso'],
    ...(isSignedIn ? [['atividades', 'Atividades'], ['prova', 'Prova']] : []),
    ...(isAdmin ? [['admin', 'Admin']] : [])
  ];

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Voltar para início" onClick={(event) => handleNav(event, 'home', navigate)}>
          <span className="brand__mark">SD</span>
          <span>
            <strong>{APP_CONFIG.appName}</strong>
            <small>{APP_CONFIG.moduleName}</small>
          </span>
        </a>

        <nav className="nav" aria-label="Navegação principal">
          {items.map(([itemRoute, label]) => (
            <a
              key={itemRoute}
              className={`nav__link ${route === itemRoute ? 'nav__link--active' : ''}`}
              href={`#${itemRoute}`}
              onClick={(event) => handleNav(event, itemRoute, navigate)}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main className="page-shell">{children}</main>
    </>
  );
}

function handleNav(event, route, navigate) {
  event.preventDefault();
  navigate(route);
}

export function EmptyState({ title, description, actionLabel, actionRoute, navigate }) {
  return (
    <section className="empty-state">
      <Icon name="seed" className="empty-state__icon" />
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel ? (
        <button className="button button--primary" type="button" onClick={() => navigate(actionRoute)}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
