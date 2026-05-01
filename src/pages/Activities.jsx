import { APP_CONFIG } from '../config.js';
import { Icon } from '../components/Icon.jsx';
import { startAttempt } from '../services/examService.js';
import { getActivities, getPublishedActivities } from '../services/activityService.js';

export function Activities({ student, session, config, navigate, showToast, refreshAttempt }) {
  const personal = APP_CONFIG.personalActivity;
  const isAdmin = session.role === 'admin';
  const classActivities = isAdmin ? getActivities() : getPublishedActivities();

  function startClassActivity(activity) {
    startAttempt(student, { ...activity, activityType: 'turma' });
    refreshAttempt();
    showToast('Atividade iniciada. Boa prova!');
    navigate('prova');
  }

  function startPersonalActivity() {
    startAttempt(student, { ...personal, classCode: config.classCode, activityType: 'pessoal' });
    refreshAttempt();
    showToast('Atividade pessoal criada. Boa prática!');
    navigate('prova');
  }

  return (
    <>
      <section className="section-header dashboard-header">
        <span className="eyebrow">Área de atividades</span>
        <h1>Olá, {student.name.split(' ')[0]}!</h1>
        <p>
          {isAdmin
            ? 'Veja as atividades criadas no painel administrativo ou teste uma prática individual.'
            : 'Escolha uma atividade liberada pela equipe ou crie uma prática individual para estudar no seu ritmo.'}
        </p>
      </section>

      {!isAdmin && classActivities.length === 0 ? (
        <section className="notice-card notice-card--soft activity-empty-card">
          <strong>Nenhuma atividade da turma publicada no momento</strong>
          <p>{APP_CONFIG.activities.emptyStudentMessage}</p>
        </section>
      ) : null}

      <section className="activity-grid">
        {classActivities.map((activity) => (
          <article className="activity-card activity-card--official" key={activity.id}>
            <div className="activity-card__top">
              <Icon name="classroom" className="activity-card__icon" />
              <span className={`badge ${activity.status === 'published' ? '' : 'badge--muted'}`}>
                {activity.status === 'published' ? 'Atividade publicada' : 'Rascunho do admin'}
              </span>
            </div>
            <h2>{activity.title}</h2>
            <p>Atividade organizada pela equipe do Sementes Digitais para acompanhamento da turma.</p>
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

        <article className="activity-card activity-card--create">
          <div className="activity-card__plus" aria-hidden="true">+</div>
          <span className="eyebrow">Prática individual</span>
          <h2>Criar atividade pessoal</h2>
          <p>Gere uma prática só para você, sem aparecer para outros alunos.</p>
          <div className="activity-card__meta">
            <span><strong>{personal.questionCount}</strong> questões</span>
            <span><strong>{personal.durationMinutes}</strong> min</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={startPersonalActivity}>Criar e iniciar</button>
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
