import { useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '../config.js';
import { mockQuestions } from '../data/mockQuestions.js';
import { getActivityById, getActivityResponses } from '../services/activityService.js';
import { fetchQuestionSetFromEnemDev, getLanguageLabel } from '../services/enemApi.js';

export function AdminResponses({ activityId, navigate }) {
  const activity = getActivityById(activityId);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState('');

  const responses = useMemo(() => (activity ? getActivityResponses(activity.id) : []), [activity?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadQuestions() {
      if (!activity) return;

      setLoadingQuestions(true);
      setQuestionError('');

      try {
        const loadedQuestions = await buildAnswerKey(activity, responses);
        if (!isMounted) return;
        setQuestions(loadedQuestions);
      } catch (error) {
        if (!isMounted) return;
        setQuestionError(error?.message || 'Não foi possível carregar o gabarito do simulado.');
      } finally {
        if (isMounted) setLoadingQuestions(false);
      }
    }

    loadQuestions();

    return () => {
      isMounted = false;
    };
  }, [activity?.id, responses.length]);

  if (!activity) {
    return (
      <section className="section-header admin-responses-page__empty">
        <span className="eyebrow">Painel administrativo</span>
        <h1>Simulado não encontrado</h1>
        <p>Não foi possível localizar esse simulado. Volte para a administração e selecione uma atividade cadastrada.</p>
        <button className="button button--primary" type="button" onClick={() => navigate('admin')}>Voltar para administração</button>
      </section>
    );
  }

  const dashboard = buildDashboard(responses);

  return (
    <>
      <section className="section-header admin-responses-page__header">
        <span className="eyebrow">Respostas do simulado</span>
        <div className="admin-responses-page__title-row">
          <div>
            <h1>{activity.title}</h1>
            <p>
              {activity.questionCount} questões • {activity.durationMinutes} minutos • {formatQuestionSource(activity)} • Criado em {formatDate(activity.createdAt)}
            </p>
          </div>
          <button className="button button--ghost" type="button" onClick={() => navigate('admin')}>Voltar</button>
        </div>
      </section>

      <section className="admin-dashboard-grid" aria-label="Resumo geral do simulado">
        <article className="panel admin-dashboard-card">
          <span>Iniciaram</span>
          <strong>{dashboard.started}</strong>
          <small>Total de alunos que abriram a prova.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>Finalizaram</span>
          <strong>{dashboard.finished}</strong>
          <small>{dashboard.inProgress} em andamento.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>Média geral</span>
          <strong>{dashboard.averageScore}%</strong>
          <small>Considerando apenas provas finalizadas.</small>
        </article>
        <article className="panel admin-dashboard-card">
          <span>Melhor desempenho</span>
          <strong>{dashboard.bestScore}%</strong>
          <small>{dashboard.bestStudent || 'Sem finalizações ainda.'}</small>
        </article>
      </section>

      <section className="panel admin-general-dashboard">
        <div>
          <span className="eyebrow">Dashboard geral</span>
          <h2>Distribuição das respostas</h2>
          <p>Resumo agregado de acertos, erros e questões em branco dos alunos que finalizaram o simulado.</p>
        </div>
        <div className="admin-general-dashboard__bars" aria-label="Distribuição geral de desempenho">
          <MetricBar label="Acertos" value={dashboard.correctCount} total={dashboard.totalFinishedQuestions} />
          <MetricBar label="Erros" value={dashboard.wrongCount} total={dashboard.totalFinishedQuestions} />
          <MetricBar label="Em branco" value={dashboard.blankCount} total={dashboard.totalFinishedQuestions} />
        </div>
      </section>

      <section className="admin-responses-section">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Alunos e resultados</span>
          <h2>Desempenho individual</h2>
          <p>Confira os acertos, erros, questões em branco e o percentual de cada aluno neste simulado.</p>
        </div>

        {responses.length === 0 ? (
          <article className="notice-card notice-card--soft">
            <strong>Nenhum aluno iniciou esta atividade ainda</strong>
            <p>Quando os alunos clicarem em iniciar, eles aparecerão neste painel de respostas.</p>
          </article>
        ) : (
          <div className="admin-response-grid">
            {responses.map((response) => (
              <article className="panel admin-response-card" key={response.attemptId}>
                <div className="admin-response-card__top">
                  <div>
                    <span className={`badge ${response.result ? '' : 'badge--muted'}`}>{formatStatus(response.status)}</span>
                    <h3>{response.student?.name || 'Aluno'}</h3>
                    <p>{response.student?.email || 'E-mail não informado'}</p>
                  </div>
                  <strong className="admin-response-card__score">{response.result ? `${response.scorePercent}%` : '—'}</strong>
                </div>

                <div className="summary-list admin-response-card__info">
                  <span><strong>Telefone:</strong> {response.student?.phone || 'Não informado'}</span>
                  <span><strong>Escola/turma:</strong> {response.student?.classGroup || 'Não informado'}</span>
                  <span><strong>Início:</strong> {formatDateTime(response.startedAt)}</span>
                  <span><strong>Finalização:</strong> {response.submittedAt ? formatDateTime(response.submittedAt) : 'Em andamento'}</span>
                  {response.languageChoice ? <span><strong>Língua:</strong> {getLanguageLabel(response.languageChoice)}</span> : null}
                </div>

                <div className="admin-response-metrics">
                  <span><strong>{response.answeredCount ?? 0}</strong> respondidas</span>
                  <span><strong>{response.correctCount ?? '—'}</strong> acertos</span>
                  <span><strong>{response.wrongCount ?? '—'}</strong> erros</span>
                  <span><strong>{response.blankCount ?? '—'}</strong> em branco</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-answer-key-section">
        <div className="section-header section-header--compact">
          <span className="eyebrow">Gabarito do simulado</span>
          <h2>Questões completas e respostas corretas</h2>
          <p>Lista com enunciado, imagens quando existirem, alternativas e gabarito usado nesta atividade.</p>
        </div>

        {loadingQuestions ? (
          <article className="panel question-loading-card">
            <span className="eyebrow">Banco ENEM</span>
            <h2>Carregando gabarito completo...</h2>
            <p>Buscando as mesmas questões reais configuradas para este simulado.</p>
          </article>
        ) : questionError ? (
          <article className="notice-card notice-card--soft">
            <strong>Gabarito indisponível</strong>
            <p>{questionError}</p>
          </article>
        ) : (
          <div className="admin-answer-key-grid">
            {questions.map((question) => (
              <article className="panel admin-answer-key-card" key={question.id}>
                <div className="admin-answer-key-card__top">
                  <span className="badge">Questão {String(question.number).padStart(2, '0')}</span>
                  <strong>{[question.area, question.year, question.languageLabel].filter(Boolean).join(' • ')}</strong>
                </div>
                {question.context ? <TextBlock text={question.context} /> : null}
                <MediaList files={question.files} label={`Imagem da questão ${question.number}`} />
                {question.statement ? <TextBlock text={question.statement} strong /> : null}
                <div className="admin-answer-key-card__alternatives">
                  {question.alternatives.map((alternative) => (
                    <div className={`admin-answer-key-card__alternative ${alternative.letter === question.correctAlternative ? 'admin-answer-key-card__alternative--correct' : ''}`} key={alternative.letter}>
                      <strong>{alternative.letter}</strong>
                      <span>{sanitizeDisplayText(alternative.text) || 'Alternativa com imagem'}</span>
                      {alternative.file ? <img src={alternative.file} alt={`Imagem da alternativa ${alternative.letter}`} loading="lazy" /> : null}
                    </div>
                  ))}
                </div>
                <div className="admin-answer-key-card__answer">
                  <span>Resposta correta</span>
                  <strong>{question.correctAlternative}) {question.correctText}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MetricBar({ label, value, total }) {
  const percent = total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;

  return (
    <div className="admin-metric-bar">
      <div className="admin-metric-bar__label">
        <strong>{label}</strong>
        <span>{value} • {percent}%</span>
      </div>
      <div className="admin-metric-bar__track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TextBlock({ text, strong = false }) {
  const cleanText = sanitizeDisplayText(text);
  if (!cleanText) return null;

  return (
    <div className={strong ? 'admin-answer-key-card__statement' : 'admin-answer-key-card__text'}>
      {cleanText
        .split('\n')
        .filter(Boolean)
        .map((paragraph, index) => <p key={`${paragraph.slice(0, 18)}-${index}`}>{paragraph}</p>)}
    </div>
  );
}

function MediaList({ files = [], label }) {
  if (!Array.isArray(files) || files.length === 0) return null;

  return (
    <div className="admin-answer-key-card__media">
      {files.map((file, index) => (
        <img key={`${file}-${index}`} src={file} alt={`${label} ${index + 1}`} loading="lazy" />
      ))}
    </div>
  );
}

function sanitizeDisplayText(value = '') {
  return String(value ?? '')
    .replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function buildDashboard(responses) {
  const finished = responses.filter((response) => response.result);
  const totalFinishedQuestions = finished.reduce((total, response) => total + Number(response.totalQuestions || 0), 0);
  const correctCount = finished.reduce((total, response) => total + Number(response.correctCount || 0), 0);
  const wrongCount = finished.reduce((total, response) => total + Number(response.wrongCount || 0), 0);
  const blankCount = finished.reduce((total, response) => total + Number(response.blankCount || 0), 0);
  const scoreSum = finished.reduce((total, response) => total + Number(response.scorePercent || 0), 0);
  const bestResponse = finished.reduce((best, response) => {
    if (!best) return response;
    return Number(response.scorePercent || 0) > Number(best.scorePercent || 0) ? response : best;
  }, null);

  return {
    started: responses.length,
    finished: finished.length,
    inProgress: responses.length - finished.length,
    averageScore: finished.length ? Math.round(scoreSum / finished.length) : 0,
    bestScore: bestResponse ? Number(bestResponse.scorePercent || 0) : 0,
    bestStudent: bestResponse?.student?.name || '',
    totalFinishedQuestions,
    correctCount,
    wrongCount,
    blankCount
  };
}

async function buildAnswerKey(activity, responses) {
  const questionCount = Number(activity?.questionCount || APP_CONFIG.defaultExam.questionCount);
  const savedSnapshot = findSavedQuestionSnapshot(activity, responses);
  const languageChoice = findSavedLanguageChoice(responses) || 'ingles';

  const questions = savedSnapshot.length > 0
    ? savedSnapshot
    : activity.sourceMode === 'mock'
      ? mockQuestions.slice(0, questionCount)
      : await fetchQuestionSetFromEnemDev({
          questionCount,
          examYear: activity.examYear || 'mixed',
          seed: activity.questionSeed || activity.createdAt || activity.id,
          language: languageChoice,
          includeLanguageChoice: activity.requiresLanguageChoice !== false
        });

  return questions.slice(0, questionCount).map((question, index) => ({
    ...question,
    number: index + 1,
    correctText: sanitizeDisplayText(question.alternatives.find((alternative) => alternative.letter === question.correctAlternative)?.text) || 'Alternativa com imagem ou texto não encontrado'
  }));
}

function findSavedLanguageChoice(responses) {
  const response = responses.find((item) => item.languageChoice || item.result?.languageChoice || item.attemptSnapshot?.languageChoice);
  return response?.languageChoice || response?.result?.languageChoice || response?.attemptSnapshot?.languageChoice || '';
}
function findSavedQuestionSnapshot(activity, responses) {
  if (Array.isArray(activity?.questionsSnapshot) && activity.questionsSnapshot.length > 0) return activity.questionsSnapshot;

  const responseWithQuestions = responses.find((response) =>
    Array.isArray(response?.attemptSnapshot?.questionsSnapshot) && response.attemptSnapshot.questionsSnapshot.length > 0
  );
  if (responseWithQuestions) return responseWithQuestions.attemptSnapshot.questionsSnapshot;

  const resultWithQuestions = responses.find((response) =>
    Array.isArray(response?.result?.questionsSnapshot) && response.result.questionsSnapshot.length > 0
  );
  if (resultWithQuestions) return resultWithQuestions.result.questionsSnapshot;

  return [];
}

function formatQuestionSource(activity) {
  if (activity.sourceMode === 'mock') return 'Banco interno';
  return activity.examYear === 'mixed' || !activity.examYear ? 'API ENEM • anos mistos' : `API ENEM • ${activity.examYear}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatStatus(status) {
  const labels = {
    em_andamento: 'Em andamento',
    finalizada: 'Finalizada',
    expirada: 'Expirada'
  };
  return labels[status] || status || '—';
}
