const ENEM_API_BASE_URL = getEnemApiBaseUrl();

export const ENEM_AVAILABLE_YEARS = Array.from({ length: 15 }, (_, index) => 2023 - index);
export const ENEM_NO_LANGUAGE_CHOICE = 'sem-lingua';
export const ENEM_LANGUAGE_OPTIONS = [
  { value: 'ingles', label: 'Inglês' },
  { value: 'espanhol', label: 'Espanhol' }
];
export const ENEM_LANGUAGE_CHOICE_OPTIONS = [
  ...ENEM_LANGUAGE_OPTIONS,
  { value: ENEM_NO_LANGUAGE_CHOICE, label: 'Não quero fazer nessa prova', shortLabel: 'Sem língua' }
];

const FOREIGN_LANGUAGE_QUESTION_COUNT = 5;
const FULL_EXAM_QUESTION_COUNT = 180;
const REQUEST_TIMEOUT_MS = 15000;

export const ENEM_AREA_OPTIONS = [
  { value: 'linguagens', label: 'Linguagens' },
  { value: 'ciencias-humanas', label: 'Ciências Humanas' },
  { value: 'ciencias-natureza', label: 'Ciências da Natureza' },
  { value: 'matematica', label: 'Matemática' }
];

const AREA_LABELS = ENEM_AREA_OPTIONS.reduce((accumulator, area) => {
  accumulator[area.value] = area.label;
  return accumulator;
}, {});

const examQuestionsCache = new Map();

/**
 * Adapter para a API enem.dev.
 *
 * Em desenvolvimento, o Vite usa um proxy local em /enem-api para evitar bloqueios de CORS
 * no navegador. Em produção, a URL pública continua disponível e pode ser sobrescrita por
 * VITE_ENEM_API_BASE_URL caso o projeto tenha um backend/proxy próprio.
 */
export async function fetchQuestionsFromEnemDev({ year = 2023, limit = 60, offset = 0, language = '' } = {}) {
  const page = await fetchQuestionsPage({ year, limit, offset, language });
  return page.questions;
}

export async function fetchQuestionSetFromEnemDev({
  questionCount = 60,
  examYear = 'mixed',
  seed = Date.now(),
  language = 'ingles',
  includeLanguageChoice = true,
  areaDistribution = {}
} = {}) {
  const count = clampNumber(questionCount, 1, FULL_EXAM_QUESTION_COUNT);
  const normalizedSeed = normalizeSeed(seed);
  const normalizedLanguage = normalizeLanguageChoice(language);
  const shouldIncludeLanguageChoice = Boolean(includeLanguageChoice && !isNoLanguageChoice(normalizedLanguage));
  const normalizedAreaDistribution = normalizeAreaDistribution(areaDistribution, count);
  const years = examYear === 'mixed'
    ? seededShuffle(ENEM_AVAILABLE_YEARS, normalizedSeed)
    : [Number(examYear) || 2023];

  const collectedQuestions = [];

  for (const year of years) {
    const examQuestions = await fetchFullExamQuestions({
      year,
      language: shouldIncludeLanguageChoice ? normalizedLanguage : ''
    });

    collectedQuestions.push(...examQuestions);

    const selectedQuestions = selectQuestionsForExam({
      questions: collectedQuestions,
      count,
      seed: normalizedSeed,
      language: normalizedLanguage,
      includeLanguageChoice: shouldIncludeLanguageChoice,
      areaDistribution: normalizedAreaDistribution
    });

    if (selectedQuestions.length >= count) {
      return numberQuestions(selectedQuestions, count);
    }
  }

  throw new Error('A API retornou menos questões do que o necessário para montar o simulado. Tente reduzir a quantidade ou mudar a distribuição por área.');
}

export function normalizeLanguageChoice(value = 'ingles') {
  if (value === ENEM_NO_LANGUAGE_CHOICE) return ENEM_NO_LANGUAGE_CHOICE;
  return value === 'espanhol' ? 'espanhol' : 'ingles';
}

export function isNoLanguageChoice(value = '') {
  return value === ENEM_NO_LANGUAGE_CHOICE;
}

