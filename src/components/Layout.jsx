import { Icon } from './Icon.jsx';
import { BrandLogo } from './BrandLogo.jsx';

export function Layout({ route, session, children, navigate }) {
  const isSignedIn = Boolean(session);
  const isAdmin = session?.role === 'admin';
  const brandRoute = isSignedIn ? 'atividades' : 'home';

  const items = isSignedIn
    ? [
        ['atividades', 'Atividades'],
        ...(isAdmin ? [['admin', 'Administração'], ['criar-simulado', 'Criar']] : [['prova', 'Prova']]),
        ['conta', 'Conta']
      ]
    : [
        ['home', 'Início'],
        ['acesso', 'Acesso']
      ];

  return (
    <>
      <header className="topbar">
        <a className="brand" href={`#${brandRoute}`} aria-label="Voltar para área principal" onClick={(event) => handleNav(event, brandRoute, navigate)}>
          <BrandLogo className="brand-logo--header" compact />
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
