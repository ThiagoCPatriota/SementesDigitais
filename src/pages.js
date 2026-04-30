import { APP_CONFIG } from './config.js';
import { renderQuestionCard } from './components/questionCard.js';
import { renderProgress } from './components/progress.js';
import { renderTimer } from './components/timer.js';
import { icon } from './components/icons.js';
import { emptyState, shell } from './components/layout.js';
import { showToast } from './components/toast.js';
import { formatSeconds, secondsUntil } from './utils/timer.js';
import { isValidEmail, isValidPhoneShape } from './utils/validators.js';
import {
  finalizeAttempt,
  getAnswers,
  getCurrentAttempt,
  getExamConfig,
  getExamQuestions,
  getResult,
  saveAnswer,
  saveExamConfig,
  startAttempt
} from './services/examService.js';
import { load, save } from './services/storage.js';
import {
  isCurrentAdmin,
  loginStudentAccount,
  registerStudentAccount,
  saveAuthSession
} from './services/authService.js';

let timerInterval = null;
let currentQuestionIndex = 0;

export function renderHome() {
  clearTimer();
  const config = getExamConfig();
  const content = `
    <section class="hero hero--institutional">
      <div class="hero__content">
        <span class="eyebrow">${APP_CONFIG.organization} apresenta</span>
        <h1>Simulados ENEM para o projeto <span>Sementes Digitais</span></h1>
        <p>
          Um ambiente de preparação para estudantes praticarem questões objetivas,
          administrarem o tempo de prova e acompanharem sua evolução com uma experiência
          clara, acolhedora e educacional.
        </p>
        <div class="hero__actions">
          <a class="button button--primary" href="#cadastro">Começar</a>
        </div>

        <div class="hero__highlights" aria-label="Destaques da plataforma">
          <span>${icon('target', 'highlight-icon')} Preparação ENEM</span>
          <span>${icon('timer', 'highlight-icon')} Cronômetro e foco</span>
          <span>${icon('chart', 'highlight-icon')} Acompanhamento de desempenho</span>
        </div>
      </div>

      <aside class="hero-card hero-card--exam">
        <div class="hero-card__top">
          ${icon('books', 'hero-card__icon')}
          <span class="badge">Simulado disponível</span>
        </div>
        <div>
          <span class="eyebrow">Atividade atual</span>
          <h2>${config.title}</h2>
        </div>
        <ul class="feature-list feature-list--icons">
          <li>${icon('classroom', 'feature-list__icon')} <span><strong>${config.questionCount}</strong> questões objetivas</span></li>
          <li>${icon('timer', 'feature-list__icon')} <span><strong>${config.durationMinutes}</strong> minutos de prova</span></li>
          <li>${icon('student', 'feature-list__icon')} <span>Acesso por código da atividade</span></li>
          <li>${icon('seed', 'feature-list__icon')} <span>Respostas salvas automaticamente</span></li>
        </ul>

        <div class="question-bank-callout">
          <span>Base de referência</span>
          <strong>${APP_CONFIG.questionBankLabel}</strong>
          <small>conteúdo organizado para prática e simulados</small>
        </div>
      </aside>
    </section>

    <section class="grid three-columns home-card-grid">
      <article class="info-card info-card--featured">
        ${icon('student', 'info-card__icon')}
        <h3>Entrada simples para estudantes</h3>
        <p>Cadastro direto com os dados essenciais e acesso por código informado pela equipe do projeto.</p>
      </article>
      <article class="info-card info-card--featured">
        ${icon('timer', 'info-card__icon')}
        <h3>Ritmo de prova organizado</h3>
        <p>Cronômetro, mapa de questões e salvamento automático ajudam o aluno a manter foco durante o simulado.</p>
      </article>
      <article class="info-card info-card--featured">
        ${icon('books', 'info-card__icon')}
        <h3>Questões em ambiente focado</h3>
        <p>O estudante visualiza a questão completa, navega com facilidade e responde tudo no mesmo ambiente.</p>
      </article>
    </section>

    <section class="notice-card notice-card--institutional">
      <div class="notice-card__icon-wrap">${icon('seed', 'notice-card__icon')}</div>
      <div>
        <strong>${APP_CONFIG.slogan}</strong>
        <p>O Sementes Digitais une prática, acompanhamento e tecnologia para apoiar trajetórias de aprendizagem com mais clareza e autonomia.</p>
      </div>
    </section>
  `;

  return shell(content, 'home');
}