export function getLanguageLabel(value = 'ingles') {
  const normalized = normalizeLanguageChoice(value);
  if (isNoLanguageChoice(normalized)) return 'Sem língua estrangeira';
  return normalized === 'espanhol' ? 'Espanhol' : 'Inglês';
}

function getEnemApiBaseUrl() {
  const configuredUrl = import.meta.env?.VITE_ENEM_API_BASE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  return import.meta.env?.DEV ? '/enem-api/v1' : 'https://api.enem.dev/v1';
}

function selectQuestionsForExam({ questions, count, seed, language, includeLanguageChoice, areaDistribution }) {
  const selected = [];
  const usedIds = new Set();

  if (includeLanguageChoice) {
    const languageQuestions = questions
      .filter((question) => question.language === language || question.isLanguageQuestion)
      .sort((left, right) => {
        const yearSort = Number(right.year || 0) - Number(left.year || 0);
        if (yearSort !== 0) return yearSort;
        return Number(left.originalIndex || left.number || 0) - Number(right.originalIndex || right.number || 0);
      });

    languageQuestions.slice(0, Math.min(FOREIGN_LANGUAGE_QUESTION_COUNT, count)).forEach((question) => {
      addQuestion(selected, usedIds, {
        ...question,
        language,
        languageLabel: getLanguageLabel(language),
        isLanguageQuestion: true
      }, count);
    });
  }

  const commonQuestions = questions.filter((question) => !isForeignLanguageQuestion(question));

  if (hasAreaDistribution(areaDistribution)) {
    const selectedByArea = countSelectedQuestionsByArea(selected);

    ENEM_AREA_OPTIONS.forEach((area) => {
      const requestedForArea = Number(areaDistribution[area.value] || 0);
      const alreadySelectedForArea = selectedByArea[area.value] || 0;
      const target = Math.max(0, requestedForArea - alreadySelectedForArea);
      if (!target) return;

      const areaCandidates = seededShuffle(
        commonQuestions.filter((question) => question.discipline === area.value && !usedIds.has(question.id)),
        seed + area.value.length * 43
      );

      areaCandidates.slice(0, target).forEach((question) => addQuestion(selected, usedIds, question, count));
    });
  }

  if (selected.length < count) {
    const remainingCandidates = seededShuffle(
      commonQuestions.filter((question) => !usedIds.has(question.id)),
      seed + 997
    );

    remainingCandidates.forEach((question) => addQuestion(selected, usedIds, question, count));
  }

  return selected;
}

function numberQuestions(questions, count) {
  return questions.slice(0, count).map((question, index) => ({
    ...question,
    number: index + 1
  }));
}

function normalizeAreaDistribution(distribution = {}, limit = 90) {
  const normalized = {};
  let total = 0;

  ENEM_AREA_OPTIONS.forEach((area) => {
    const value = Math.max(0, Math.trunc(Number(distribution?.[area.value] || 0)));
    const available = Math.max(0, limit - total);
    normalized[area.value] = Math.min(value, available);
    total += normalized[area.value];
  });

  return normalized;
}

function hasAreaDistribution(distribution = {}) {
  return Object.values(distribution || {}).some((value) => Number(value) > 0);
}

function countSelectedQuestionsByArea(questions = []) {
  return questions.reduce((accumulator, question) => {
    const area = question.discipline || '';
    if (area) accumulator[area] = (accumulator[area] || 0) + 1;
    return accumulator;
  }, {});
}

async function fetchFullExamQuestions({ year, language = '' }) {
  const normalizedLanguage = language && !isNoLanguageChoice(language) ? normalizeLanguageChoice(language) : '';
  const cacheKey = `${year}:${normalizedLanguage || 'sem-parametro-lingua'}`;

  if (examQuestionsCache.has(cacheKey)) {
    return examQuestionsCache.get(cacheKey);
  }

  const page = await fetchQuestionsPage({
    year,
    limit: FULL_EXAM_QUESTION_COUNT,
    offset: 0,
    language: normalizedLanguage
  });

  examQuestionsCache.set(cacheKey, page.questions);
  return page.questions;
}

