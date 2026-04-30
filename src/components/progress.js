export function renderProgress({ answeredCount, totalQuestions }) {
  const percentage = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);

  return `
    <section class="progress-card" aria-label="Progresso da prova">
      <div>
        <strong>${answeredCount}/${totalQuestions}</strong>
        <span>questões respondidas</span>
      </div>
      <div class="progress-bar" aria-hidden="true">
        <span style="width: ${percentage}%"></span>
      </div>
      <small>${percentage}% concluído</small>
    </section>
  `;
}
