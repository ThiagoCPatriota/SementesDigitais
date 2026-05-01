export function QuestionCard({ question, selectedLetter, onSelect }) {
  const metaItems = [question.area, question.year, question.languageLabel].filter(Boolean);

  return (
    <article className="question-card">
      <div className="question-card__header">
        <span className="badge">Questão {question.number}</span>
        <span className="question-card__meta">{metaItems.join(' • ')}</span>
      </div>

      <div className="question-card__content">
        {question.context ? <TextBlock className="question-card__prompt" text={question.context} /> : null}
        <MediaList files={question.files} label={`Imagem da questão ${question.number}`} />
        {question.statement ? (
          <TextBlock className="question-card__prompt question-card__prompt--statement" text={question.statement} />
        ) : null}
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
              <span className="alternative__body">
                {alternative.text ? <TextBlock className="alternative__text" text={alternative.text} /> : null}
                {alternative.file ? <QuestionImage src={alternative.file} alt={`Imagem da alternativa ${alternative.letter}`} /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </article>
  );
}

function TextBlock({ text, className }) {
  const cleanText = sanitizeDisplayText(text);
  if (!cleanText) return null;

  return (
    <div className={className}>
      {cleanText
        .split('\n')
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={`${paragraph.slice(0, 18)}-${index}`}>{paragraph}</p>
        ))}
    </div>
  );
}

function MediaList({ files = [], label }) {
  if (!Array.isArray(files) || files.length === 0) return null;

  return (
    <div className="question-media-list">
      {files.map((file, index) => (
        <QuestionImage key={`${file}-${index}`} src={file} alt={`${label} ${index + 1}`} />
      ))}
    </div>
  );
}

function QuestionImage({ src, alt }) {
  if (!src) return null;

  return (
    <figure className="question-image-wrap">
      <img className="question-image" src={src} alt={alt} loading="lazy" />
    </figure>
  );
}

function sanitizeDisplayText(value = '') {
  return String(value ?? '')
    .replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
