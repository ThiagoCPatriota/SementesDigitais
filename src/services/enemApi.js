const ENEM_API_BASE_URL = 'https://api.enem.dev/v1';

export const ENEM_AVAILABLE_YEARS = Array.from({ length: 15 }, (_, index) => 2023 - index);
export const ENEM_LANGUAGE_OPTIONS = [
  { value: 'ingles', label: 'Inglês' },
  { value: 'espanhol', label: 'Espanhol' }
];

const FOREIGN_LANGUAGE_QUESTION_COUNT = 5;
const COMMON_QUESTIONS_START_OFFSET = 5;

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

/**
 * Adapter para a API enem.dev.
 *
 * Para o MVP, o frontend busca as questões diretamente da API pública.
 * Em produção, o ideal é passar por um backend: o navegador recebe enunciado,
 * imagens e alternativas; o gabarito fica protegido no servidor.
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
  const count = clampNumber(questionCount, 1, 180);
  const normalizedSeed = normalizeSeed(seed);
  const normalizedLanguage = normalizeLanguageChoice(language);
  const years = examYear === 'mixed'
    ? seededShuffle(ENEM_AVAILABLE_YEARS, normalizedSeed)
    : [Number(examYear) || 2023];

  const questions = [];
  const usedIds = new Set();
  const normalizedAreaDistribution = normalizeAreaDistribution(areaDistribution, count);

  if (includeLanguageChoice) {
    const languageYear = years[0] || 2023;
    const languageQuestions = await fetchLanguageQuestions({
      year: languageYear,
      language: normalizedLanguage,
      limit: Math.min(FOREIGN_LANGUAGE_QUESTION_COUNT, count)
    });

    languageQuestions.forEach((question) => addQuestion(questions, usedIds, {
      ...question,
      language: normalizedLanguage,
      languageLabel: getLanguageLabel(normalizedLanguage),
      isLanguageQuestion: true
    }, count));
  }

  if (hasAreaDistribution(normalizedAreaDistribution)) {
    const areaQuestions = await fetchDistributedQuestions({
      years,
      areaDistribution: normalizedAreaDistribution,
      seed: normalizedSeed,
      language: normalizedLanguage,
      usedIds,
      alreadySelectedQuestions: questions,
      limit: count
    });

    areaQuestions.forEach((question) => addQuestion(questions, usedIds, question, count));
  }

  const commonTarget = count - questions.length;
  if (commonTarget > 0) {
    const commonQuestions = await fetchCommonQuestions({
      years,
      count: commonTarget,
      seed: normalizedSeed,
      language: normalizedLanguage,
      usedIds
    });

    commonQuestions.forEach((question) => addQuestion(questions, usedIds, question, count));
  }

  if (questions.length < count) {
    throw new Error('A API retornou menos questões do que o necessário para montar o simulado.');
  }

  return questions.slice(0, count).map((question, index) => ({
    ...question,
    number: index + 1
  }));
}

export function normalizeLanguageChoice(value = 'ingles') {
  return value === 'espanhol' ? 'espanhol' : 'ingles';
}

export function getLanguageLabel(value = 'ingles') {
  return normalizeLanguageChoice(value) === 'espanhol' ? 'Espanhol' : 'Inglês';
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

async function fetchLanguageQuestions({ year, language, limit }) {
  const page = await fetchQuestionsPage({
    year,
    limit: Math.max(1, limit),
    offset: 0,
    language
  });

  return page.questions
    .slice(0, limit)
    .map((question) => ({
      ...question,
      language,
      languageLabel: getLanguageLabel(language),
      isLanguageQuestion: true
    }));
}

async function fetchDistributedQuestions({ years, areaDistribution, seed, language, usedIds, alreadySelectedQuestions, limit }) {
  const questions = [];
  const selectedByArea = countSelectedQuestionsByArea(alreadySelectedQuestions);

  for (const area of ENEM_AREA_OPTIONS.map((item) => item.value)) {
    const requestedForArea = Number(areaDistribution[area] || 0);
    const alreadySelectedForArea = selectedByArea[area] || 0;
    const target = Math.max(0, requestedForArea - alreadySelectedForArea);
    if (!target) continue;

    const areaQuestions = await fetchAreaQuestions({
      years,
      area,
      count: Math.min(target, limit - alreadySelectedQuestions.length - questions.length),
      seed,
      language,
      usedIds
    });

    areaQuestions.forEach((question) => {
      if (questions.length + alreadySelectedQuestions.length >= limit) return;
      questions.push(question);
    });
  }

  return questions;
}

async function fetchAreaQuestions({ years, area, count, seed, language, usedIds }) {
  const questions = [];
  const localIds = new Set();
  let cycle = 0;

  while (questions.length < count && cycle < years.length * 10) {
    const year = years[cycle % years.length];
    const chunkSize = Math.min(Math.max((count - questions.length) * 6, 24), 45);
    const baseOffset = seededInteger(seed + cycle * 211 + area.length * 17, COMMON_QUESTIONS_START_OFFSET, 135);
    const offset = Math.max(COMMON_QUESTIONS_START_OFFSET, Math.min(baseOffset, 180 - chunkSize));
    const page = await fetchQuestionsPage({ year, limit: chunkSize, offset, language });

    page.questions.forEach((question) => {
      if (questions.length >= count) return;
      if (question.discipline !== area) return;
      if (isForeignLanguageQuestion(question)) return;
      if (usedIds.has(question.id) || localIds.has(question.id)) return;
      localIds.add(question.id);
      questions.push({ ...question, isLanguageQuestion: false });
    });

    cycle += 1;
  }

  return questions;
}

async function fetchCommonQuestions({ years, count, seed, language, usedIds }) {
  const questions = [];
  const localIds = new Set();
  let cycle = 0;

  while (questions.length < count && cycle < years.length * 6) {
    const year = years[cycle % years.length];
    const remaining = count - questions.length;
    const chunkSize = Math.min(Math.max(remaining + 6, 12), 35);

    const metaPage = await fetchQuestionsPage({ year, limit: 1, offset: COMMON_QUESTIONS_START_OFFSET, language });
    const total = Number(metaPage.metadata?.total || 180);
    const maxOffset = Math.max(COMMON_QUESTIONS_START_OFFSET, total - chunkSize);
    const offset = maxOffset > COMMON_QUESTIONS_START_OFFSET
      ? seededInteger(seed + year * 97 + cycle * 31, COMMON_QUESTIONS_START_OFFSET, maxOffset)
      : COMMON_QUESTIONS_START_OFFSET;

    const page = await fetchQuestionsPage({ year, limit: chunkSize, offset, language });

    page.questions.forEach((question) => {
      if (questions.length >= count) return;
      if (isForeignLanguageQuestion(question)) return;
      if (usedIds.has(question.id) || localIds.has(question.id)) return;
      localIds.add(question.id);
      questions.push({ ...question, isLanguageQuestion: false });
    });

    cycle += 1;
  }

  return questions;
}

async function fetchQuestionsPage({ year, limit, offset, language = '' }) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  if (language) params.set('language', normalizeLanguageChoice(language));

  const url = `${ENEM_API_BASE_URL}/exams/${year}/questions?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Não foi possível buscar questões reais na API enem.dev.');
  }

  const payload = await response.json();
  const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : Array.isArray(payload) ? payload : [];

  return {
    metadata: payload?.metadata ?? { limit, offset, total: rawQuestions.length, hasMore: false },
    questions: rawQuestions.map((question, index) => sanitizeQuestion(question, index + offset))
  };
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
