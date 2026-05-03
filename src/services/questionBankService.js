import {
  ENEM_AREA_OPTIONS,
  ENEM_AVAILABLE_YEARS,
  getLanguageLabel,
  isNoLanguageChoice,
  normalizeLanguageChoice
} from './enemApi.js';
import { getSupabaseClient, hasSupabaseConfig } from './supabaseClient.js';

const QUESTION_BANK_TABLE = 'enem_questions';
const FOREIGN_LANGUAGE_QUESTION_COUNT = 5;
const MAX_BANK_ROWS_PER_PAGE = 1000;
const MAX_BANK_PAGES = 8;
const QUESTION_COLUMNS = [
  'id',
  'enem_id',
  'exam_year',
  'original_index',
  'title',
  'discipline',
  'area_label',
  'language',
  'context',
  'statement',
  'alternatives',
  'correct_alternative',
  'files'
].join(', ');

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

  const baseQuestionCount = clampNumber(questionCount, 1, 180);
  const normalizedSeed = normalizeSeed(seed);
  const normalizedLanguage = normalizeLanguageChoice(language);
  const shouldIncludeLanguageChoice = Boolean(includeLanguageChoice && !isNoLanguageChoice(normalizedLanguage));
  const languageQuestionCount = shouldIncludeLanguageChoice ? FOREIGN_LANGUAGE_QUESTION_COUNT : 0;
  const totalQuestionCount = baseQuestionCount + languageQuestionCount;
  const years = examYear === 'mixed'
    ? seededShuffle(ENEM_AVAILABLE_YEARS, normalizedSeed)
    : [Number(examYear) || 2013];

  const collectedQuestions = [];
  let lastSelectionError = '';

  for (const year of years) {
    const yearQuestions = await fetchQuestionsFromSupabaseBank(year);
    collectedQuestions.push(...yearQuestions);

    const selection = selectQuestionsForExam({
      questions: collectedQuestions,
      baseQuestionCount,
      seed: normalizedSeed,
      language: normalizedLanguage,
      includeLanguageChoice: shouldIncludeLanguageChoice,
      areaDistribution
    });

    if (selection.ok) {
      return numberQuestions(selection.questions, totalQuestionCount);
    }

    lastSelectionError = selection.error;
  }

  throw new Error(buildInsufficientQuestionsMessage({
    availableCount: collectedQuestions.length,
    baseQuestionCount,
    languageQuestionCount,
    totalQuestionCount,
    language: normalizedLanguage,
    includeLanguageChoice: shouldIncludeLanguageChoice,
    lastSelectionError
  }));
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
      .select(QUESTION_COLUMNS)
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
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('does not exist') || error?.code === '42P01') {
    return 'A tabela enem_questions ainda não existe no Supabase. Execute o arquivo supabase/enem-question-bank.sql no SQL Editor.';
  }

  if (lowerMessage.includes('permission denied') || lowerMessage.includes('row-level security')) {
    return 'O Supabase recusou a leitura da tabela enem_questions. Execute o SQL de políticas públicas de leitura do arquivo supabase/enem-question-bank.sql.';
  }

  return `Não foi possível buscar questões no Supabase: ${message}`;
}

function rowToQuestion(row) {
  if (!row?.id) return null;

  const language = normalizeStoredLanguage(row.language || '');
  const alternatives = normalizeAlternatives(row.alternatives);
  const correctAlternative = normalizeCorrectAlternative(row.correct_alternative, alternatives);

  if (!alternatives.length || !correctAlternative) return null;

  return {
    id: row.id,
    enemId: row.enem_id || '',
    number: Number(row.original_index || 0),
    originalIndex: Number(row.original_index || 0),
    title: row.title || `Questão ${row.original_index || ''}`.trim(),
    year: Number(row.exam_year || 0) || '',
    area: row.area_label || getAreaLabel(row.discipline) || 'ENEM',
    discipline: normalizeDiscipline(row.discipline),
    language,
    languageLabel: language ? getLanguageLabel(language) : '',
    isLanguageQuestion: Boolean(language),
    context: row.context || '',
    statement: row.statement || '',
    alternatives,
    correctAlternative,
    files: normalizeFiles(row.files)
  };
}

