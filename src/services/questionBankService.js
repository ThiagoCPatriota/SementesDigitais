import {
  ENEM_AREA_OPTIONS,
  ENEM_AVAILABLE_YEARS,
  ENEM_NO_LANGUAGE_CHOICE,
  getLanguageLabel,
  isNoLanguageChoice,
  normalizeLanguageChoice
} from './enemApi.js';
import { getSupabaseClient, hasSupabaseConfig } from './supabaseClient.js';

const QUESTION_BANK_TABLE = 'enem_questions';
const FOREIGN_LANGUAGE_QUESTION_COUNT = 5;
const MAX_BANK_ROWS_PER_PAGE = 1000;
const MAX_BANK_PAGES = 5;

export async function fetchQuestionSetFromQuestionBank({
  questionCount = 60,
  examYear = 'mixed',
  seed = Date.now(),
  language = 'ingles',
  includeLanguageChoice = true,
  areaDistribution = {}
} = {}) {
  if (!hasSupabaseConfig()) {
    throw new Error('O Supabase ainda não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o banco ENEM.');
  }

  const count = clampNumber(questionCount, 1, 180);
  const normalizedSeed = normalizeSeed(seed);
  const normalizedLanguage = normalizeLanguageChoice(language);
  const shouldIncludeLanguageChoice = Boolean(includeLanguageChoice && !isNoLanguageChoice(normalizedLanguage));
  const normalizedAreaDistribution = normalizeAreaDistribution(areaDistribution, count);
  const years = examYear === 'mixed'
    ? seededShuffle(ENEM_AVAILABLE_YEARS, normalizedSeed)
    : [Number(examYear) || 2023];

  const collectedQuestions = [];

  for (const year of years) {
    const yearQuestions = await fetchQuestionsFromSupabaseBank(year);
    collectedQuestions.push(...yearQuestions);

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

  const availableCount = collectedQuestions.length;
  const languageHint = shouldIncludeLanguageChoice ? ` com ${getLanguageLabel(normalizedLanguage)}` : '';
  throw new Error(
    availableCount === 0
      ? 'O banco ENEM do Supabase ainda está vazio. Execute o SQL da tabela e rode npm run import:enem para importar as questões.'
      : `O banco ENEM tem ${availableCount} questão(ões), mas não conseguiu montar uma prova de ${count} questão(ões)${languageHint}. Importe mais anos ou reduza a quantidade.`
  );
}

export async function getQuestionBankStatus() {
  if (!hasSupabaseConfig()) return { connected: false, total: 0 };

  const supabase = await getSupabaseClient();
  if (!supabase) return { connected: false, total: 0 };

  try {
    const { count, error } = await supabase
      .from(QUESTION_BANK_TABLE)
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return { connected: true, total: Number(count || 0) };
  } catch (error) {
    console.warn('Não foi possível consultar o banco ENEM.', error);
    return { connected: true, total: 0, error: error?.message || String(error) };
  }
}

async function fetchQuestionsFromSupabaseBank(year) {
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Não foi possível conectar ao Supabase para buscar as questões ENEM.');

  const rows = [];
  for (let page = 0; page < MAX_BANK_PAGES; page += 1) {
    const from = page * MAX_BANK_ROWS_PER_PAGE;
    const to = from + MAX_BANK_ROWS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from(QUESTION_BANK_TABLE)
      .select('id, enem_id, exam_year, original_index, title, discipline, area_label, language, context, statement, alternatives, correct_alternative, files')
      .eq('exam_year', year)
      .order('original_index', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(formatQuestionBankError(error));
    }

    rows.push(...(Array.isArray(data) ? data : []));

    if (!Array.isArray(data) || data.length < MAX_BANK_ROWS_PER_PAGE) break;
  }

  return rows.map(rowToQuestion).filter(Boolean);
}

function formatQuestionBankError(error) {
  const message = error?.message || String(error || 'erro desconhecido');

  if (message.toLowerCase().includes('does not exist') || error?.code === '42P01') {
    return 'A tabela enem_questions ainda não existe no Supabase. Execute o arquivo supabase/enem-question-bank.sql no SQL Editor.';
  }

  if (message.toLowerCase().includes('permission denied') || message.toLowerCase().includes('row-level security')) {
    return 'O Supabase recusou a leitura da tabela enem_questions. Execute o SQL de políticas públicas de leitura do arquivo supabase/enem-question-bank.sql.';
  }

  return `Não foi possível buscar questões no Supabase: ${message}`;
}

function rowToQuestion(row) {
  if (!row?.id) return null;

  const language = normalizeStoredLanguage(row.language || '');
  const alternatives = normalizeAlternatives(row.alternatives);

  return {
    id: row.id,
    number: Number(row.original_index || 0),
    originalIndex: Number(row.original_index || 0),
    title: row.title || `Questão ${row.original_index || ''}`.trim(),
    year: row.exam_year,
    area: row.area_label || getAreaLabel(row.discipline) || 'ENEM',
    discipline: row.discipline || '',
    language,
    languageLabel: language ? getLanguageLabel(language) : '',
    isLanguageQuestion: Boolean(language),
    context: row.context || '',
    statement: row.statement || '',
    alternatives,
    correctAlternative: row.correct_alternative || alternatives.find((alternative) => alternative.isCorrect)?.letter || null,
    files: Array.isArray(row.files) ? row.files.filter(Boolean) : []
  };
}

function selectQuestionsForExam({ questions, count, seed, language, includeLanguageChoice, areaDistribution }) {
  const selected = [];
  const usedIds = new Set();

  if (includeLanguageChoice) {
    const languageQuestions = questions
      .filter((question) => question.language === language || question.isLanguageQuestion && question.language === language)
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

function addQuestion(selected, usedIds, question, limit) {
  if (!question?.id || usedIds.has(question.id) || selected.length >= limit) return;
  selected.push(question);
  usedIds.add(question.id);
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

function isForeignLanguageQuestion(question) {
  return question?.language === 'ingles' || question?.language === 'espanhol' || question?.isLanguageQuestion;
}

function normalizeStoredLanguage(value = '') {
  if (value === 'ingles' || value === 'espanhol') return value;
  return '';
}

function normalizeAlternatives(alternatives = []) {
  if (!Array.isArray(alternatives)) return [];

  return alternatives
    .map((alternative, index) => {
      const letter = String(alternative?.letter || alternative?.option || String.fromCharCode(65 + index)).trim().toUpperCase();
      return {
        letter,
        text: alternative?.text || alternative?.body || '',
        file: alternative?.file || alternative?.image || '',
        isCorrect: Boolean(alternative?.isCorrect)
      };
    })
    .filter((alternative) => alternative.letter);
}

function getAreaLabel(discipline = '') {
  return ENEM_AREA_OPTIONS.find((area) => area.value === discipline)?.label || '';
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function normalizeSeed(seed) {
  const asNumber = Number(seed);
  if (Number.isFinite(asNumber)) return Math.abs(Math.trunc(asNumber));

  return String(seed)
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}

function seededShuffle(items, seed) {
  const copy = [...items];
  let currentSeed = normalizeSeed(seed) || 1;

  for (let index = copy.length - 1; index > 0; index -= 1) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const random = currentSeed / 233280;
    const targetIndex = Math.floor(random * (index + 1));
    [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
  }

  return copy;
}