export function renderCadastro() {
  clearTimer();
  const student = load('student', {});
  const config = getExamConfig();

  const content = `
    <section class="section-header section-header--auth">
      <span class="eyebrow">Área do aluno</span>
      <h1>Acesso do estudante</h1>
      <p>Crie sua conta ou entre novamente para visualizar as atividades disponíveis.</p>
      <div class="auth-tabs" role="tablist" aria-label="Cadastro ou login">
        <button class="auth-tabs__button auth-tabs__button--active" type="button" data-auth-tab="register">Cadastro</button>
        <button class="auth-tabs__button" type="button" data-auth-tab="login">Login</button>
      </div>
    </section>

    <section class="form-layout">
      <form class="panel form-card auth-panel" id="student-register-form" data-auth-panel="register">
        <div class="form-card__intro">
          <h2>Criar conta</h2>
          <p>Use seus dados principais para acessar os simulados da turma.</p>
        </div>

        <label>
          Nome completo
          <input name="name" value="${student.name ?? ''}" placeholder="Ex.: Maria Eduarda Silva" required />
        </label>

        <label>
          E-mail
          <input type="email" name="email" value="${student.email ?? ''}" placeholder="aluno@email.com" required />
        </label>

        <label>
          WhatsApp/telefone
          <input name="phone" value="${student.phone ?? ''}" placeholder="(81) 99999-9999" required />
        </label>

        <label>
          Escola ou turma
          <input name="classGroup" value="${student.classGroup ?? ''}" placeholder="Ex.: Sementes Digitais — Turma A" />
        </label>

        <label>
          Senha
          <input type="password" name="password" placeholder="Crie uma senha de acesso" minlength="6" required />
        </label>

        <label>
          Código da atividade
          <input name="classCode" value="${student.classCode ?? config.classCode}" placeholder="Código informado pela equipe" required />
        </label>

        <label class="check-row">
          <input type="checkbox" name="terms" ${student.terms ? 'checked' : ''} required />
          <span>Confirmo que desejo participar do simulado e aceito o uso dos dados para fins educacionais.</span>
        </label>

        <button class="button button--primary button--full" type="submit">Criar conta</button>
      </form>

      <form class="panel form-card auth-panel auth-panel--hidden" id="student-login-form" data-auth-panel="login">
        <div class="form-card__intro">
          <h2>Entrar na conta</h2>
          <p>Use seu e-mail e senha para acessar suas atividades.</p>
        </div>

        <label>
          E-mail
          <input type="email" name="email" value="${student.email ?? ''}" placeholder="aluno@email.com" required />
        </label>

        <label>
          Senha
          <input type="password" name="password" placeholder="Sua senha de acesso" required />
        </label>

        <label>
          Código da atividade
          <input name="classCode" value="${student.classCode ?? config.classCode}" placeholder="Código informado pela equipe" required />
        </label>

        <button class="button button--primary button--full" type="submit">Entrar</button>
        <small class="form-help">Se a conta for administrativa, a aba de administrador será liberada após o login.</small>
      </form>

      <aside class="panel side-note">
        <h2>Depois do acesso</h2>
        <p>Você verá uma área com as atividades liberadas pela equipe e uma opção para criar uma prática pessoal.</p>
        <div class="mini-stats">
          <span><strong>${config.questionCount}</strong> questões</span>
          <span><strong>${config.durationMinutes}</strong> min</span>
          <span><strong>2700+</strong> itens</span>
        </div>
      </aside>
    </section>
  `;

  window.queueMicrotask(() => setupCadastroEvents(config));
  return shell(content, 'cadastro');
}

