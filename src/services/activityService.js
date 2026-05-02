import { APP_CONFIG } from '../config.js';
import { load, save } from './storage.js';
import {
  fetchCloudActivities,
  fetchCloudActivityAttempts,
  fetchCloudPersonalActivities,
  isCloudDataEnabled,
  updateCloudActivityStatus,
  upsertCloudActivity,
  upsertCloudActivityAttempt,
  upsertCloudPersonalActivity
} from './supabaseDataService.js';

const CLASS_ACTIVITIES_KEY = 'classActivities';
const PERSONAL_ACTIVITIES_KEY = 'personalActivities';
const CLASS_ACTIVITY_ATTEMPTS_KEY = 'classActivityAttempts';

export function getDataStorageMode() {
  return isCloudDataEnabled() ? 'supabase' : 'local';
}

export async function syncActivitiesFromCloud() {
  const cloudActivities = await fetchCloudActivities();
  if (Array.isArray(cloudActivities)) {
    save(CLASS_ACTIVITIES_KEY, sortByDateDesc(cloudActivities));
  }
  return getActivities();
}

export async function syncActivityAttemptsFromCloud(activityId = '') {
  const cloudAttempts = await fetchCloudActivityAttempts(activityId);
  if (Array.isArray(cloudAttempts)) {
    if (activityId) {
      const otherAttempts = getActivityAttempts().filter((attempt) => attempt.activityId !== activityId);
      save(CLASS_ACTIVITY_ATTEMPTS_KEY, sortByDateDesc([...cloudAttempts, ...otherAttempts], 'startedAt'));
    } else {
      save(CLASS_ACTIVITY_ATTEMPTS_KEY, sortByDateDesc(cloudAttempts, 'startedAt'));
    }
  }
  return getActivityAttempts();
}

export async function syncPersonalActivitiesFromCloud(ownerEmail) {
  const cloudActivities = await fetchCloudPersonalActivities(ownerEmail);
  if (Array.isArray(cloudActivities)) {
    save(getPersonalActivitiesKey(ownerEmail), sortByDateDesc(cloudActivities));
  }
  return getPersonalActivities(ownerEmail);
}

export async function syncDashboardDataFromCloud(ownerEmail = '') {
  await Promise.all([
    syncActivitiesFromCloud(),
    syncActivityAttemptsFromCloud(),
    ownerEmail ? syncPersonalActivitiesFromCloud(ownerEmail) : Promise.resolve([])
  ]);
}

export function getActivities() {
  const activities = load(CLASS_ACTIVITIES_KEY, []);
  return Array.isArray(activities) ? sortByDateDesc(activities) : [];
}

export function getPublishedActivities() {
  return getActivities().filter((activity) => activity.status === 'published');
}

export function createActivity(data) {
  const activity = normalizeClassActivity(data);
  const activities = [activity, ...getActivities().filter((item) => item.id !== activity.id)];
  save(CLASS_ACTIVITIES_KEY, activities);
  mirrorToCloud(upsertCloudActivity(activity));
  return activity;
}

export function updateActivityStatus(activityId, status) {
  const normalizedStatus = status === 'draft' ? 'draft' : 'published';
  const activities = getActivities().map((activity) =>
    activity.id === activityId
      ? { ...activity, status: normalizedStatus, updatedAt: new Date().toISOString() }
      : activity
  );
  save(CLASS_ACTIVITIES_KEY, activities);
  mirrorToCloud(updateCloudActivityStatus(activityId, normalizedStatus));
  return sortByDateDesc(activities);
}

export function getActivityById(activityId) {
  return getActivities().find((activity) => activity.id === activityId) ?? null;
}

export function getActivityAttempts() {
  const attempts = load(CLASS_ACTIVITY_ATTEMPTS_KEY, []);
  return Array.isArray(attempts) ? sortByDateDesc(attempts, 'startedAt') : [];
}

