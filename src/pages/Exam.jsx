import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/Layout.jsx';
import { Progress } from '../components/Progress.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { Timer } from '../components/Timer.jsx';
import { ENEM_LANGUAGE_CHOICE_OPTIONS, ENEM_NO_LANGUAGE_CHOICE, getLanguageLabel, isNoLanguageChoice } from '../services/enemApi.js';
import {
  finalizeAttempt,
  getAnswers,
  getExamQuestions,
  saveAnswer,
  setAttemptLanguageChoice
} from '../services/examService.js';
import { secondsUntil } from '../utils/timer.js';

export function Exam({ attempt, result, navigate, showToast, refreshAttempt, refreshResult }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(() => getAnswers());
  const [questions, setQuestions] = useState(() => shouldWaitForLanguageChoice(attempt) ? [] : getExamQuestions());
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(() => attempt ? secondsUntil(attempt.deadlineAt) : 0);

  const requiresLanguageChoice = Boolean(attempt && attempt.sourceMode !== 'mock' && attempt.requiresLanguageChoice !== false);
  const needsLanguageChoice = Boolean(requiresLanguageChoice && !attempt?.languageChoice);
  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];
  const answeredCount = Object.keys(answers).length;
  const hasQuestions = questions.length > 0;
  const selectedLanguageLabel = attempt?.languageChoice ? getLanguageLabel(attempt.languageChoice) : '';
  const selectedNoLanguage = Boolean(attempt?.languageChoice && isNoLanguageChoice(attempt.languageChoice));

  const languageQuestionCount = useMemo(
    () => questions.filter((question) => question.isLanguageQuestion || question.language === 'ingles' || question.language === 'espanhol').length,
    [questions]
  );

  useEffect(() => {
    if (shouldWaitForLanguageChoice(attempt)) {
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setQuestionError('');
    }
  }, [attempt?.id, attempt?.languageChoice, attempt?.requiresLanguageChoice, attempt?.sourceMode]);

  useEffect(() => {
    let isMounted = true;

    async function loadQuestions() {
      if (!attempt || result || questions.length > 0 || needsLanguageChoice) return;

      setLoadingQuestions(true);
      setQuestionError('');

      try {
        const loadedQuestions = await getExamQuestions();
        if (!isMounted) return;
        setQuestions(loadedQuestions);
        refreshAttempt();
      } catch (error) {
        if (!isMounted) return;
        setQuestionError(error?.message || 'Não foi possível carregar as questões reais do ENEM.');
        showToast('Não foi possível carregar as questões reais agora.', 'error');
      } finally {
        if (isMounted) setLoadingQuestions(false);
      }
    }

    loadQuestions();

    return () => {
      isMounted = false;
    };
  }, [attempt?.id, attempt?.languageChoice, needsLanguageChoice, result, questions.length, refreshAttempt, showToast]);

  useEffect(() => {
    if (!attempt || result) return undefined;

    const intervalId = window.setInterval(() => {
      const remaining = secondsUntil(attempt.deadlineAt);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        const finalized = finalizeAttempt('expired');
        if (!finalized) {
          showToast('O tempo encerrou, mas as questões ainda não foram carregadas. Tente finalizar novamente.', 'error');
          return;
        }
        refreshAttempt();
        refreshResult();
        showToast('Tempo encerrado. A prova foi finalizada automaticamente.', 'error');
        navigate('resultado');
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [attempt, result, navigate, refreshAttempt, refreshResult, showToast]);

  if (!attempt) {
    return (
      <EmptyState
        title="Você ainda não iniciou uma atividade."
        description="Escolha uma atividade disponível para liberar a prova e iniciar o cronômetro."
        actionLabel="Ir para atividades"
        actionRoute="atividades"
        navigate={navigate}
      />
    );
  }

  if (result) {
    return (
      <EmptyState
        title="Prova já finalizada."
        description="Acesse a tela de resultado para visualizar seu desempenho."
        actionLabel="Ver resultado"
        actionRoute="resultado"
        navigate={navigate}
      />
    );
  }

  function handleLanguageChoice(languageChoice) {
    if (hasQuestions && attempt.languageChoice && attempt.languageChoice !== languageChoice) {
      showToast('A língua estrangeira já foi definida para esta tentativa.', 'error');
      return;
    }

    const updatedAttempt = setAttemptLanguageChoice(languageChoice);
    if (!updatedAttempt) return;

    setQuestions([]);
    setCurrentQuestionIndex(0);
    setQuestionError('');
    refreshAttempt();
    showToast(isNoLanguageChoice(languageChoice) ? 'Prova sem língua estrangeira selecionada.' : `Língua estrangeira selecionada: ${getLanguageLabel(languageChoice)}.`);
  }

  function handleSelect(letter) {
    if (!currentQuestion) return;
    saveAnswer(currentQuestion.id, letter);
    setAnswers(getAnswers());
    showToast('Resposta salva automaticamente.');
  }

  function finishExam() {
    if (needsLanguageChoice) {
      showToast('Escolha Inglês, Espanhol ou marque que não quer fazer língua estrangeira antes de finalizar.', 'error');
      return;
    }

    if (!hasQuestions) {
      showToast('Aguarde as questões carregarem antes de finalizar.', 'error');
      return;
    }

    const confirmFinish = window.confirm('Deseja finalizar a prova agora? Depois disso, não será possível editar as respostas.');
    if (!confirmFinish) return;

    const finalized = finalizeAttempt('manual');
    if (!finalized) {
      showToast('Não foi possível finalizar porque as questões ainda não foram carregadas.', 'error');
      return;
    }

    refreshAttempt();
    refreshResult();
    showToast('Prova finalizada com sucesso.');
    navigate('resultado');
  }

  return (
    <section className="exam-layout">
      <aside className="exam-sidebar">
        <Timer deadlineAt={attempt.deadlineAt} remainingSeconds={remainingSeconds} />
        <Progress answeredCount={answeredCount} totalQuestions={hasQuestions ? questions.length : Number(attempt.questionCount || 0)} />

        {requiresLanguageChoice ? (
          <LanguageChoicePanel
            selectedLanguage={attempt.languageChoice}
            disabled={hasQuestions || loadingQuestions}
            onSelect={handleLanguageChoice}
          />
        ) : null}

        <div className="question-map panel">
          <div className="question-map__title-row">
            <h2>Mapa da prova</h2>
            {selectedLanguageLabel ? <span className="question-map__language-pill">{selectedLanguageLabel}</span> : null}
          </div>
          {needsLanguageChoice ? (
            <p className="question-map__loading">Escolha Inglês, Espanhol ou pule a língua estrangeira para montar a prova.</p>
          ) : hasQuestions ? (
            <>
              {attempt.languageChoice ? (
                <p className="question-map__language-summary">
                  {selectedNoLanguage
                    ? 'Esta prova foi montada sem questões de língua estrangeira.'
                    : `As questões 1 a ${languageQuestionCount || Math.min(5, questions.length)} são de ${selectedLanguageLabel}.`}
                </p>
              ) : null}
              <div className="question-map__grid">
                {questions.map((question, index) => {
                  const isActive = index === currentQuestionIndex ? 'question-map__button--active' : '';
                  const isAnswered = answers[question.id] ? 'question-map__button--answered' : '';
                  const isLanguage = question.isLanguageQuestion || question.language === 'ingles' || question.language === 'espanhol'
                    ? 'question-map__button--language'
                    : '';
                  return (
                    <button
                      key={question.id}
                      className={`question-map__button ${isActive} ${isAnswered} ${isLanguage}`}
                      type="button"
                      title={question.isLanguageQuestion ? `Questão de ${question.languageLabel || selectedLanguageLabel}` : `Questão ${index + 1}`}
                      onClick={() => setCurrentQuestionIndex(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="question-map__loading">Carregando questões reais do ENEM...</p>
          )}
        </div>
      </aside>

      <section className="exam-main">
        <div className="exam-toolbar panel">
          <div>
            <span className="eyebrow">{attempt.examTitle}</span>
            <h1>Olá, {attempt.student.name.split(' ')[0]}!</h1>
            {selectedLanguageLabel ? <p className="exam-toolbar__language">Língua estrangeira: <strong>{selectedLanguageLabel}</strong></p> : null}
          </div>
          <button className="button button--danger" type="button" onClick={finishExam} disabled={!hasQuestions}>Finalizar prova</button>
        </div>

        {needsLanguageChoice ? (
          <LanguageChoiceCard onSelect={handleLanguageChoice} />
        ) : loadingQuestions ? (
          <article className="panel question-loading-card">
            <span className="eyebrow">Banco ENEM</span>
            <h2>Buscando questões reais da API...</h2>
            <p>Estamos carregando enunciados completos, alternativas e imagens quando a questão possuir arquivo vinculado.</p>
          </article>
        ) : questionError ? (
          <article className="notice-card notice-card--soft question-loading-card">
            <strong>Não foi possível carregar a prova</strong>
            <p>{questionError}</p>
            <button className="button button--primary" type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
          </article>
        ) : currentQuestion ? (
          <QuestionCard
            question={currentQuestion}
            selectedLetter={answers[currentQuestion.id]?.selectedAlternative}
            onSelect={handleSelect}
          />
        ) : null}

        <div className="exam-actions">
          <button className="button button--ghost" type="button" disabled={!hasQuestions || currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}>Anterior</button>
          <button className="button button--primary" type="button" disabled={!hasQuestions || currentQuestionIndex === questions.length - 1} onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}>Próxima</button>
        </div>
      </section>
    </section>
  );
}

function LanguageChoicePanel({ selectedLanguage, disabled, onSelect }) {
  return (
    <div className="language-choice-panel panel">
      <span className="eyebrow">Língua estrangeira</span>
      <div className="language-choice-panel__buttons">
        {ENEM_LANGUAGE_CHOICE_OPTIONS.map((option) => {
          const isActive = selectedLanguage === option.value;
          const isNoneOption = option.value === ENEM_NO_LANGUAGE_CHOICE;

          return (
            <button
              key={option.value}
              className={`language-choice-panel__button ${isActive ? 'language-choice-panel__button--active' : ''} ${isNoneOption ? 'language-choice-panel__button--none' : ''}`}
              type="button"
              disabled={disabled && !isActive}
              onClick={() => onSelect(option.value)}
            >
              {option.shortLabel || option.label}
            </button>
          );
        })}
      </div>
      <p>{getLanguageChoiceDescription(selectedLanguage)}</p>
    </div>
  );
}

function LanguageChoiceCard({ onSelect }) {
  return (
    <article className="panel language-choice-card">
      <span className="eyebrow">Antes de começar</span>
      <h2>Escolha a língua estrangeira da prova</h2>
      <p>Assim como no ENEM, você pode fazer Inglês, Espanhol ou seguir sem língua estrangeira nesta prática. Depois disso, o sistema monta a prova até o total configurado.</p>
      <div className="language-choice-card__actions">
        {ENEM_LANGUAGE_CHOICE_OPTIONS.map((option) => {
          const isNoneOption = option.value === ENEM_NO_LANGUAGE_CHOICE;
          return (
            <button className={`button ${isNoneOption ? 'button--ghost' : 'button--primary'}`} type="button" key={option.value} onClick={() => onSelect(option.value)}>
              {isNoneOption ? option.label : `Fazer ${option.label}`}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function shouldWaitForLanguageChoice(attempt) {
  return Boolean(attempt && attempt.sourceMode !== 'mock' && attempt.requiresLanguageChoice !== false && !attempt.languageChoice);
}

function getLanguageChoiceDescription(selectedLanguage) {
  if (!selectedLanguage) return 'Escolha uma opção para começar.';
  if (isNoLanguageChoice(selectedLanguage)) return 'Esta tentativa seguirá sem língua estrangeira.';
  return `As 5 primeiras questões serão de ${getLanguageLabel(selectedLanguage)}.`;
}