function setupCadastroEvents(config) {
  setupAuthTabs();

  const registerForm = document.querySelector('#student-register-form');
  const loginForm = document.querySelector('#student-login-form');

  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const student = Object.fromEntries(new FormData(registerForm).entries());

    if (!validateAuthData(student, config, { requireName: true, requirePhone: true })) return;

    try {
      const result = await registerStudentAccount({
        name: student.name.trim(),
        email: student.email.trim(),
        phone: student.phone.trim(),
        classGroup: student.classGroup.trim(),
        password: student.password
      });

      persistAuthenticatedAccess(result, {
        classCode: student.classCode.trim().toUpperCase(),
        terms: Boolean(student.terms)
      });

      const message = result.needsEmailConfirmation
        ? 'Conta criada. Verifique seu e-mail quando possível.'
        : 'Conta criada com sucesso.';
      showToast(message);
      window.location.hash = '#atividades';
    } catch (error) {
      showToast(error.message || 'Não foi possível criar a conta.', 'error');
    }
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const credentials = Object.fromEntries(new FormData(loginForm).entries());

    if (!validateAuthData(credentials, config, { requireName: false, requirePhone: false })) return;

    try {
      const result = await loginStudentAccount({
        email: credentials.email.trim(),
        password: credentials.password
      });

      const session = persistAuthenticatedAccess(result, {
        classCode: credentials.classCode.trim().toUpperCase(),
        terms: true
      });

      if (session.role === 'admin') {
        showToast('Login administrativo realizado.');
        window.location.hash = '#admin';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }

      showToast('Login realizado. Escolha uma atividade.');
      window.location.hash = '#atividades';
    } catch (error) {
      showToast(error.message || 'Não foi possível fazer login.', 'error');
    }
  });
}

function setupAuthTabs() {
  const buttons = document.querySelectorAll('[data-auth-tab]');
  const panels = document.querySelectorAll('[data-auth-panel]');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedTab = button.dataset.authTab;
      buttons.forEach((item) => item.classList.toggle('auth-tabs__button--active', item === button));
      panels.forEach((panel) => panel.classList.toggle('auth-panel--hidden', panel.dataset.authPanel !== selectedTab));
    });
  });
}

function validateAuthData(data, config, { requireName, requirePhone }) {
  if (requireName && !data.name?.trim()) {
    showToast('Informe seu nome completo.', 'error');
    return false;
  }

  if (!isValidEmail(data.email)) {
    showToast('Informe um e-mail válido.', 'error');
    return false;
  }

  if (requirePhone && !isValidPhoneShape(data.phone)) {
    showToast('Informe um telefone válido com DDD.', 'error');
    return false;
  }

  if (!data.password || data.password.length < 6) {
    showToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
    return false;
  }

  if (data.classCode.trim().toUpperCase() !== config.classCode.toUpperCase()) {
    showToast('Código da atividade incorreto.', 'error');
    return false;
  }

  return true;
}

function persistAuthenticatedAccess(authResult, { classCode, terms }) {
  const student = authResult.student;
  const normalizedStudent = {
    name: student.name?.trim() || student.email.split('@')[0],
    email: student.email.trim(),
    phone: student.phone?.trim() || '',
    classGroup: student.classGroup?.trim() || '',
    classCode,
    terms: Boolean(terms),
    authUserId: student.authUserId ?? null,
    createdAt: new Date().toISOString()
  };

  save('student', normalizedStudent);
  return saveAuthSession({
    student: normalizedStudent,
    role: authResult.role || 'student',
    provider: authResult.provider || 'local'
  });
}

