import { getSupabaseClient, hasSupabaseConfig } from './supabaseClient.js';

const TABLES = {
  classActivities: 'class_activities',
  classAttempts: 'class_activity_attempts',
  personalActivities: 'personal_activities'
};

export function isCloudDataEnabled() {
  return hasSupabaseConfig();
}

export async function fetchCloudActivities() {
  return runCloudReadQuery(async (supabase) => {
    const { data, error } = await supabase
      .from(TABLES.classActivities)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data.map(activityFromRow) : [];
  }, null, 'buscar atividades no Supabase');
}

export async function upsertCloudActivity(activity) {
  if (!activity?.id) return false;

  return runCloudWriteQuery(async (supabase) => {
    const { error } = await supabase
      .from(TABLES.classActivities)
      .upsert(activityToRow(activity), { onConflict: 'id' });

    if (error) throw error;
    return true;
  }, 'salvar atividade no Supabase');
}

export async function updateCloudActivityStatus(activityId, status) {
  if (!activityId) return false;

  return runCloudWriteQuery(async (supabase) => {
    const { error } = await supabase
      .from(TABLES.classActivities)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', activityId);

    if (error) throw error;
    return true;
  }, 'atualizar status da atividade no Supabase');
}

export async function fetchCloudActivityAttempts(activityId = '') {
  return runCloudReadQuery(async (supabase) => {
    let query = supabase
      .from(TABLES.classAttempts)
      .select('*')
      .order('started_at', { ascending: false });

    if (activityId) query = query.eq('activity_id', activityId);

    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data.map(attemptFromRow) : [];
  }, null, 'buscar tentativas no Supabase');
}

export async function upsertCloudActivityAttempt(record) {
  if (!record?.activityId || !record?.student?.email) return false;

  return runCloudWriteQuery(async (supabase) => {
    const { error } = await supabase
      .from(TABLES.classAttempts)
      .upsert(attemptToRow(record), { onConflict: 'activity_id,student_email' });

    if (error) throw error;
    return true;
  }, 'salvar tentativa/resposta no Supabase');
}

export async function fetchCloudPersonalActivities(ownerEmail) {
  const normalizedOwnerEmail = normalizeEmail(ownerEmail);
  if (!normalizedOwnerEmail) return null;

  return runCloudReadQuery(async (supabase) => {
    const { data, error } = await supabase
      .from(TABLES.personalActivities)
      .select('*')
      .eq('owner_email', normalizedOwnerEmail)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data.map(personalActivityFromRow) : [];
  }, null, 'buscar atividades pessoais no Supabase');
}

export async function upsertCloudPersonalActivity(activity) {
  if (!activity?.id || !activity?.ownerEmail) return false;

  return runCloudWriteQuery(async (supabase) => {
    const { error } = await supabase
      .from(TABLES.personalActivities)
      .upsert(personalActivityToRow(activity), { onConflict: 'id' });

    if (error) throw error;
    return true;
  }, 'salvar atividade pessoal no Supabase');
}

async function runCloudReadQuery(operation, fallback, label) {
  const supabase = await getSupabaseClient();
  if (!supabase) return fallback;

  try {
    return await operation(supabase);
  } catch (error) {
    console.warn(`Falha ao ${label}. Cache local preservado.`, error);
    return fallback;
  }
}

