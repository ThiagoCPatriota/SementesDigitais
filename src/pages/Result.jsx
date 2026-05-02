import { EmptyState } from '../components/Layout.jsx';
import { getAnswers, getExamQuestions } from '../services/examService.js';

export function Result({ result, attempt, navigate }) {
  if (!result || !attempt) {
    return (
      <EmptyState
        title="Nenhum resultado encontrado."
        description="Inicie uma tentativa para gerar o resultado do simulado."
        actionLabel="Ir para atividades"
        actionRoute="atividades"
        navigate={navigate}
      />
    );
  }

  const isPersonalActivity = attempt.activityType === 'pessoal';

  return (
    <>
      <section className="result-hero panel">
        <span className="eyebrow">Resultado do simulado</span>
        <h1>{attempt.examTitle}</h1>
        <p>{attempt.student.name}, sua prova foi {attempt.status === 'expirada' ? 'encerrada pelo tempo' : 'finalizada manualmente'}.</p>
        <div className="score-circle" aria-label="Nota percentual">
          <strong>{result.scorePercent}%</strong>
          <span>aproveitamento</span>
        </div>
      </section>

      <section className="grid four-columns">
        <article className="stat-card"><span>Respondidas</span><strong>{result.answeredCount}</strong></article>
        <article className="stat-card"><span>Em branco</span><strong>{result.blankCount}</strong></article>
        <article className="stat-card"><span>Acertos</span><strong>{result.correctCount}</strong></article>
        <article className="stat-card"><span>Total</span><strong>{result.totalQuestions}</strong></article>
      </section>

      <section className="notice-card">
        <strong>Resultado registrado</strong>
        <p>
          {isPersonalActivity
            ? 'Sua prática pessoal foi registrada. Abaixo você pode revisar cada questão, sua marcação e o gabarito correto.'
            : 'Sua participação foi registrada. O professor poderá acompanhar os resultados da turma no painel administrativo.'}
        </p>
        <div className="hero__actions">
          <button className="button button--primary" type="button" onClick={() => navigate(isPersonalActivity ? 'criar' : 'atividades')}>
            {isPersonalActivity ? 'Criar nova prática' : 'Voltar às atividades'}
          </button>
          <button className="button button--ghost" type="button" onClick={() => navigate('atividades')}>Ver atividades</button>
        </div>
      </section>

      {isPersonalActivity ? <PersonalAnswerReview /> : null}
    </>
  );
}

function PersonalAnswerReview() {
  const questions = getExamQuestions();
  const answers = getAnswers();

  return (
    <section className="answer-review-section">
      <div className="section-header section-header--compact">
        <span className="eyebrow">Correção da prática pessoal</span>
        <h2>Gabarito comentado por marcação</h2>
        <p>Verde indica a resposta correta. Vermelho indica uma alternativa marcada incorretamente. Azul indica sua marcação quando precisar de destaque.</p>
      </div>

      <div className="answer-review-legend">
        <span><i className="answer-review-legend__dot answer-review-legend__dot--correct" /> Correta</span>
        <span><i className="answer-review-legend__dot answer-review-legend__dot--wrong" /> Sua resposta errada</span>
        <span><i className="answer-review-legend__dot answer-review-legend__dot--selected" /> Sua marcação</span>
      </div>

      <div className="answer-review-list">
        {questions.map((question) => {
          const selectedLetter = answers[question.id]?.selectedAlternative || '';
          const isCorrect = selectedLetter === question.correctAlternative;

          return (
            <article className="panel answer-review-card" key={question.id}>
              <div className="answer-review-card__header">
                <div>
                  <span className="badge">Questão {question.number}</span>
                  <h3>{question.area} • {question.year}</h3>
                </div>
                <span className={`answer-review-status ${isCorrect ? 'answer-review-status--correct' : selectedLetter ? 'answer-review-status--wrong' : 'answer-review-status--blank'}`}>
                  {isCorrect ? 'Acertou' : selectedLetter ? 'Errou' : 'Em branco'}
                </span>
              </div>

              {question.context ? <p className="answer-review-card__context">{question.context}</p> : null}
              <p className="answer-review-card__statement">{question.statement}</p>

              <div className="answer-review-alternatives">
                {question.alternatives.map((alternative) => {
                  const isSelected = selectedLetter === alternative.letter;
                  const isRight = question.correctAlternative === alternative.letter;
                  const className = [
                    'answer-review-alternative',
                    isRight ? 'answer-review-alternative--correct' : '',
                    isSelected && !isRight ? 'answer-review-alternative--wrong' : '',
                    isSelected ? 'answer-review-alternative--selected' : ''
                  ].filter(Boolean).join(' ');

                  return (
                    <div className={className} key={alternative.letter}>
                      <strong>{alternative.letter}</strong>
                      <span>{alternative.text}</span>
                      <em>
                        {isRight && isSelected ? 'Sua resposta correta' : isRight ? 'Resposta correta' : isSelected ? 'Sua resposta' : ''}
                      </em>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