export function renderAtividades() {
  clearTimer();
  const student = load('student', null);
  const session = load('authSession', null);
  const config = getExamConfig();
  const personal = APP_CONFIG.personalActivity;

  if (!student || !session) {
    return shell(
      emptyState({
        title: 'Acesse sua conta para ver as atividades.',
        description: 'Faça cadastro ou login para visualizar simulados disponíveis e práticas pessoais.',
        actionLabel: 'Ir para acesso',
        actionHref: '#cadastro'
      }),
      'atividades'
    );
  }

  const content = `
    <section class="section-header dashboard-header">
      <span class="eyebrow">Área de atividades</span>
      <h1>Olá, ${student.name.split(' ')[0]}!</h1>
      <p>Escolha uma atividade liberada pela equipe ou crie uma prática individual para estudar no seu ritmo.</p>
    </section>

    <section class="activity-grid">
      <article class="activity-card activity-card--official">
        <div class="activity-card__top">
          ${icon('classroom', 'activity-card__icon')}
          <span class="badge">Atividade da turma</span>
        </div>
        <h2>${config.title}</h2>
        <p>Simulado organizado pela equipe do Sementes Digitais para acompanhamento da turma.</p>
        <div class="activity-card__meta">
          <span><strong>${config.questionCount}</strong> questões</span>
          <span><strong>${config.durationMinutes}</strong> min</span>
        </div>
        <button class="button button--primary button--full" type="button" data-start-activity="official">Iniciar atividade</button>
      </article>

      <article class="activity-card activity-card--create">
        <div class="activity-card__plus" aria-hidden="true">+</div>
        <span class="eyebrow">Prática individual</span>
        <h2>Criar atividade pessoal</h2>
        <p>Gere uma prática só para você, sem aparecer para outros alunos.</p>
        <div class="activity-card__meta">
          <span><strong>${personal.questionCount}</strong> questões</span>
          <span><strong>${personal.durationMinutes}</strong> min</span>
        </div>
        <button class="button button--ghost button--full" type="button" data-start-activity="personal">Criar e iniciar</button>
      </article>
    </section>

    ${session.role === 'admin'
      ? `<section class="notice-card admin-shortcut-card">
          <strong>Acesso administrativo liberado</strong>
          <p>Sua conta tem permissão para acessar o painel de configuração das atividades.</p>
          <a class="button button--primary" href="#admin">Abrir painel administrativo</a>
        </section>`
      : ''}
  `;

  window.queueMicrotask(() => setupAtividadesEvents(student, config));
  return shell(content, 'atividades');
}

function setupAtividadesEvents(student, config) {
  document.querySelector('[data-start-activity="official"]')?.addEventListener('click', () => {
    currentQuestionIndex = 0;
    startAttempt(student, {
      ...config,
      activityType: 'turma'
    });
    showToast('Atividade iniciada. Boa prova!');
    window.location.hash = '#prova';
  });

  document.querySelector('[data-start-activity="personal"]')?.addEventListener('click', () => {
    currentQuestionIndex = 0;
    startAttempt(student, {
      ...APP_CONFIG.personalActivity,
      classCode: config.classCode,
      activityType: 'pessoal'
    });
    showToast('Atividade pessoal criada. Boa prática!');
    window.location.hash = '#prova';
  });
}

