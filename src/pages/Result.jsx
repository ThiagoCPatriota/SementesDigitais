import { EmptyState } from '../components/Layout.jsx';

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

  return (
    <>
      <section className="result-hero panel">
        <span className="eyebrow">Resultado do simulado</span>
        <h1>{attempt.examTitle}</h1>
        <p>{attempt.student.name}, sua prova foi {attempt.status === 'expirada' ? 'encerrada pelo tempo' : 'finalizada manualmente'}.</p>
        <div className="score-circle" aria-label="Nota percentual">
          <strong className="score-circle__value">{result.scorePercent}%</strong>
          <span className="score-circle__label">aproveitamento</span>
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
        <p>Sua participação foi registrada. Em uma próxima etapa, o professor poderá acompanhar os resultados da turma em um painel administrativo.</p>
        <div className="hero__actions">
          <button className="button button--primary" type="button" onClick={() => navigate('home')}>Voltar ao início</button>
          <button className="button button--ghost" type="button" onClick={() => navigate('atividades')}>Nova atividade</button>
        </div>
      </section>
    </>
  );
}
