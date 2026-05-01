import { useMemo, useState } from 'react';
import { APP_CONFIG } from '../config.js';
import { Icon } from '../components/Icon.jsx';
import { getCurrentAttempt, startAttempt } from '../services/examService.js';
import {
  createPersonalActivity,
  getActivities,
  getPersonalActivities,
  getPublishedActivities,
  isActivityExpired,
  restorePersonalActivityResult,
  updatePersonalActivity
} from '../services/activityService.js';

export function Activities({ student, session, config, navigate, showToast, refreshAttempt, refreshResult }) {
  const isAdmin = session.role === 'admin';
  const [refreshKey, setRefreshKey] = useState(0);
  const [personalForm, setPersonalForm] = useState({
    title: APP_CONFIG.personalActivity.title,
    questionCount: APP_CONFIG.personalActivity.questionCount,
    durationMinutes: APP_CONFIG.personalActivity.durationMinutes
  });

  const classActivities = useMemo(
    () => (isAdmin ? getActivities() : getPublishedActivities()),
    [isAdmin, refreshKey]
  );

  const personalActivities = useMemo(
    () => getPersonalActivities(student.email),
    [student.email, refreshKey]
  );

  function updatePersonalForm(event) {
    const { name, value } = event.target;
    setPersonalForm((current) => ({ ...current, [name]: value }));
  }

  function startClassActivity(activity) {
    startAttempt(student, { ...activity, activityType: 'turma', activityId: activity.id });
    refreshAttempt();
    refreshResult?.();
    showToast('Atividade iniciada. Boa prova!');
    navigate('prova');
  }

  function createAndStartPersonalActivity(event) {
    event.preventDefault();

    const questionCount = Number(personalForm.questionCount);
    const durationMinutes = Number(personalForm.durationMinutes);

    if (!personalForm.title.trim()) {
      showToast('Informe um nome para a atividade pessoal.', 'error');
      return;
    }

    if (questionCount < 1 || questionCount > 60) {
      showToast('Informe uma quantidade entre 1 e 60 questões.', 'error');
      return;
    }

    if (durationMinutes < 1 || durationMinutes > 300) {
      showToast('Informe um tempo entre 1 e 300 minutos.', 'error');
      return;
    }

    const activity = createPersonalActivity({
      ...personalForm,
      questionCount,
      durationMinutes,
      ownerEmail: student.email,
      classCode: config.classCode
    });

    const attempt = startAttempt(student, { ...activity, activityType: 'pessoal', activityId: activity.id });
    updatePersonalActivity(student.email, activity.id, {
      status: 'in_progress',
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt
    });

    refreshAttempt();
    refreshResult?.();
    setRefreshKey((current) => current + 1);
    showToast('Atividade pessoal criada. Boa prática!');
    navigate('prova');
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
      deadlineAt: attempt.deadlineAt
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
            ? 'Veja as atividades criadas no painel administrativo ou teste uma prática individual.'
            : 'Acesse as atividades publicadas pela equipe ou crie práticas pessoais para estudar no seu ritmo.'}
        </p>
      </section>

      {!isAdmin && classActivities.length === 0 ? (
        <section className="notice-card notice-card--soft activity-empty-card">
          <strong>Nenhuma atividade da turma publicada no momento</strong>
          <p>{APP_CONFIG.activities.emptyStudentMessage}</p>
        </section>
      ) : null}

      <section className="activity-grid activity-grid--compact">
        {classActivities.map((activity) => (
          <article className="activity-card activity-card--official activity-card--compact" key={activity.id}>
            <div className="activity-card__top">
              <Icon name="classroom" className="activity-card__icon" />
              <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                {activity.status === 'published' ? 'Publicada' : 'Rascunho'}
              </span>
            </div>
            <span className="activity-card__date">Criada em {formatDate(activity.createdAt)}</span>
            <h2>{activity.title}</h2>
            <p>Atividade organizada pela equipe para acompanhamento da turma.</p>
            <div className="activity-card__meta">
              <span><strong>{activity.questionCount}</strong> questões</span>
              <span><strong>{activity.durationMinutes}</strong> min</span>
            </div>
            <button
              className="button button--primary button--full"
              type="button"
              onClick={() => startClassActivity(activity)}
            >
              Iniciar atividade
            </button>
          </article>
        ))}

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

        <article className="activity-card activity-card--create activity-card--compact activity-card--create-form">
          <div className="activity-card__top">
            <div className="activity-card__plus" aria-hidden="true">+</div>
            <span className="badge">Pessoal</span>
          </div>
          <span className="eyebrow">Prática individual</span>
          <h2>Criar atividade pessoal</h2>
          <form className="activity-create-form" onSubmit={createAndStartPersonalActivity}>
            <label>
              Nome
              <input name="title" value={personalForm.title} onChange={updatePersonalForm} placeholder="Ex.: Revisão de matemática" required />
            </label>
            <div className="form-grid form-grid--compact">
              <label>
                Questões
                <input type="number" min="1" max="60" name="questionCount" value={personalForm.questionCount} onChange={updatePersonalForm} required />
              </label>
              <label>
                Tempo
                <input type="number" min="1" max="300" name="durationMinutes" value={personalForm.durationMinutes} onChange={updatePersonalForm} required />
              </label>
            </div>
            <button className="button button--ghost button--full" type="submit">Criar e iniciar</button>
          </form>
        </article>
      </section>

      {isAdmin ? (
        <section className="notice-card admin-shortcut-card">
          <strong>Acesso administrativo liberado</strong>
          <p>Crie, publique ou oculte atividades no painel administrativo. As atividades publicadas aparecem para os alunos.</p>
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
