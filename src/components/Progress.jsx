export function Progress({ answeredCount, totalQuestions }) {
  const percentage = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);

  return (
    <section className="progress-card" aria-label="Progresso da prova">
      <div>
        <strong>{answeredCount}/{totalQuestions}</strong>
        <span>questões respondidas</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <small>{percentage}% concluído</small>
    </section>
  );
}