export function getActivityResponses(activityId) {
  return getActivityAttempts()
    .filter((attempt) => attempt.activityId === activityId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getStudentClassActivityAttempt(activityId, studentEmail) {
  const normalizedEmail = normalizeEmail(studentEmail);
  return getActivityResponses(activityId)
    .filter((attempt) => normalizeEmail(attempt.student?.email) === normalizedEmail)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ?? null;
}

export function recordClassActivityStart(activityConfig, attempt) {
  if (!attempt?.activityId) return null;

  const attempts = getActivityAttempts();
  const existingForStudent = attempts.find((item) =>
    item.activityId === attempt.activityId &&
    normalizeEmail(item.student?.email) === normalizeEmail(attempt.student?.email)
  );

  if (existingForStudent?.result) return existingForStudent;

  const record = {
    ...(existingForStudent ?? {}),
    id: existingForStudent?.id || attempt.id,
    attemptId: existingForStudent?.attemptId || attempt.id,
    activityId: attempt.activityId,
    activityTitle: attempt.examTitle || activityConfig.title,
    activityType: 'turma',
    student: sanitizeStudent(attempt.student),
    startedAt: existingForStudent?.startedAt || attempt.startedAt,
    deadlineAt: existingForStudent?.deadlineAt || attempt.deadlineAt,
    submittedAt: null,
    status: 'em_andamento',
    totalQuestions: Number(attempt.questionCount || activityConfig.questionCount || APP_CONFIG.defaultExam.questionCount),
    languageChoice: attempt.languageChoice || existingForStudent?.languageChoice || '',
    answeredCount: existingForStudent?.answeredCount ?? 0,
    correctCount: null,
    wrongCount: null,
    blankCount: null,
    scorePercent: null,
    result: null,
    attemptSnapshot: existingForStudent?.attemptSnapshot || attempt,
    answersSnapshot: existingForStudent?.answersSnapshot || {},
    createdAt: existingForStudent?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const withoutCurrent = attempts.filter((item) => item.id !== record.id && item.attemptId !== record.attemptId);
  const next = [record, ...withoutCurrent];
  save(CLASS_ACTIVITY_ATTEMPTS_KEY, next);
  mirrorToCloud(upsertCloudActivityAttempt(record));
  return record;
}

export function updateClassActivityAttemptProgress(attempt, answersSnapshot = {}) {
  if (!attempt?.activityId || attempt.activityType !== 'turma') return null;

  const attempts = getActivityAttempts();
  const existing = attempts.find((item) =>
    item.activityId === attempt.activityId &&
    normalizeEmail(item.student?.email) === normalizeEmail(attempt.student?.email)
  );

  if (!existing || existing.result) return existing ?? null;

  const record = {
    ...existing,
    languageChoice: attempt.languageChoice || existing.languageChoice || '',
    answeredCount: Object.keys(answersSnapshot || {}).length,
    attemptSnapshot: { ...attempt, status: existing.status || attempt.status },
    answersSnapshot,
    updatedAt: new Date().toISOString()
  };

  const next = [record, ...attempts.filter((item) => item.id !== record.id && item.attemptId !== record.attemptId)];
  save(CLASS_ACTIVITY_ATTEMPTS_KEY, next);
  mirrorToCloud(upsertCloudActivityAttempt(record));
  return record;
}

export function updateClassActivityAttemptResult(attempt, result, answersSnapshot = {}) {
  if (!attempt?.activityId || !result) return null;

  const attempts = getActivityAttempts();
  const existing = attempts.find((item) =>
    item.activityId === attempt.activityId &&
    normalizeEmail(item.student?.email) === normalizeEmail(attempt.student?.email)
  );
  const answeredCount = Number(result.answeredCount || 0);
  const correctCount = Number(result.correctCount || 0);

  const record = {
    ...(existing ?? {}),
    id: existing?.id || attempt.id,
    attemptId: existing?.attemptId || attempt.id,
    activityId: attempt.activityId,
    activityTitle: attempt.examTitle,
    activityType: 'turma',
    student: sanitizeStudent(attempt.student),
    startedAt: existing?.startedAt || attempt.startedAt,
    deadlineAt: existing?.deadlineAt || attempt.deadlineAt,
    submittedAt: result.finalizedAt,
    status: result.reason === 'expired' ? 'expirada' : 'finalizada',
    totalQuestions: Number(result.totalQuestions || attempt.questionCount || APP_CONFIG.defaultExam.questionCount),
    answeredCount,
    correctCount,
    wrongCount: Math.max(0, answeredCount - correctCount),
    blankCount: Number(result.blankCount || 0),
    languageChoice: attempt.languageChoice || result.languageChoice || existing?.languageChoice || '',
    scorePercent: Number(result.scorePercent || 0),
    result,
    attemptSnapshot: { ...attempt, submittedAt: result.finalizedAt, status: result.reason === 'expired' ? 'expirada' : 'finalizada' },
    answersSnapshot,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  const withoutCurrent = attempts.filter((item) => item.id !== record.id && item.attemptId !== record.attemptId);
  const next = [record, ...withoutCurrent];
  save(CLASS_ACTIVITY_ATTEMPTS_KEY, next);
  mirrorToCloud(upsertCloudActivityAttempt(record));
  return record;
}

export function restoreClassActivityAttempt(activityId, studentEmail) {
  const record = getStudentClassActivityAttempt(activityId, studentEmail);
  if (!record || record.result || !record.attemptSnapshot) return false;

  save('attempt', record.attemptSnapshot);
  save('answers', record.answersSnapshot || {});
  save('attemptQuestions', record.attemptSnapshot?.questionsSnapshot || []);
  save('result', null);
  return true;
}

export function restoreClassActivityResult(activityId, studentEmail) {
  const record = getStudentClassActivityAttempt(activityId, studentEmail);
  if (!record?.result || !record?.attemptSnapshot) return false;

  save('attempt', record.attemptSnapshot);
  save('result', record.result);
  save('answers', record.answersSnapshot || {});
  save('attemptQuestions', record.attemptSnapshot?.questionsSnapshot || record.result?.questionsSnapshot || []);
  return true;
}

export function getPersonalActivities(ownerEmail) {
  const activities = load(getPersonalActivitiesKey(ownerEmail), []);
  return Array.isArray(activities) ? sortByDateDesc(activities) : [];
}

export function createPersonalActivity(data) {
  const activity = normalizePersonalActivity(data);
  const activities = [activity, ...getPersonalActivities(data.ownerEmail).filter((item) => item.id !== activity.id)];
  save(getPersonalActivitiesKey(data.ownerEmail), activities);
  mirrorToCloud(upsertCloudPersonalActivity(activity));
  return activity;
}

export function updatePersonalActivity(ownerEmail, activityId, patch) {
  const activities = getPersonalActivities(ownerEmail).map((activity) =>
    activity.id === activityId
      ? { ...activity, ...patch, updatedAt: new Date().toISOString() }
      : activity
  );
  save(getPersonalActivitiesKey(ownerEmail), activities);
  const updatedActivity = activities.find((activity) => activity.id === activityId) ?? null;
  if (updatedActivity) mirrorToCloud(upsertCloudPersonalActivity(updatedActivity));
  return updatedActivity;
}

export function updatePersonalActivityProgress(attempt, answersSnapshot = {}) {
  if (!attempt?.activityId || attempt.activityType !== 'pessoal') return null;
  const ownerEmail = attempt.student?.email;
  if (!ownerEmail) return null;

  return updatePersonalActivity(ownerEmail, attempt.activityId, {
    status: 'in_progress',
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    attemptSnapshot: attempt,
    answersSnapshot
  });
}

export function markPersonalActivityFinished(activityId, result, attempt, answersSnapshot = {}) {
  const ownerEmail = attempt?.student?.email;
  if (!ownerEmail || !activityId) return null;

  return updatePersonalActivity(ownerEmail, activityId, {
    status: 'finished',
    finishedAt: result.finalizedAt,
    result,
    answersSnapshot,
    attemptSnapshot: { ...attempt, submittedAt: result.finalizedAt, status: result.reason === 'expired' ? 'expirada' : 'finalizada' }
  });
}

export function restorePersonalActivityAttempt(activity) {
  if (!activity?.attemptSnapshot || activity.result || activity.status === 'finished') return false;
  save('attempt', activity.attemptSnapshot);
  save('answers', activity.answersSnapshot || {});
  save('attemptQuestions', activity.attemptSnapshot?.questionsSnapshot || []);
  save('result', null);
  return true;
}

export function restorePersonalActivityResult(activity) {
  if (!activity?.result || !activity?.attemptSnapshot) return false;
  save('attempt', activity.attemptSnapshot);
  save('result', activity.result);
  save('answers', activity.answersSnapshot || {});
  save('attemptQuestions', activity.attemptSnapshot?.questionsSnapshot || activity.result?.questionsSnapshot || []);
  return true;
}

export function isActivityExpired(activity) {
  if (!activity?.deadlineAt || activity.status === 'finished') return activity?.status === 'finished';
  return Date.now() > new Date(activity.deadlineAt).getTime();
}

function normalizeClassActivity(data) {
  const createdAt = new Date().toISOString();
  const title = data.title?.trim() || APP_CONFIG.defaultExam.title;

  return {
    id: data.id || `activity-${Date.now()}`,
    title,
    classCode: data.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(data.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes,
    questionCount: Number(data.questionCount) || APP_CONFIG.defaultExam.questionCount,
    sourceMode: data.sourceMode || 'enem-dev',
    examYear: data.examYear || 'mixed',
    requiresLanguageChoice: (data.sourceMode || 'enem-dev') === 'enem-dev' ? data.requiresLanguageChoice !== false : false,
    areaDistribution: normalizeAreaDistribution(data.areaDistribution),
    questionSeed: data.questionSeed || Date.now(),
    questionsSnapshot: Array.isArray(data.questionsSnapshot) ? data.questionsSnapshot : [],
    activityType: 'turma',
    status: data.status || (data.publishNow ? 'published' : 'draft'),
    createdAt,
    updatedAt: createdAt
  };
}

function normalizePersonalActivity(data) {
  const createdAt = new Date().toISOString();
  const fallback = APP_CONFIG.personalActivity;

  return {
    id: data.id || `personal-${Date.now()}`,
    ownerEmail: normalizeEmail(data.ownerEmail),
    title: data.title?.trim() || fallback.title,
    classCode: data.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(data.durationMinutes) || fallback.durationMinutes,
    questionCount: Number(data.questionCount) || fallback.questionCount,
    sourceMode: data.sourceMode || 'enem-dev',
    examYear: data.examYear || 'mixed',
    requiresLanguageChoice: (data.sourceMode || 'enem-dev') === 'enem-dev' ? data.requiresLanguageChoice !== false : false,
    areaDistribution: normalizeAreaDistribution(data.areaDistribution),
    questionSeed: data.questionSeed || Date.now(),
    questionsSnapshot: Array.isArray(data.questionsSnapshot) ? data.questionsSnapshot : [],
    activityType: 'pessoal',
    status: 'created',
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    deadlineAt: null,
    finishedAt: null,
    result: null,
    attemptSnapshot: null,
    answersSnapshot: {}
  };
}

function normalizeAreaDistribution(distribution = {}) {
  if (!distribution || typeof distribution !== 'object') return {};

  return Object.entries(distribution).reduce((accumulator, [key, value]) => {
    const number = Math.max(0, Math.trunc(Number(value) || 0));
    if (number > 0) accumulator[key] = number;
    return accumulator;
  }, {});
}

function getPersonalActivitiesKey(ownerEmail = '') {
  return `${PERSONAL_ACTIVITIES_KEY}:${normalizeEmail(ownerEmail) || 'anonimo'}`;
}

function sortByDateDesc(items, field = 'createdAt') {
  return [...items].sort((a, b) => new Date(b[field] || b.createdAt).getTime() - new Date(a[field] || a.createdAt).getTime());
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

function mirrorToCloud(promise) {
  if (!promise || typeof promise.catch !== 'function') return;
  promise.catch((error) => {
    console.warn('Não foi possível sincronizar com o Supabase neste momento.', error);
  });
}
