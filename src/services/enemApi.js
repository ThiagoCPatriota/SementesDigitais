const ENEM_API_BASE_URL = 'https://api.enem.dev/v1';

/**
 * Adapter para a API enem.dev.
 *
 * Importante para produção:
 * - Este arquivo é apenas uma referência para integração futura.
 * - O frontend NÃO deve receber gabarito real.
 * - No projeto final, crie uma rota no backend para buscar as questões,
 *   salvar o gabarito no servidor e devolver ao navegador apenas enunciado + alternativas.
 */
export async function fetchQuestionsFromEnemDev({ year = 2023, limit = 60, offset = 0 } = {}) {
  const url = `${ENEM_API_BASE_URL}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Não foi possível buscar questões na API enem.dev.');
  }

  const payload = await response.json();
  const questions = Array.isArray(payload?.questions) ? payload.questions : payload;

  return questions.map((question, index) => sanitizeQuestion(question, index));
}

function sanitizeQuestion(question, index) {
  return {
    id: question.id ?? question.index ?? `enem-${index + 1}`,
    number: index + 1,
    year: question.year,
    area: question.discipline ?? question.area ?? question.knowledgeArea ?? 'ENEM',
    context: question.context ?? '',
    statement: question.title ?? question.statement ?? question.alternativesIntroduction ?? '',
    files: question.files ?? [],
    alternatives: normalizeAlternatives(question.alternatives ?? []),
    // Nunca devolver correctAlternative/isCorrect para o frontend em produção.
  };
}

function normalizeAlternatives(alternatives) {
  return alternatives.map((alternative, index) => ({
    letter: alternative.letter ?? String.fromCharCode(65 + index),
    text: alternative.text ?? alternative.title ?? '',
    file: alternative.file ?? null
  }));
}