async function runCloudWriteQuery(operation, label) {
  const supabase = await getSupabaseClient();
  if (!supabase) return false;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Não foi possível validar a sessão do Supabase: ${sessionError.message}`);
  if (!sessionData?.session) {
    throw new Error('O Supabase está configurado, mas esta sessão ainda não está autenticada no Supabase. Faça logout, entre novamente e tente criar o simulado de novo.');
  }

  try {
    return await operation(supabase);
  } catch (error) {
    console.error(`Falha ao ${label}.`, error);
    throw new Error(formatSupabaseError(error, label));
  }
}

function formatSupabaseError(error, label) {
  const message = error?.message || String(error || 'erro desconhecido');
  const code = error?.code ? ` Código: ${error.code}.` : '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('row-level security') || lowerMessage.includes('violates row-level security')) {
    return `O Supabase recusou ${label} por regra de segurança (RLS). Confirme se o e-mail logado está cadastrado como administrador na tabela admin_users e se você executou o SQL de correção enviado.`;
  }

  if (lowerMessage.includes('permission denied') || lowerMessage.includes('not authorized')) {
    return `Sem permissão para ${label}. Confirme se você está logado com uma conta administradora no Supabase.`;
  }

  if (lowerMessage.includes('relation') && lowerMessage.includes('does not exist')) {
    return `A tabela necessária ainda não existe no Supabase. Execute o schema SQL atualizado antes de continuar.`;
  }

  if (lowerMessage.includes('column') && lowerMessage.includes('does not exist')) {
    return `Existe uma coluna faltando no Supabase. Execute o SQL de atualização do schema antes de continuar.`;
  }

  return `Não foi possível ${label}.${code} Mensagem do Supabase: ${message}`;
}

function activityToRow(activity) {
  return {
    id: activity.id,
    title: activity.title,
    class_code: activity.classCode || '',
    duration_minutes: Number(activity.durationMinutes || 0),
    question_count: Number(activity.questionCount || 0),
    source_mode: activity.sourceMode || 'enem-dev',
    exam_year: String(activity.examYear || 'mixed'),
    requires_language_choice: activity.requiresLanguageChoice !== false,
    area_distribution: normalizeJsonObject(activity.areaDistribution),
    question_seed: normalizeSeed(activity.questionSeed),
    questions_snapshot: Array.isArray(activity.questionsSnapshot) ? activity.questionsSnapshot : [],
    activity_type: activity.activityType || 'turma',
    status: activity.status || 'draft',
    created_at: activity.createdAt || new Date().toISOString(),
    updated_at: activity.updatedAt || new Date().toISOString()
  };
}

function activityFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    classCode: row.class_code,
    durationMinutes: Number(row.duration_minutes || 0),
    questionCount: Number(row.question_count || 0),
    sourceMode: row.source_mode || 'enem-dev',
    examYear: row.exam_year || 'mixed',
    requiresLanguageChoice: row.requires_language_choice !== false,
    areaDistribution: normalizeJsonObject(row.area_distribution),
    questionSeed: row.question_seed || Date.now(),
    questionsSnapshot: Array.isArray(row.questions_snapshot) ? row.questions_snapshot : [],
    activityType: row.activity_type || 'turma',
    status: row.status || 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function attemptToRow(record) {
  const student = sanitizeStudent(record.student);

  return {
    id: record.id || record.attemptId,
    attempt_id: record.attemptId || record.id,
    activity_id: record.activityId,
    activity_title: record.activityTitle || '',
    activity_type: record.activityType || 'turma',
    student,
    student_email: normalizeEmail(student.email),
    started_at: record.startedAt || new Date().toISOString(),
    deadline_at: record.deadlineAt || null,
    submitted_at: record.submittedAt || null,
    status: record.status || 'em_andamento',
    total_questions: Number(record.totalQuestions || 0),
    language_choice: record.languageChoice || '',
    answered_count: Number(record.answeredCount || 0),
    correct_count: nullableNumber(record.correctCount),
    wrong_count: nullableNumber(record.wrongCount),
    blank_count: nullableNumber(record.blankCount),
    score_percent: nullableNumber(record.scorePercent),
    result: record.result || null,
    attempt_snapshot: record.attemptSnapshot || null,
    answers_snapshot: record.answersSnapshot || {},
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString()
  };
}

function attemptFromRow(row) {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    activityId: row.activity_id,
    activityTitle: row.activity_title,
    activityType: row.activity_type || 'turma',
    student: row.student || {},
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    status: row.status || 'em_andamento',
    totalQuestions: Number(row.total_questions || 0),
    languageChoice: row.language_choice || '',
    answeredCount: Number(row.answered_count || 0),
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    blankCount: row.blank_count,
    scorePercent: row.score_percent,
    result: row.result,
    attemptSnapshot: row.attempt_snapshot,
    answersSnapshot: row.answers_snapshot || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function personalActivityToRow(activity) {
  return {
    id: activity.id,
    owner_email: normalizeEmail(activity.ownerEmail),
    title: activity.title,
    class_code: activity.classCode || '',
    duration_minutes: Number(activity.durationMinutes || 0),
    question_count: Number(activity.questionCount || 0),
    source_mode: activity.sourceMode || 'enem-dev',
    exam_year: String(activity.examYear || 'mixed'),
    requires_language_choice: activity.requiresLanguageChoice !== false,
    area_distribution: normalizeJsonObject(activity.areaDistribution),
    question_seed: normalizeSeed(activity.questionSeed),
    questions_snapshot: Array.isArray(activity.questionsSnapshot) ? activity.questionsSnapshot : [],
    activity_type: activity.activityType || 'pessoal',
    status: activity.status || 'created',
    started_at: activity.startedAt || null,
    deadline_at: activity.deadlineAt || null,
    finished_at: activity.finishedAt || null,
    result: activity.result || null,
    attempt_snapshot: activity.attemptSnapshot || null,
    answers_snapshot: activity.answersSnapshot || {},
    created_at: activity.createdAt || new Date().toISOString(),
    updated_at: activity.updatedAt || new Date().toISOString()
  };
}

function personalActivityFromRow(row) {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    title: row.title,
    classCode: row.class_code,
    durationMinutes: Number(row.duration_minutes || 0),
    questionCount: Number(row.question_count || 0),
    sourceMode: row.source_mode || 'enem-dev',
    examYear: row.exam_year || 'mixed',
    requiresLanguageChoice: row.requires_language_choice !== false,
    areaDistribution: normalizeJsonObject(row.area_distribution),
    questionSeed: row.question_seed || Date.now(),
    questionsSnapshot: Array.isArray(row.questions_snapshot) ? row.questions_snapshot : [],
    activityType: row.activity_type || 'pessoal',
    status: row.status || 'created',
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    finishedAt: row.finished_at,
    result: row.result,
    attemptSnapshot: row.attempt_snapshot,
    answersSnapshot: row.answers_snapshot || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeJsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeSeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : Date.now();
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function sanitizeStudent(student = {}) {
  return {
    name: student.name || 'Aluno',
    email: student.email || '',
    phone: student.phone || '',
    classGroup: student.classGroup || ''
  };
}
