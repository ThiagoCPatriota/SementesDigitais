import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/Layout.jsx';
import { Progress } from '../components/Progress.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { Timer } from '../components/Timer.jsx';
import { finalizeAttempt, getAnswers, getExamQuestions, saveAnswer } from '../services/examService.js';
import { secondsUntil } from '../utils/timer.js';

export function Exam({ attempt, result, navigate, showToast, refreshAttempt, refreshResult }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(() => getAnswers());
  const [remainingSeconds, setRemainingSeconds] = useState(() => attempt ? secondsUntil(attempt.deadlineAt) : 0);

  const questions = useMemo(() => getExamQuestions(), [attempt?.id, attempt?.questionCount]);
  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (!attempt || result) return undefined;

    const intervalId = window.setInterval(() => {
      const remaining = secondsUntil(attempt.deadlineAt);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        finalizeAttempt('expired');
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

  function handleSelect(letter) {
    saveAnswer(currentQuestion.id, letter);
    setAnswers(getAnswers());
    showToast('Resposta salva automaticamente.');
  }

  function finishExam() {
    const confirmFinish = window.confirm('Deseja finalizar a prova agora? Depois disso, não será possível editar as respostas.');
    if (!confirmFinish) return;

    finalizeAttempt('manual');
    refreshAttempt();
    refreshResult();
    showToast('Prova finalizada com sucesso.');
    navigate('resultado');
  }

  return (
    <section className="exam-layout">
      <aside className="exam-sidebar">
        <Timer deadlineAt={attempt.deadlineAt} remainingSeconds={remainingSeconds} />
        <Progress answeredCount={answeredCount} totalQuestions={questions.length} />

        <div className="question-map panel">
          <h2>Mapa da prova</h2>
          <div className="question-map__grid">
            {questions.map((question, index) => {
              const isActive = index === currentQuestionIndex ? 'question-map__button--active' : '';
              const isAnswered = answers[question.id] ? 'question-map__button--answered' : '';
              return (
                <button
                  key={question.id}
                  className={`question-map__button ${isActive} ${isAnswered}`}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section className="exam-main">
        <div className="exam-toolbar panel">
          <div>
            <span className="eyebrow">{attempt.examTitle}</span>
            <h1>Olá, {attempt.student.name.split(' ')[0]}!</h1>
          </div>
          <button className="button button--danger" type="button" onClick={finishExam}>Finalizar prova</button>
        </div>

        <QuestionCard
          question={currentQuestion}
          selectedLetter={answers[currentQuestion.id]?.selectedAlternative}
          onSelect={handleSelect}
        />

        <div className="exam-actions">
          <button className="button button--ghost" type="button" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}>Anterior</button>
          <button className="button button--primary" type="button" disabled={currentQuestionIndex === questions.length - 1} onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}>Próxima</button>
        </div>
      </section>
    </section>
  );
}
