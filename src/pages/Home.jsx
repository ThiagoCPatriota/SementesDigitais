import { APP_CONFIG } from '../config.js';
import { Icon } from '../components/Icon.jsx';

export function Home({ config, navigate }) {
  return (
    <>
      <section className="hero hero--institutional">
        <div className="hero__content">
          <span className="eyebrow">{APP_CONFIG.organization} apresenta</span>
          <h1>Simulados ENEM para o projeto <span>Sementes Digitais</span></h1>
          <p>
            Um ambiente de preparação para estudantes praticarem questões objetivas,
            administrarem o tempo de prova e acompanharem sua evolução com uma experiência
            clara, acolhedora e educacional.
          </p>
          <div className="hero__actions">
            <button className="button button--primary" type="button" onClick={() => navigate('acesso')}>Começar</button>
          </div>

          <div className="hero__highlights" aria-label="Destaques da plataforma">
            <span><Icon name="target" className="highlight-icon" /> Preparação ENEM</span>
            <span><Icon name="timer" className="highlight-icon" /> Cronômetro e foco</span>
            <span><Icon name="chart" className="highlight-icon" /> Acompanhamento de desempenho</span>
          </div>
        </div>

        <aside className="hero-card hero-card--exam">
          <div className="hero-card__top">
            <Icon name="books" className="hero-card__icon" />
            <span className="badge">Simulado Exemplo</span>
          </div>
          <div>
            <span className="eyebrow">Atividade atual</span>
            <h2>{config.title}</h2>
          </div>
          <ul className="feature-list feature-list--icons">
            <li><Icon name="classroom" className="feature-list__icon" /> <span><strong>{config.questionCount}</strong> questões objetivas</span></li>
            <li><Icon name="timer" className="feature-list__icon" /> <span><strong>{config.durationMinutes}</strong> minutos de prova</span></li>
            <li><Icon name="student" className="feature-list__icon" /> <span>Acesso por código da atividade</span></li>
            <li><Icon name="seed" className="feature-list__icon" /> <span>Respostas salvas automaticamente</span></li>
          </ul>

          <div className="question-bank-callout">
            <span>Base de referência</span>
            <strong>{APP_CONFIG.questionBankLabel}</strong>
            <small>conteúdo organizado para prática e simulados</small>
          </div>
        </aside>
      </section>

      <section className="grid three-columns home-card-grid">
        <article className="info-card info-card--featured">
          <Icon name="student" className="info-card__icon" />
          <h3>Entrada simples para estudantes</h3>
          <p>Cadastro direto com os dados essenciais e acesso por código informado pela equipe do projeto.</p>
        </article>
        <article className="info-card info-card--featured">
          <Icon name="timer" className="info-card__icon" />
          <h3>Ritmo de prova organizado</h3>
          <p>Cronômetro, mapa de questões e salvamento automático ajudam o aluno a manter foco durante o simulado.</p>
        </article>
        <article className="info-card info-card--featured">
          <Icon name="books" className="info-card__icon" />
          <h3>Questões em ambiente focado</h3>
          <p>O estudante visualiza a questão completa, navega com facilidade e responde tudo no mesmo ambiente.</p>
        </article>
      </section>

      <section className="notice-card notice-card--institutional">
        <div className="notice-card__icon-wrap"><Icon name="seed" className="notice-card__icon" /></div>
        <div>
          <strong>{APP_CONFIG.slogan}</strong>
          <p>O Sementes Digitais une prática, acompanhamento e tecnologia para apoiar trajetórias de aprendizagem com mais clareza e autonomia.</p>
        </div>
      </section>
    </>
  );
}
