import { APP_CONFIG } from './config.js';
import { essayThemes } from './data/essayThemes.js';
import { renderQuestionCard } from './components/questionCard.js';
import { renderProgress } from './components/progress.js';
import { renderTimer } from './components/timer.js';
import { emptyState, shell } from './components/layout.js';
import { showToast } from './components/toast.js';
import { formatSeconds, secondsUntil } from './utils/timer.js';
import { isValidCpfShape, isValidEmail, isValidPhoneShape, onlyDigits } from './utils/validators.js';
import {
  finalizeAttempt,
  getAnswers,
  getCurrentAttempt,
  getEssay,
  getExamConfig,
  getExamQuestions,
  getResult,
  getSelectedTheme,
  saveAnswer,
  saveEssay,
  saveExamConfig,
  startAttempt
} from './services/examService.js';
import { load, save } from './services/storage.js';

let timerInterval = null;
let currentQuestionIndex = 0;

export function renderHome() {
  clearTimer();
  const config = getExamConfig();
  const content = `
    <section class="hero">
      <div class="hero__content">
        <span class="eyebrow">${APP_CONFIG.organization} apresenta</span>
        <h1>Simulados ENEM para o projeto <span>Sementes Digitais</span></h1>
        <p>
          Um MVP simples, moderno e com cara escolar para cadastro de alunos,
          resolução de questões, redação e prova com cronômetro.
        </p>
        <div class="hero__actions">
          <a class="button button--primary" href="#cadastro">Começar como aluno</a>
          <a class="button button--ghost" href="#admin">Configurar simulado</a>
        </div>
      </div>

      <aside class="hero-card">
        <div class="hero-card__top">
          <span class="hero-card__icon">📚</span>
          <span class="badge">MVP 01</span>
        </div>
        <h2>${config.title}</h2>
        <ul class="feature-list">
          <li><strong>${config.questionCount}</strong> questões objetivas</li>
          <li><strong>${config.durationMinutes}</strong> minutos de prova</li>
          <li>Redação com tema selecionado</li>
          <li>Salvamento local automático</li>
        </ul>
      </aside>
    </section>

    <section class="grid three-columns">
      <article class="info-card">
        <span class="info-card__icon">🧑‍🎓</span>
        <h3>Cadastro rápido</h3>
        <p>Identificação do aluno por nome, e-mail, telefone, CPF e código da turma.</p>
      </article>
      <article class="info-card">
        <span class="info-card__icon">⏱️</span>
        <h3>Prova cronometrada</h3>
        <p>O cronômetro acompanha a tentativa e a prova pode ser finalizada ou expirada.</p>
      </article>
      <article class="info-card">
        <span class="info-card__icon">📝</span>
        <h3>Redação integrada</h3>
        <p>O aluno visualiza textos motivadores e salva a redação junto com a prova.</p>
      </article>
    </section>

    <section class="notice-card">
      <strong>${APP_CONFIG.slogan}</strong>
      <p>Essa primeira versão é focada em layout, experiência e organização modular. O backend entra na próxima etapa para segurança do gabarito e dados reais.</p>
    </section>
  `;

  return shell(content, 'home');
}

export function renderCadastro() {
  clearTimer();
  const student = load('student', {});
  const config = getExamConfig();

  const content = `
    <section class="section-header">
      <span class="eyebrow">Área do aluno</span>
      <h1>Cadastro rápido</h1>
      <p>Preencha seus dados para iniciar o simulado. Para o MVP, os dados ficam salvos apenas no navegador.</p>
    </section>

    <section class="form-layout">
      <form class="panel form-card" id="student-form">
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
          CPF
          <input name="cpf" value="${student.cpf ?? ''}" placeholder="000.000.000-00" required />
          <small>No produto final, recomenda-se tratar CPF com validação e proteção no backend.</small>
        </label>

        <label>
          Escola ou turma
          <input name="classGroup" value="${student.classGroup ?? ''}" placeholder="Ex.: Sementes Digitais — Turma A" />
        </label>

        <label>
          Código da atividade
          <input name="classCode" value="${student.classCode ?? config.classCode}" placeholder="Código informado pelo professor" required />
        </label>

        <label class="check-row">
          <input type="checkbox" name="terms" ${student.terms ? 'checked' : ''} required />
          <span>Confirmo que desejo participar do simulado e aceito o uso dos dados para fins educacionais.</span>
        </label>

        <button class="button button--primary button--full" type="submit">Salvar e iniciar prova</button>
      </form>

      <aside class="panel side-note">
        <h2>Antes de começar</h2>
        <p>O simulado ativo é <strong>${config.title}</strong>. Após iniciar, o cronômetro começa e suas respostas serão salvas automaticamente.</p>
        <div class="mini-stats">
          <span><strong>${config.questionCount}</strong> questões</span>
          <span><strong>${config.durationMinutes}</strong> min</span>
          <span><strong>1</strong> redação</span>
        </div>
      </aside>
    </section>
  `;

  window.queueMicrotask(() => setupCadastroEvents(config));
  return shell(content, 'cadastro');
}

