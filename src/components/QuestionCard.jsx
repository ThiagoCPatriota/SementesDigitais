export function QuestionCard({ question, selectedLetter, onSelect }) {
  return (
    <article className="question-card">
      <div className="question-card__header">
        <span className="badge">Questão {question.number}</span>
        <span className="question-card__meta">{question.area} • {question.year}</span>
      </div>

      <div className="question-card__content">
        {question.context ? <p className="question-card__prompt">{question.context}</p> : null}
        <p className="question-card__prompt question-card__prompt--statement">{question.statement}</p>
      </div>

      <div className="alternatives" role="radiogroup" aria-label={`Alternativas da questão ${question.number}`}>
        {question.alternatives.map((alternative) => {
          const selected = selectedLetter === alternative.letter;
          return (
            <label key={alternative.letter} className={`alternative ${selected ? 'alternative--selected' : ''}`}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value={alternative.letter}
                checked={selected}
                onChange={() => onSelect(alternative.letter)}
              />
              <span className="alternative__letter">{alternative.letter}</span>
              <span className="alternative__text">{alternative.text}</span>
            </label>
          );
        })}
      </div>
    </article>
  );
}
