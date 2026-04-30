export function renderQuestionCard(question, selectedLetter) {
  return `
    <article class="question-card">
      <div class="question-card__header">
        <span class="badge">Questão ${question.number}</span>
        <span class="question-card__meta">${question.area} • ${question.year}</span>
      </div>

      <div class="question-card__content">
        ${question.context ? `<p class="question-card__prompt">${question.context}</p>` : ''}
        <p class="question-card__prompt question-card__prompt--statement">${question.statement}</p>
      </div>

      <div class="alternatives" role="radiogroup" aria-label="Alternativas da questão ${question.number}">
        ${question.alternatives
          .map((alternative) => {
            const checked = selectedLetter === alternative.letter ? 'checked' : '';
            const selectedClass = selectedLetter === alternative.letter ? 'alternative--selected' : '';

            return `
              <label class="alternative ${selectedClass}">
                <input type="radio" name="question-${question.id}" value="${alternative.letter}" ${checked} />
                <span class="alternative__letter">${alternative.letter}</span>
                <span class="alternative__text">${alternative.text}</span>
              </label>
            `;
          })
          .join('')}
      </div>
    </article>
  `;
}
