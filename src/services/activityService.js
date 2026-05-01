import { APP_CONFIG } from '../config.js';
import { load, save } from './storage.js';

const CLASS_ACTIVITIES_KEY = 'classActivities';
const PERSONAL_ACTIVITIES_KEY = 'personalActivities';

export function getActivities() {
  const activities = load(CLASS_ACTIVITIES_KEY, []);
  return Array.isArray(activities) ? activities : [];
}

export function getPublishedActivities() {
  return getActivities().filter((activity) => activity.status === 'published');
}

export function createActivity(data) {
  const activity = normalizeClassActivity(data);
  const activities = [activity, ...getActivities()];
  save(CLASS_ACTIVITIES_KEY, activities);
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
  return activities;
}

export function getActivityById(activityId) {
  return getActivities().find((activity) => activity.id === activityId) ?? null;
}

export function getPersonalActivities(ownerEmail) {
  const activities = load(getPersonalActivitiesKey(ownerEmail), []);
  return Array.isArray(activities) ? activities : [];
}

export function createPersonalActivity(data) {
  const activity = normalizePersonalActivity(data);
  const activities = [activity, ...getPersonalActivities(data.ownerEmail)];
  save(getPersonalActivitiesKey(data.ownerEmail), activities);
  return activity;
}

export function updatePersonalActivity(ownerEmail, activityId, patch) {
  const activities = getPersonalActivities(ownerEmail).map((activity) =>
    activity.id === activityId
      ? { ...activity, ...patch, updatedAt: new Date().toISOString() }
      : activity
  );
  save(getPersonalActivitiesKey(ownerEmail), activities);
  return activities.find((activity) => activity.id === activityId) ?? null;
}

export function markPersonalActivityFinished(activityId, result, attempt) {
  const ownerEmail = attempt?.student?.email;
  if (!ownerEmail || !activityId) return null;

  return updatePersonalActivity(ownerEmail, activityId, {
    status: 'finished',
    finishedAt: result.finalizedAt,
    result,
    attemptSnapshot: { ...attempt, submittedAt: result.finalizedAt, status: result.reason === 'expired' ? 'expirada' : 'finalizada' }
  });
}

export function restorePersonalActivityResult(activity) {
  if (!activity?.result || !activity?.attemptSnapshot) return false;
  save('attempt', activity.attemptSnapshot);
  save('result', activity.result);
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
    sourceMode: data.sourceMode || 'mock',
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
    ownerEmail: data.ownerEmail,
    title: data.title?.trim() || fallback.title,
    classCode: data.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(data.durationMinutes) || fallback.durationMinutes,
    questionCount: Number(data.questionCount) || fallback.questionCount,
    sourceMode: data.sourceMode || 'mock',
    activityType: 'pessoal',
    status: 'created',
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    deadlineAt: null,
    finishedAt: null,
    result: null,
    attemptSnapshot: null
  };
}

function getPersonalActivitiesKey(ownerEmail = '') {
  return `${PERSONAL_ACTIVITIES_KEY}:${String(ownerEmail).trim().toLowerCase() || 'anonimo'}`;
}