function selectQuestionsForExam({ questions, baseQuestionCount, seed, language, includeLanguageChoice, areaDistribution }) {
  const selected = [];
  const usedIds = new Set();
  const baseCount = Math.max(0, Math.trunc(Number(baseQuestionCount || 0)));
  const languageTarget = includeLanguageChoice ? FOREIGN_LANGUAGE_QUESTION_COUNT : 0;
  const totalTarget = baseCount + languageTarget;

  if (languageTarget > 0) {
    const languageCandidates = seededShuffle(
      questions.filter((question) => question.language === language && !usedIds.has(question.id)),
      seed + language.length * 127
    ).sort((left, right) => {
      const yearSort = Number(right.year || 0) - Number(left.year || 0);
      if (yearSort !== 0) return yearSort;
      return Number(left.originalIndex || left.number || 0) - Number(right.originalIndex || right.number || 0);
    });

    if (languageCandidates.length < languageTarget) {
      return {
        ok: false,
        questions: [],
        error: `há apenas ${languageCandidates.length} questão(ões) de ${getLanguageLabel(language)}, mas são necessárias ${languageTarget}`
      };
    }

    languageCandidates.slice(0, languageTarget).forEach((question) => {
      addQuestion(selected, usedIds, {
        ...question,
        language,
        languageLabel: getLanguageLabel(language),
        isLanguageQuestion: true
      }, totalTarget);
    });
  }

  if (baseCount <= 0) return { ok: selected.length === totalTarget, questions: selected, error: '' };

  const commonQuestions = questions.filter((question) => !isForeignLanguageQuestion(question));
  const normalizedAreaDistribution = normalizeAreaDistributionForSlots(areaDistribution, baseCount);

  if (hasAreaDistribution(normalizedAreaDistribution)) {
    for (const area of ENEM_AREA_OPTIONS) {
      const target = Number(normalizedAreaDistribution[area.value] || 0);
      if (!target) continue;

      const areaCandidates = seededShuffle(
        commonQuestions.filter((question) => question.discipline === area.value && !usedIds.has(question.id)),
        seed + area.value.length * 43
      );

      if (areaCandidates.length < target) {
        return {
          ok: false,
          questions: [],
          error: `faltam questões de ${area.label}; disponíveis ${areaCandidates.length}, necessárias ${target}`
        };
      }

      areaCandidates.slice(0, target).forEach((question) => addQuestion(selected, usedIds, question, totalTarget));
    }
  }

  if (selected.length < totalTarget) {
    const missing = totalTarget - selected.length;
    const remainingCandidates = seededShuffle(
      commonQuestions.filter((question) => !usedIds.has(question.id)),
      seed + 997
    );

    if (remainingCandidates.length < missing) {
      return {
        ok: false,
        questions: [],
        error: `faltam questões gerais; disponíveis ${remainingCandidates.length}, necessárias ${missing}`
      };
    }

    remainingCandidates.slice(0, missing).forEach((question) => addQuestion(selected, usedIds, question, totalTarget));
  }

  return selected.length >= totalTarget
    ? { ok: true, questions: selected, error: '' }
    : { ok: false, questions: [], error: `foram selecionadas ${selected.length} de ${totalTarget} questões` };
}

function buildInsufficientQuestionsMessage({ availableCount, baseQuestionCount, languageQuestionCount, totalQuestionCount, language, includeLanguageChoice, lastSelectionError }) {
  if (availableCount === 0) {
    return 'O banco ENEM do Supabase ainda está vazio. Execute o SQL da tabela e rode npm run import:enem para importar as questões.';
  }

  const languageHint = includeLanguageChoice
    ? ` + ${languageQuestionCount} questão(ões) adicionais de ${getLanguageLabel(language)}`
    : '';
  const detail = lastSelectionError ? ` Detalhe: ${lastSelectionError}.` : '';

  return `Não há questões suficientes no banco ENEM para montar esta atividade. O banco retornou ${availableCount} questão(ões), mas a prova precisa de ${baseQuestionCount} questão(ões) da distribuição${languageHint}, totalizando ${totalQuestionCount}.${detail}`;
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

function normalizeAreaDistributionForSlots(distribution = {}, slotCount = 0) {
  const totalSlots = Math.max(0, Math.trunc(Number(slotCount || 0)));
  const raw = {};
  let rawTotal = 0;

  ENEM_AREA_OPTIONS.forEach((area) => {
    const value = Math.max(0, Math.trunc(Number(distribution?.[area.value] || 0)));
    raw[area.value] = value;
    rawTotal += value;
  });

  if (!rawTotal || !totalSlots) return {};
  if (rawTotal <= totalSlots) return raw;

  const scaled = {};
  const remainders = [];
  let allocated = 0;

  ENEM_AREA_OPTIONS.forEach((area) => {
    const exact = (raw[area.value] / rawTotal) * totalSlots;
    const base = Math.floor(exact);
    scaled[area.value] = base;
    allocated += base;
    remainders.push({ area: area.value, remainder: exact - base });
  });

  remainders
    .sort((left, right) => right.remainder - left.remainder)
    .slice(0, Math.max(0, totalSlots - allocated))
    .forEach((item) => {
      scaled[item.area] += 1;
    });

  return scaled;
}

function hasAreaDistribution(distribution = {}) {
  return Object.values(distribution || {}).some((value) => Number(value) > 0);
}

function isForeignLanguageQuestion(question) {
  return question?.language === 'ingles' || question?.language === 'espanhol' || question?.isLanguageQuestion;
}

function normalizeStoredLanguage(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ingles' || normalized === 'espanhol') return normalized;
  return '';
}

function normalizeDiscipline(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const aliases = {
    linguagens: 'linguagens',
    'linguagens-codigos': 'linguagens',
    'ciencias-humanas': 'ciencias-humanas',
    humanas: 'ciencias-humanas',
    'ciencias-natureza': 'ciencias-natureza',
    natureza: 'ciencias-natureza',
    matematica: 'matematica',
    matemática: 'matematica'
  };

  return aliases[normalized] || normalized;
}

function normalizeAlternatives(alternatives = []) {
  if (!Array.isArray(alternatives)) return [];

  return alternatives
    .map((alternative, index) => {
      const letter = String(alternative?.letter || alternative?.option || String.fromCharCode(65 + index)).trim().toUpperCase();
      return {
        letter,
        text: alternative?.text || alternative?.body || alternative?.title || alternative?.content || '',
        file: normalizeFile(alternative?.file || alternative?.image),
        isCorrect: Boolean(alternative?.isCorrect)
      };
    })
    .filter((alternative) => alternative.letter);
}

function normalizeCorrectAlternative(correctAlternative, alternatives) {
  const normalized = String(correctAlternative || '').trim().toUpperCase();
  if (normalized) return normalized;
  return alternatives.find((alternative) => alternative.isCorrect)?.letter || '';
}

function normalizeFiles(files = []) {
  if (!Array.isArray(files)) return [];
  return files.map(normalizeFile).filter(Boolean);
}

function normalizeFile(file) {
  if (!file) return '';
  if (typeof file === 'string') return file;
  return file.url || file.src || file.path || '';
}

function getAreaLabel(discipline = '') {
  return ENEM_AREA_OPTIONS.find((area) => area.value === normalizeDiscipline(discipline))?.label || '';
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