export function renderAdmin() {
  clearTimer();

  if (!isCurrentAdmin()) {
    return shell(
      emptyState({
        title: 'Acesso restrito ao administrador.',
        description: 'Entre com uma conta administrativa para liberar esta área.',
        actionLabel: 'Ir para login',
        actionHref: '#cadastro'
      }),
      'admin'
    );
  }

  const config = getExamConfig();
  const content = `
    <section class="section-header">
      <span class="eyebrow">Painel administrativo</span>
      <h1>Configurar simulado</h1>
      <p>Painel do professor para definir tempo, quantidade de questões e código de acesso.</p>
    </section>

    <section class="form-layout">
      <form class="panel form-card" id="exam-form">
        <label>
          Nome da atividade
          <input name="title" value="${config.title}" required />
        </label>

        <div class="form-grid">
          <label>
            Quantidade de questões
            <input type="number" min="5" max="60" name="questionCount" value="${config.questionCount}" required />
          </label>

          <label>
            Duração em minutos
            <input type="number" min="1" max="300" name="durationMinutes" value="${config.durationMinutes}" required />
          </label>
        </div>

        <label>
          Código da atividade
          <input name="classCode" value="${config.classCode}" required />
        </label>

        <label>
          Fonte de questões
          <select name="sourceMode">
            <option value="mock" ${config.sourceMode === 'mock' ? 'selected' : ''}>Banco interno de questões</option>
            <option value="enem-dev" ${config.sourceMode === 'enem-dev' ? 'selected' : ''} disabled>API enem.dev — integração futura</option>
          </select>
          <small>Na versão com backend, o gabarito deve ficar protegido no servidor.</small>
        </label>

        <button class="button button--primary button--full" type="submit">Salvar configuração</button>
      </form>

      <aside class="panel side-note">
        <h2>Resumo atual</h2>
        <div class="summary-list">
          <span><strong>Atividade:</strong> ${config.title}</span>
          <span><strong>Questões:</strong> ${config.questionCount}</span>
          <span><strong>Tempo:</strong> ${config.durationMinutes} minutos</span>
          <span><strong>Código:</strong> ${config.classCode}</span>
          <span><strong>Formato:</strong> prova objetiva</span>
        </div>
        <a class="button button--ghost button--full" href="#atividades">Ver área de atividades</a>
      </aside>
    </section>
  `;

  window.queueMicrotask(setupAdminEvents);
  return shell(content, 'admin');
}

function setupAdminEvents() {
  const form = document.querySelector('#exam-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    saveExamConfig(data);
    currentQuestionIndex = 0;
    showToast('Configuração salva. A tentativa anterior foi reiniciada.');
    window.location.hash = '#admin';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

export function renderProva() {
  const attempt = getCurrentAttempt();
  if (!attempt) {
    clearTimer();
    return shell(
      emptyState({
        title: 'Você ainda não iniciou uma atividade.',
        description: 'Escolha uma atividade disponível para liberar a prova e iniciar o cronômetro.',
        actionLabel: 'Ir para atividades',
        actionHref: '#atividades'
      }),
      'prova'
    );
  }

  const result = getResult();
  if (result) {
    clearTimer();
    window.queueMicrotask(() => {
      window.location.hash = '#resultado';
    });
    return shell(emptyState({ title: 'Prova já finalizada.', description: 'Você será redirecionado para o resultado.' }), 'prova');
  }

  const questions = getExamQuestions();
  const answers = getAnswers();
  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];
  const answeredCount = Object.keys(answers).length;

  const content = `
    <section class="exam-layout">
      <aside class="exam-sidebar">
        ${renderTimer(attempt.deadlineAt)}
        ${renderProgress({ answeredCount, totalQuestions: questions.length })}

        <div class="question-map panel">
          <h2>Mapa da prova</h2>
          <div class="question-map__grid">
            ${questions
              .map((question, index) => {
                const isActive = index === currentQuestionIndex ? 'question-map__button--active' : '';
                const isAnswered = answers[question.id] ? 'question-map__button--answered' : '';
                return `<button class="question-map__button ${isActive} ${isAnswered}" data-question-index="${index}">${index + 1}</button>`;
              })
              .join('')}
          </div>
        </div>
      </aside>

      <section class="exam-main">
        <div class="exam-toolbar panel">
          <div>
            <span class="eyebrow">${attempt.activityType === 'pessoal' ? 'Atividade pessoal' : 'Atividade da turma'}</span>
            <h1>${attempt.examTitle}</h1>
          </div>
          <button class="button button--danger" id="finish-exam">Finalizar prova</button>
        </div>

        ${renderQuestionCard(currentQuestion, answers[currentQuestion.id]?.selectedAlternative)}

        <div class="exam-actions">
          <button class="button button--ghost" id="previous-question" ${currentQuestionIndex === 0 ? 'disabled' : ''}>Anterior</button>
          <button class="button button--primary" id="next-question" ${currentQuestionIndex === questions.length - 1 ? 'disabled' : ''}>Próxima</button>
        </div>
      </section>
    </section>
  `;

  window.queueMicrotask(() => setupExamEvents(attempt));
  return shell(content, 'prova');
}

function setupExamEvents(attempt) {
  const questions = getExamQuestions();
  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];

  document.querySelectorAll('.question-map__button').forEach((button) => {
    button.addEventListener('click', () => {
      currentQuestionIndex = Number(button.dataset.questionIndex);
      rerender();
    });
  });

  document.querySelectorAll(`input[name="question-${currentQuestion.id}"]`).forEach((input) => {
    input.addEventListener('change', (event) => {
      saveAnswer(currentQuestion.id, event.target.value);
      showToast('Resposta salva automaticamente.');
      rerender();
    });
  });

  document.querySelector('#previous-question')?.addEventListener('click', () => {
    currentQuestionIndex = Math.max(0, currentQuestionIndex - 1);
    rerender();
  });

  document.querySelector('#next-question')?.addEventListener('click', () => {
    currentQuestionIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    rerender();
  });

  document.querySelector('#finish-exam')?.addEventListener('click', () => {
    const confirmFinish = confirm('Deseja finalizar a prova agora? Depois disso, não será possível editar as respostas.');
    if (!confirmFinish) return;
    finalizeAttempt('manual');
    showToast('Prova finalizada com sucesso.');
    window.location.hash = '#resultado';
  });

  startTimer(attempt.deadlineAt);
}

