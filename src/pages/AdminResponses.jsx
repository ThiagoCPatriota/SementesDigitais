import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config.js';
import { mockQuestions } from '../data/mockQuestions.js';
import {
  getActivityById,
  getActivityResponses,
  syncActivitiesFromCloud,
  syncActivityAttemptsFromCloud
} from '../services/activityService.js';
import { getLanguageLabel } from '../services/enemApi.js';
import { fetchQuestionSetFromQuestionBank } from '../services/questionBankService.js';

export function AdminResponses({ activityId, navigate }) {
  const [activity, setActivity] = useState(() => getActivityById(activityId));
  const [responses, setResponses] = useState(() => activity ? getActivityResponses(activity.id) : []);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [selectedResponseIndex, setSelectedResponseIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function syncCloudData() {
      setSyncingCloud(true);
      await Promise.all([syncActivitiesFromCloud(), syncActivityAttemptsFromCloud(activityId)]);
      if (!isMounted) return;
      const nextActivity = getActivityById(activityId);
      setActivity(nextActivity);
      setResponses(nextActivity ? getActivityResponses(nextActivity.id) : []);
      setSyncingCloud(false);
    }

    syncCloudData();

    return () => {
      isMounted = false;
    };
  }, [activityId]);


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

  useEffect(() => {
    setSelectedResponseIndex((current) => {
      if (responses.length === 0) return 0;
      return Math.min(current, responses.length - 1);
    });
  }, [responses.length]);

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
  const selectedResponse = responses[selectedResponseIndex] ?? responses[0] ?? null;

  function goToPreviousStudent() {
    if (responses.length === 0) return;
    setSelectedResponseIndex((current) => (current - 1 + responses.length) % responses.length);
  }

  function goToNextStudent() {
    if (responses.length === 0) return;
    setSelectedResponseIndex((current) => (current + 1) % responses.length);
  }

  return (
    <>
      <section className="section-header admin-responses-page__header">
        <span className="eyebrow">Respostas do simulado</span>
        <div className="admin-responses-page__title-row">
          <div>
            <h1>{activity.title}</h1>
            <p>
              {activity.questionCount} questões base • +5 com Inglês/Espanhol • {activity.durationMinutes} minutos • {formatQuestionSource(activity)} • Criado em {formatDate(activity.createdAt)}
            </p>
            {syncingCloud ? <p className="admin-sync-note">Sincronizando respostas do Supabase...</p> : null}
          </div>
          <div className="admin-responses-page__actions">
            <button className="button button--ghost" type="button" onClick={() => navigate('admin')}>Voltar para administração</button>
            <button className="button button--primary" type="button" onClick={() => navigate('criar')}>Criar novo simulado</button>
          </div>
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

      {selectedResponse ? (
        <section className="panel admin-student-focus">
          <div className="admin-student-focus__header">
            <div>
              <span className="eyebrow">Aluno selecionado</span>
              <h2>{selectedResponse.student?.name || 'Aluno'}</h2>
              <p>{selectedResponse.student?.email || 'E-mail não informado'} • {formatStatus(selectedResponse.status)}</p>
            </div>
            <div className="admin-student-focus__navigation">
              <button className="button button--ghost" type="button" onClick={goToPreviousStudent}>Anterior</button>
              <span>{selectedResponseIndex + 1} de {responses.length}</span>
              <button className="button button--ghost" type="button" onClick={goToNextStudent}>Próximo</button>
            </div>
          </div>

          <div className="summary-list admin-student-focus__details">
            <span><strong>Telefone:</strong> {selectedResponse.student?.phone || 'Não informado'}</span>
            <span><strong>Escola/turma:</strong> {selectedResponse.student?.classGroup || 'Não informado'}</span>
            <span><strong>Início:</strong> {formatDateTime(selectedResponse.startedAt)}</span>
            <span><strong>Finalização:</strong> {selectedResponse.submittedAt ? formatDateTime(selectedResponse.submittedAt) : 'Em andamento'}</span>
            {selectedResponse.languageChoice ? <span><strong>Língua:</strong> {getLanguageLabel(selectedResponse.languageChoice)}</span> : null}
          </div>

          <div className="admin-response-metrics admin-student-focus__metrics">
            <span><strong>{selectedResponse.answeredCount ?? 0}</strong> respondidas</span>
            <span><strong>{selectedResponse.correctCount ?? '—'}</strong> acertos</span>
            <span><strong>{selectedResponse.wrongCount ?? '—'}</strong> erros</span>
            <span><strong>{selectedResponse.blankCount ?? '—'}</strong> em branco</span>
          </div>
        </section>
      ) : (
        <section className="notice-card notice-card--soft admin-student-focus-empty">
          <strong>Nenhum aluno iniciou este simulado ainda</strong>
          <p>Assim que alguém abrir a prova, o aluno aparecerá aqui com botões de anterior e próximo.</p>
        </section>
      )}

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
      : await fetchQuestionSetFromQuestionBank({
          questionCount,
          examYear: activity.examYear || 'mixed',
          seed: activity.questionSeed || activity.createdAt || activity.id,
          language: languageChoice,
          includeLanguageChoice: activity.requiresLanguageChoice !== false,
          areaDistribution: activity.areaDistribution || {}
        });

  return questions.map((question, index) => ({
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
  return activity.examYear === 'mixed' || !activity.examYear ? 'Banco ENEM Supabase • anos mistos' : `Banco ENEM Supabase • ${activity.examYear}`;
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