async function fetchQuestionsPage({ year, limit, offset, language = '' }) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  if (language && !isNoLanguageChoice(language)) params.set('language', normalizeLanguageChoice(language));

  const url = `${ENEM_API_BASE_URL}/exams/${year}/questions?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`A API enem.dev respondeu com status ${response.status}.`);
    }

    const payload = await response.json();
    const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : Array.isArray(payload) ? payload : [];

    return {
      metadata: payload?.metadata ?? { limit, offset, total: rawQuestions.length, hasMore: false },
      questions: rawQuestions.map((question, index) => sanitizeQuestion(question, index + offset))
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A API enem.dev demorou demais para responder. Tente novamente em instantes.');
    }

    throw new Error(error?.message || 'Não foi possível buscar questões reais na API enem.dev.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function sanitizeQuestion(question, index) {
  const alternatives = normalizeAlternatives(question.alternatives ?? []);
  const correctAlternative = question.correctAlternative || alternatives.find((alternative) => alternative.isCorrect)?.letter || null;
  const rawContext = question.context ?? '';
  const rawStatement = question.alternativesIntroduction || question.statement || question.question || '';
  const extractedFiles = [
    ...extractMarkdownImageUrls(rawContext),
    ...extractMarkdownImageUrls(rawStatement)
  ];
  const language = normalizeQuestionLanguage(question.language || '');

  return {
    id: buildQuestionId(question, index),
    number: Number(question.index || index + 1),
    originalIndex: Number(question.index || index + 1),
    title: question.title ?? `Questão ${Number(question.index || index + 1)}`,
    year: question.year,
    area: AREA_LABELS[question.discipline] || question.discipline || question.area || question.knowledgeArea || 'ENEM',
    discipline: question.discipline || '',
    language,
    languageLabel: language ? getLanguageLabel(language) : '',
    isLanguageQuestion: Boolean(language),
    context: normalizeText(rawContext),
    statement: normalizeText(rawStatement),
    files: uniqueFiles([...normalizeFiles(question.files), ...extractedFiles]),
    alternatives,
    correctAlternative
  };
}

function normalizeAlternatives(alternatives) {
  return alternatives.map((alternative, index) => {
    const text = normalizeText(alternative.text ?? alternative.title ?? alternative.content ?? '');
    const extractedFiles = extractMarkdownImageUrls(alternative.text ?? alternative.title ?? alternative.content ?? '');
    const normalizedFile = normalizeFile(alternative.file) || extractedFiles[0] || null;

    return {
      letter: alternative.letter ?? String.fromCharCode(65 + index),
      text,
      file: normalizedFile,
      isCorrect: Boolean(alternative.isCorrect)
    };
  });
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map(normalizeFile).filter(Boolean);
}

function normalizeFile(file) {
  if (!file) return null;
  if (typeof file === 'string') return file;
  return file.url || file.src || file.path || null;
}

function uniqueFiles(files) {
  return Array.from(new Set(files.filter(Boolean)));
}

function normalizeText(value = '') {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMarkdownImageUrls(value = '') {
  const urls = [];
  const text = String(value ?? '');
  const regex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
  let match = regex.exec(text);

  while (match) {
    urls.push(match[1]);
    match = regex.exec(text);
  }

  return urls;
}

function normalizeQuestionLanguage(value = '') {
  if (value === 'ingles' || value === 'espanhol') return value;
  return '';
}

function isForeignLanguageQuestion(question) {
  return Boolean(question?.language === 'ingles' || question?.language === 'espanhol' || question?.isLanguageQuestion);
}

function addQuestion(questions, usedIds, question, limit) {
  if (!question || questions.length >= limit || usedIds.has(question.id)) return;
  usedIds.add(question.id);
  questions.push(question);
}

function buildQuestionId(question, index) {
  const year = question.year || 'enem';
  const base = question.id ?? question.index ?? index + 1;
  const language = question.language ? `-${question.language}` : '';
  return `${year}-${base}${language}`;
}

function seededShuffle(values, seed) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = seededInteger(seed + index * 101, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function seededInteger(seed, min, max) {
  const value = Math.abs(Math.sin(seed) * 10000);
  return min + Math.floor((value - Math.floor(value)) * (max - min + 1));
}

function normalizeSeed(seed) {
  if (typeof seed === 'number') return seed;
  return String(seed)
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}
