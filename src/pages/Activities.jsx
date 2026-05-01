import { APP_CONFIG } from '../config.js';
import { Icon } from '../components/Icon.jsx';
import { startAttempt } from '../services/examService.js';

export function Activities({ student, session, config, navigate, showToast, refreshAttempt }) {
  const personal = APP_CONFIG.personalActivity;

  function startOfficialActivity() {
    startAttempt(student, { ...config, activityType: 'turma' });
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
        <p>Escolha uma atividade liberada pela equipe ou crie uma prática individual para estudar no seu ritmo.</p>
      </section>

      <section className="activity-grid">
        <article className="activity-card activity-card--official">
          <div className="activity-card__top">
            <Icon name="classroom" className="activity-card__icon" />
            <span className="badge">Atividade da turma</span>
          </div>
          <h2>{config.title}</h2>
          <p>Simulado organizado pela equipe do Sementes Digitais para acompanhamento da turma.</p>
          <div className="activity-card__meta">
            <span><strong>{config.questionCount}</strong> questões</span>
            <span><strong>{config.durationMinutes}</strong> min</span>
          </div>
          <button className="button button--primary button--full" type="button" onClick={startOfficialActivity}>Iniciar atividade</button>
        </article>

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

      {session.role === 'admin' ? (
        <section className="notice-card admin-shortcut-card">
          <strong>Acesso administrativo liberado</strong>
          <p>Sua conta tem permissão para acessar o painel de configuração das atividades.</p>
          <button className="button button--primary" type="button" onClick={() => navigate('admin')}>Abrir painel administrativo</button>
        </section>
      ) : null}
    </>
  );
}
