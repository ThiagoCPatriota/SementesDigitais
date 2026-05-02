import { useMemo, useState } from 'react';
import { APP_CONFIG } from '../config.js';
import { Icon } from '../components/Icon.jsx';
import { getCurrentAttempt, startAttempt } from '../services/examService.js';
import {
  getActivities,
  getPersonalActivities,
  getPublishedActivities,
  getStudentClassActivityAttempt,
  isActivityExpired,
  restoreClassActivityAttempt,
  restoreClassActivityResult,
  restorePersonalActivityAttempt,
  restorePersonalActivityResult,
  updatePersonalActivity
} from '../services/activityService.js';

export function Activities({ student, session, config, navigate, showToast, refreshAttempt, refreshResult }) {
  const isAdmin = session.role === 'admin';
  const [refreshKey, setRefreshKey] = useState(0);
  const classActivities = useMemo(
    () => (isAdmin ? getActivities() : getPublishedActivities()),
    [isAdmin, refreshKey]
  );

  const personalActivities = useMemo(
    () => getPersonalActivities(student.email),
    [student.email, refreshKey]
  );

  const latestPublishedId = useMemo(
    () => getPublishedActivities()[0]?.id ?? null,
    [refreshKey]
  );

  function startClassActivity(activity) {
    const studentRecord = getStudentClassActivityAttempt(activity.id, student.email);

    if (studentRecord?.result) {
      viewClassResult(activity);
      return;
    }

    if (studentRecord?.status === 'em_andamento') {
      if (restoreClassActivityAttempt(activity.id, student.email)) {
        refreshAttempt();
        refreshResult?.();
        showToast('Atividade em andamento recuperada. O tempo continua contando.');
        navigate('prova');
        return;
      }
    }

    const currentAttempt = getCurrentAttempt();

    if (currentAttempt?.activityId === activity.id && currentAttempt?.status === 'em_andamento') {
      refreshAttempt();
      navigate('prova');
      return;
    }

    startAttempt(student, { ...activity, activityType: 'turma', activityId: activity.id });
    refreshAttempt();
    refreshResult?.();
    showToast('Atividade iniciada. Boa prova!');
    navigate('prova');
  }

  function viewClassResult(activity) {
    if (!restoreClassActivityResult(activity.id, student.email)) {
      showToast('Resultado ainda não disponível para essa atividade.', 'error');
      return;
    }

    refreshAttempt();
    refreshResult?.();
    navigate('resultado');
  }

  function continuePersonalActivity(activity) {
    const expired = isActivityExpired(activity);

    if (expired) {
      if (restorePersonalActivityResult(activity)) {
        refreshAttempt();
        refreshResult?.();
        navigate('resultado');
        return;
      }

      updatePersonalActivity(student.email, activity.id, { status: 'finished', finishedAt: new Date().toISOString() });
      setRefreshKey((current) => current + 1);
      showToast('Essa atividade já foi encerrada.', 'error');
      return;
    }

    if (activity.status === 'in_progress' && restorePersonalActivityAttempt(activity)) {
      refreshAttempt();
      refreshResult?.();
      showToast('Atividade em andamento recuperada. O tempo continua contando.');
      navigate('prova');
      return;
    }

    const currentAttempt = getCurrentAttempt();

    if (currentAttempt?.activityId === activity.id && currentAttempt?.status === 'em_andamento') {
      refreshAttempt();
      navigate('prova');
      return;
    }

    const attempt = startAttempt(student, { ...activity, activityType: 'pessoal', activityId: activity.id });
    updatePersonalActivity(student.email, activity.id, {
      status: 'in_progress',
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      attemptSnapshot: attempt,
      answersSnapshot: {}
    });

    refreshAttempt();
    refreshResult?.();
    setRefreshKey((current) => current + 1);
    navigate('prova');
  }

  function viewPersonalResult(activity) {
    if (!restorePersonalActivityResult(activity)) {
      showToast('Resultado ainda não disponível para essa atividade.', 'error');
      return;
    }

    refreshAttempt();
    refreshResult?.();
    navigate('resultado');
  }

  return (
    <>
      <section className="section-header dashboard-header">
        <span className="eyebrow">Área de atividades</span>
        <h1>Olá, {student.name.split(' ')[0]}!</h1>
        <p>
          {isAdmin
            ? 'Veja as atividades cadastradas e acesse o painel administrativo para acompanhar os alunos.'
            : 'Acesse atividades publicadas pela equipe, consulte resultados anteriores ou crie práticas pessoais para estudar no seu ritmo.'}
        </p>
      </section>

      {!isAdmin && classActivities.length === 0 ? (
        <section className="notice-card notice-card--soft activity-empty-card">
          <strong>Nenhuma atividade da turma publicada no momento</strong>
          <p>{APP_CONFIG.activities.emptyStudentMessage}</p>
        </section>
      ) : null}

      <section className="activity-grid activity-grid--compact">
        {classActivities.map((activity) => {
          const studentRecord = !isAdmin ? getStudentClassActivityAttempt(activity.id, student.email) : null;
          const hasResult = Boolean(studentRecord?.result && studentRecord?.attemptSnapshot);
          const isInProgress = studentRecord?.status === 'em_andamento';
          const isLatest = activity.id === latestPublishedId && activity.status === 'published';

          return (
            <article
              className={`activity-card activity-card--official activity-card--compact ${isLatest ? 'activity-card--latest' : ''} ${hasResult ? 'activity-card--finished' : ''}`}
              key={activity.id}
            >
              <div className="activity-card__top">
                <Icon name="classroom" className="activity-card__icon" />
                <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                  {isLatest ? 'Mais recente' : activity.status === 'published' ? 'Publicada' : 'Rascunho'}
                </span>
              </div>
              <span className="activity-card__date">Criada em {formatDate(activity.createdAt)}</span>
              <h2>{activity.title}</h2>
              <p>Atividade organizada pela equipe para acompanhamento da turma.</p>
              <div className="activity-card__meta">
                <span><strong>{activity.questionCount}</strong> questões</span>
                <span><strong>{activity.durationMinutes}</strong> min</span>
              </div>

              {isAdmin ? (
                <button className="button button--ghost button--full" type="button" onClick={() => navigate('admin')}>
                  Ver no painel
                </button>
              ) : hasResult ? (
                <button className="button button--ghost button--full" type="button" onClick={() => viewClassResult(activity)}>
                  Ver resultado
                </button>
              ) : (
                <button
                  className="button button--primary button--full"
                  type="button"
                  onClick={() => startClassActivity(activity)}
                >
                  {isInProgress ? 'Continuar atividade' : 'Iniciar atividade'}
                </button>
              )}
            </article>
          );
        })}

        {personalActivities.map((activity) => {
          const expired = isActivityExpired(activity);
          const hasResult = Boolean(activity.result && activity.attemptSnapshot);
          const isFinished = expired || activity.status === 'finished';

          return (
            <article
              className={`activity-card activity-card--personal activity-card--compact ${isFinished ? 'activity-card--finished' : ''}`}
              key={activity.id}
            >
              <div className="activity-card__top">
                <Icon name="target" className="activity-card__icon" />
                <span className={`badge ${isFinished ? 'badge--muted' : ''}`}>
                  {isFinished ? 'Encerrada' : 'Pessoal'}
                </span>
              </div>
              <span className="activity-card__date">Criada em {formatDate(activity.createdAt)}</span>
              <h2>{activity.title}</h2>
              <p>Prática criada por você para estudo individual.</p>
              <div className="activity-card__meta">
                <span><strong>{activity.questionCount}</strong> questões</span>
                <span><strong>{activity.durationMinutes}</strong> min</span>
              </div>
              {isFinished ? (
                <button
                  className="button button--ghost button--full"
                  type="button"
                  disabled={!hasResult}
                  onClick={() => viewPersonalResult(activity)}
                >
                  {hasResult ? 'Ver resultado' : 'Encerrada'}
                </button>
              ) : (
                <button className="button button--primary button--full" type="button" onClick={() => continuePersonalActivity(activity)}>
                  Continuar atividade
                </button>
              )}
            </article>
          );
        })}

        {!isAdmin ? (
          <article className="activity-card activity-card--create activity-card--compact activity-card--create-form">
            <div className="activity-card__top">
              <div className="activity-card__plus" aria-hidden="true">+</div>
              <span className="badge">Pessoal</span>
            </div>
            <span className="eyebrow">Prática individual</span>
            <h2>Criar atividade pessoal</h2>
            <p>Monte uma prática com até 90 questões e escolha a distribuição entre as áreas do ENEM.</p>
            <button className="button button--ghost button--full" type="button" onClick={() => navigate('criar')}>
              Abrir criador
            </button>
          </article>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="notice-card admin-shortcut-card">
          <strong>Acesso administrativo liberado</strong>
          <p>Crie, publique ou oculte atividades no painel administrativo. Lá também ficam os resultados enviados pelos alunos.</p>
          <button className="button button--primary" type="button" onClick={() => navigate('admin')}>Abrir painel administrativo</button>
        </section>
      ) : null}
    </>
  );
}

function formatDate(value) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}