function setupCadastroEvents(config) {
  const form = document.querySelector('#student-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const student = Object.fromEntries(formData.entries());

    if (!isValidEmail(student.email)) {
      showToast('Informe um e-mail válido.', 'error');
      return;
    }

    if (!isValidPhoneShape(student.phone)) {
      showToast('Informe um telefone válido com DDD.', 'error');
      return;
    }

    if (!isValidCpfShape(student.cpf)) {
      showToast('Informe um CPF com 11 dígitos.', 'error');
      return;
    }

    if (student.classCode.trim().toUpperCase() !== config.classCode.toUpperCase()) {
      showToast('Código da atividade incorreto.', 'error');
      return;
    }

    const normalizedStudent = {
      name: student.name.trim(),
      email: student.email.trim(),
      phone: student.phone.trim(),
      cpf: onlyDigits(student.cpf),
      classGroup: student.classGroup.trim(),
      classCode: student.classCode.trim().toUpperCase(),
      terms: Boolean(student.terms),
      createdAt: new Date().toISOString()
    };

    save('student', normalizedStudent);
    startAttempt(normalizedStudent);
    showToast('Cadastro salvo. Boa prova!');
    window.location.hash = '#prova';
  });
}

export function renderAdmin() {
  clearTimer();
  const config = getExamConfig();
  const selectedTheme = getSelectedTheme();
  const content = `
    <section class="section-header">
      <span class="eyebrow">Painel administrativo</span>
      <h1>Configurar simulado</h1>
      <p>Esta tela simula o painel do professor/admin para definir tempo, quantidade de questões e tema de redação.</p>
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
          Tema da redação
          <select name="essayThemeId">
            ${essayThemes
              .map((theme) => `<option value="${theme.id}" ${theme.id === selectedTheme.id ? 'selected' : ''}>${theme.title}</option>`)
              .join('')}
          </select>
        </label>

        <label>
          Fonte de questões
          <select name="sourceMode">
            <option value="mock" selected>Dados simulados do MVP</option>
            <option value="enem-dev" disabled>API enem.dev — preparada para backend</option>
          </select>
          <small>A integração real deve passar pelo backend para não expor gabarito.</small>
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
          <span><strong>Redação:</strong> ${selectedTheme.title}</span>
        </div>
        <a class="button button--ghost button--full" href="#cadastro">Testar como aluno</a>
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
        title: 'Você ainda não iniciou uma tentativa.',
        description: 'Faça o cadastro rápido para liberar a prova e iniciar o cronômetro.',
        actionLabel: 'Ir para cadastro',
        actionHref: '#cadastro'
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
  const essay = getEssay();
  const theme = getSelectedTheme();
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
            <span class="eyebrow">${attempt.examTitle}</span>
            <h1>Olá, ${attempt.student.name.split(' ')[0]}!</h1>
          </div>
          <button class="button button--danger" id="finish-exam">Finalizar prova</button>
        </div>

        ${renderQuestionCard(currentQuestion, answers[currentQuestion.id]?.selectedAlternative)}

        <div class="exam-actions">
          <button class="button button--ghost" id="previous-question" ${currentQuestionIndex === 0 ? 'disabled' : ''}>Anterior</button>
          <button class="button button--primary" id="next-question" ${currentQuestionIndex === questions.length - 1 ? 'disabled' : ''}>Próxima</button>
        </div>

        <article class="essay-card panel">
          <div class="essay-card__header">
            <span class="badge">Redação</span>
            <span>${theme.axis}</span>
          </div>
          <h2>${theme.title}</h2>
          ${theme.supportTexts.map((text) => `<p class="support-text">${text}</p>`).join('')}
          <p class="proposal">${theme.proposal}</p>
          <textarea id="essay-content" rows="12" placeholder="Digite sua redação aqui...">${essay}</textarea>
          <small>A redação é salva automaticamente neste navegador.</small>
        </article>
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

  const essayTextarea = document.querySelector('#essay-content');
  essayTextarea?.addEventListener('input', (event) => {
    saveEssay(event.target.value);
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
        actionLabel: 'Ir para cadastro',
        actionHref: '#cadastro'
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
        <span>acertos</span>
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
        <span>Redação</span>
        <strong>${result.essaySaved ? 'Salva' : 'Vazia'}</strong>
      </article>
    </section>

    <section class="notice-card">
      <strong>Observação do MVP</strong>
      <p>Esta correção é demonstrativa com dados simulados. No projeto real, a correção das objetivas deve acontecer no backend, sem expor o gabarito para o aluno.</p>
      <div class="hero__actions">
        <a class="button button--primary" href="#admin">Configurar novo simulado</a>
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
