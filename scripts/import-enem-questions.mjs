import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

loadEnvFile('.env.local');
loadEnvFile('.env');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENEM_API_BASE_URL = process.env.ENEM_API_BASE_URL || 'https://api.enem.dev/v1';
const ENEM_IMPORT_YEARS = parseYears(process.env.ENEM_IMPORT_YEARS || '2023,2022,2021,2020');

const PAGE_SIZE = 45;
const LANGUAGES = ['ingles', 'espanhol'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`
Erro: configure SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de importar.

Exemplo no PowerShell:
  $env:SUPABASE_URL="https://xxxx.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="sua_service_role"
  $env:ENEM_IMPORT_YEARS="2023,2022,2021,2020"
  npm run import:enem
`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

console.log('Importando questões ENEM para o Supabase...');
console.log(`Anos: ${ENEM_IMPORT_YEARS.join(', ')}`);
console.log(`API: ${ENEM_API_BASE_URL}`);
console.log('');

for (const year of ENEM_IMPORT_YEARS) {
  const questionsById = new Map();

  for (const language of LANGUAGES) {
    console.log(`Ano ${year} / ${language}: buscando questões paginadas...`);

    const questions = await fetchExamQuestions({ year, language });

    for (const question of questions) {
      const normalized = normalizeQuestion(question, { year, requestedLanguage: language });
      if (normalized) {
        questionsById.set(normalized.id, normalized);
      }
    }

    console.log(`Ano ${year} / ${language}: ${questions.length} questões recebidas.`);
  }

  const normalizedQuestions = Array.from(questionsById.values());

  if (!normalizedQuestions.length) {
    console.warn(`Ano ${year}: nenhuma questão válida encontrada. Pulando...`);
    continue;
  }

  console.log(`Ano ${year}: enviando ${normalizedQuestions.length} questões normalizadas para o Supabase...`);
  await upsertInBatches(normalizedQuestions, 100);
  console.log(`Ano ${year}: importação concluída.`);
  console.log('');
}

console.log('Importação finalizada com sucesso.');

async function fetchExamQuestions({ year, language }) {
  const allQuestions = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${ENEM_API_BASE_URL}/exams/${year}/questions`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));

    if (language) {
      url.searchParams.set('language', language);
    }

    console.log(`  Buscando: ${url.toString()}`);

    const response = await fetch(url);

    if (response.status === 429) {
      const body = await safeReadText(response);
      const retryAfter = extractRetryDelay(body) || 6000;

      console.warn(
        `  Rate limit da API em ${year}/${language}. Aguardando ${Math.ceil(retryAfter / 1000)}s e tentando novamente...`
      );

      await sleep(retryAfter);
      continue;
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(
        `A API enem.dev respondeu ${response.status} ao buscar ${year}/${language} com offset ${offset}.\n` +
        `Resposta da API: ${body.slice(0, 600)}`
      );
    }

    const data = await response.json();
    const questions = Array.isArray(data?.questions) ? data.questions : [];

    allQuestions.push(...questions);

    const metadata = data?.metadata || {};
    hasMore = Boolean(metadata.hasMore);

    if (!questions.length) {
      hasMore = false;
    }

    offset += Number(metadata.limit || PAGE_SIZE);
  }

  return allQuestions;
}

function normalizeQuestion(question, { year, requestedLanguage }) {
  const questionIndex = Number(question.index);

  if (!Number.isFinite(questionIndex)) {
    return null;
  }

  const discipline = normalizeDiscipline(question.discipline, questionIndex);

  const language = questionIndex <= 5
    ? normalizeLanguage(question.language || requestedLanguage)
    : null;

  const id = [
    year,
    language || discipline || 'geral',
    questionIndex
  ].join('-');

  const correctAlternative = question.correctAlternative || '';

  const alternatives = Array.isArray(question.alternatives)
    ? question.alternatives.map((alternative, index) => {
      const letter = String(
        alternative.letter ||
        alternative.option ||
        String.fromCharCode(65 + index)
      ).trim().toUpperCase();

      return {
        letter,
        text: alternative.text || alternative.body || '',
        file: alternative.file || alternative.image || null,
        isCorrect: Boolean(alternative.isCorrect || letter === correctAlternative)
      };
    })
    : [];

  return {
    id,
    enem_id: String(question.id || question.slug || id),
    exam_year: Number(question.year || year),
    original_index: questionIndex,
    title: question.title || `Questão ${questionIndex} - ENEM ${year}`,
    discipline,
    area_label: getAreaLabelFromDiscipline(discipline),
    language,
    context: question.context || '',
    statement: question.alternativesIntroduction || question.statement || '',
    alternatives,
    correct_alternative: correctAlternative || findCorrectAlternative(alternatives),
    files: Array.isArray(question.files) ? question.files : [],
    raw: question
  };
}

function getAreaLabelFromDiscipline(discipline) {
  const labels = {
    linguagens: 'Linguagens',
    'ciencias-humanas': 'Ciências Humanas',
    'ciencias-natureza': 'Ciências da Natureza',
    matematica: 'Matemática',
    geral: 'ENEM'
  };

  return labels[discipline] || 'ENEM';
}

function normalizeDiscipline(discipline, questionIndex) {
  const value = String(discipline || '').trim().toLowerCase();

  const map = {
    linguagens: 'linguagens',
    'linguagens-codigos': 'linguagens',
    'ciencias-humanas': 'ciencias-humanas',
    humanas: 'ciencias-humanas',
    'ciencias-natureza': 'ciencias-natureza',
    natureza: 'ciencias-natureza',
    matematica: 'matematica',
    matemática: 'matematica'
  };

  if (map[value]) {
    return map[value];
  }

  if (questionIndex >= 1 && questionIndex <= 45) return 'linguagens';
  if (questionIndex >= 46 && questionIndex <= 90) return 'ciencias-humanas';
  if (questionIndex >= 91 && questionIndex <= 135) return 'ciencias-natureza';
  if (questionIndex >= 136 && questionIndex <= 180) return 'matematica';

  return 'geral';
}

function normalizeLanguage(language) {
  const value = String(language || '').trim().toLowerCase();

  if (value.includes('ingl')) return 'ingles';
  if (value.includes('esp')) return 'espanhol';

  return null;
}

function findCorrectAlternative(alternatives) {
  return alternatives.find((alternative) => alternative.isCorrect)?.letter || '';
}

async function upsertInBatches(rows, batchSize) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);

    const { error } = await supabase
      .from('enem_questions')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      throw new Error(`Erro ao salvar questões no Supabase: ${error.message}`);
    }

    console.log(`  Supabase: ${Math.min(index + batch.length, rows.length)}/${rows.length} salvas.`);
  }
}

function parseYears(value) {
  return String(value)
    .split(',')
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isFinite(year));
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmed.indexOf('=');

    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryDelay(body) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message || '';
    const match = message.match(/(\d+)ms/);

    if (match?.[1]) {
      return Number(match[1]) + 1000;
    }
  } catch {
    return null;
  }

  return null;
}