function startTimer(deadlineAt) {
  clearTimer();
  timerInterval = window.setInterval(() => {
    const timerElement = document.querySelector('[data-timer]');
    const remaining = secondsUntil(deadlineAt);

    if (timerElement) {
      timerElement.textContent = formatSeconds(remaining);
      timerElement.closest('.timer')?.classList.toggle('timer--danger', remaining <= 300);
    }

    if (remaining <= 0) {
      clearTimer();
      finalizeAttempt('expired');
      showToast('Tempo encerrado. A prova foi finalizada automaticamente.', 'error');
      window.location.hash = '#resultado';
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function renderResultado() {
  clearTimer();
  const result = getResult();
  const attempt = getCurrentAttempt();

  if (!result || !attempt) {
    return shell(
      emptyState({
        title: 'Nenhum resultado encontrado.',
        description: 'Inicie uma tentativa para gerar o resultado do simulado.',
        actionLabel: 'Ir para atividades',
        actionHref: '#atividades'
      }),
      'resultado'
    );
  }

  const content = `
    <section class="result-hero panel">
      <span class="eyebrow">Resultado do simulado</span>
      <h1>${attempt.examTitle}</h1>
      <p>${attempt.student.name}, sua prova foi ${attempt.status === 'expirada' ? 'encerrada pelo tempo' : 'finalizada manualmente'}.</p>
      <div class="score-circle" aria-label="Nota percentual">
        <strong>${result.scorePercent}%</strong>
        <span>aproveitamento</span>
      </div>
    </section>

    <section class="grid four-columns">
      <article class="stat-card">
        <span>Respondidas</span>
        <strong>${result.answeredCount}</strong>
      </article>
      <article class="stat-card">
        <span>Em branco</span>
        <strong>${result.blankCount}</strong>
      </article>
      <article class="stat-card">
        <span>Acertos</span>
        <strong>${result.correctCount}</strong>
      </article>
      <article class="stat-card">
        <span>Total</span>
        <strong>${result.totalQuestions}</strong>
      </article>
    </section>

    <section class="notice-card">
      <strong>Resultado registrado</strong>
      <p>Sua participação foi registrada. Em uma próxima etapa, o professor poderá acompanhar os resultados da turma em um painel administrativo.</p>
      <div class="hero__actions">
        <a class="button button--primary" href="#atividades">Voltar às atividades</a>
        <a class="button button--ghost" href="#home">Voltar ao início</a>
      </div>
    </section>
  `;

  return shell(content, 'resultado');
}

function rerender() {
  const route = window.location.hash.replace('#', '') || 'home';
  window.dispatchEvent(new CustomEvent('app:rerender', { detail: { route } }));
}
