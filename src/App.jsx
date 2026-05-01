import { useCallback, useEffect, useState } from 'react';
import { APP_CONFIG } from './config.js';
import { Layout, EmptyState } from './components/Layout.jsx';
import { Toast } from './components/Toast.jsx';
import { Home } from './pages/Home.jsx';
import { Access } from './pages/Access.jsx';
import { Account } from './pages/Account.jsx';
import { Activities } from './pages/Activities.jsx';
import { Admin } from './pages/Admin.jsx';
import { Exam } from './pages/Exam.jsx';
import { Result } from './pages/Result.jsx';
import { clearAttemptData, load } from './services/storage.js';
import { getCurrentAttempt, getExamConfig, getResult } from './services/examService.js';
import { getStoredAuthSession, signOut } from './services/authService.js';
import './styles.css';

const PUBLIC_ROUTES = new Set(['home', 'acesso']);

export default function App() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash.replace('#', '') || 'home'));
  const [config, setConfig] = useState(() => getExamConfig());
  const [student, setStudent] = useState(() => load('student', null));
  const [session, setSession] = useState(() => getStoredAuthSession());
  const [attempt, setAttempt] = useState(() => getCurrentAttempt());
  const [result, setResult] = useState(() => getResult());
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timerId = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  useEffect(() => {
    function onHashChange() {
      setRoute(normalizeRoute(window.location.hash.replace('#', '') || 'home'));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [route]);

  function navigate(nextRoute) {
    const normalized = normalizeRoute(nextRoute);
    if (window.location.hash !== `#${normalized}`) {
      window.location.hash = `#${normalized}`;
    } else {
      setRoute(normalized);
    }
  }

  function refreshAuth() {
    setStudent(load('student', null));
    setSession(getStoredAuthSession());
  }

  function refreshAttempt() {
    setAttempt(getCurrentAttempt());
  }

  function refreshResult() {
    setResult(getResult());
  }

  function handleAuthenticated(nextSession, nextRoute = 'atividades') {
    setSession(nextSession);
    setStudent(load('student', null));
    navigate(nextRoute);
  }

  async function handleSignOut() {
    await signOut();
    clearAttemptData();
    refreshAuth();
    refreshAttempt();
    refreshResult();
    showToast('Sessão encerrada.');
    navigate('home');
  }

  function handleConfigSaved(updatedConfig) {
    setConfig(updatedConfig);
    refreshAttempt();
    refreshResult();
  }

  const safeSession = getStoredAuthSession();

  const protectedRoute = !PUBLIC_ROUTES.has(route);
  const requiresAdmin = route === 'admin';
  const canUseProtected = Boolean(safeSession && student);
  const activeRoute = route === 'acesso' ? 'acesso' : route;

  let content;

  if (protectedRoute && !canUseProtected) {
    content = (
      <EmptyState
        title="Acesse sua conta para continuar."
        description="Faça cadastro ou login para visualizar as atividades disponíveis."
        actionLabel="Ir para acesso"
        actionRoute="acesso"
        navigate={navigate}
      />
    );
  } else if (requiresAdmin && safeSession?.role !== 'admin') {
    content = (
      <EmptyState
        title="Acesso restrito ao administrador."
        description="Entre com uma conta administrativa para liberar esta área."
        actionLabel="Ir para conta"
        actionRoute={safeSession ? 'conta' : 'acesso'}
        navigate={navigate}
      />
    );
  } else {
    content = renderRoute({
      route,
      config,
      student,
      session: safeSession,
      attempt,
      result,
      navigate,
      showToast,
      onAuthenticated: handleAuthenticated,
      onSignOut: handleSignOut,
      onConfigSaved: handleConfigSaved,
      refreshAttempt,
      refreshResult
    });
  }

  return (
    <>
      <Layout route={activeRoute} session={safeSession} navigate={navigate}>
        {content}
      </Layout>
      <Toast toast={toast} />
    </>
  );
}

function renderRoute(props) {
  const { route } = props;

  switch (route) {
    case 'home':
      return <Home config={props.config} navigate={props.navigate} />;
    case 'acesso':
      if (props.session && props.student) {
        return <Account student={props.student} session={props.session} onSignOut={props.onSignOut} />;
      }
      return <Access config={props.config} student={props.student} onAuthenticated={props.onAuthenticated} showToast={props.showToast} />;
    case 'conta':
      return <Account student={props.student} session={props.session} onSignOut={props.onSignOut} />;
    case 'atividades':
      return <Activities student={props.student} session={props.session} config={props.config} navigate={props.navigate} showToast={props.showToast} refreshAttempt={props.refreshAttempt} refreshResult={props.refreshResult} />;
    case 'prova':
      return <Exam attempt={props.attempt} result={props.result} navigate={props.navigate} showToast={props.showToast} refreshAttempt={props.refreshAttempt} refreshResult={props.refreshResult} />;
    case 'resultado':
      return <Result result={props.result} attempt={props.attempt} navigate={props.navigate} />;
    case 'admin':
      return <Admin config={props.config} onConfigSaved={props.onConfigSaved} showToast={props.showToast} navigate={props.navigate} />;
    default:
      return <Home config={props.config} navigate={props.navigate} />;
  }
}

function normalizeRoute(route) {
  if (route === 'cadastro') return 'acesso';
  if (!route) return 'home';
  return route;
}
