import { APP_CONFIG } from '../config.js';
import { load, save } from './storage.js';

const ACTIVITIES_KEY = 'classActivities';

export function getActivities() {
  const activities = load(ACTIVITIES_KEY, []);
  return Array.isArray(activities) ? activities : [];
}

export function getPublishedActivities() {
  return getActivities().filter((activity) => activity.status === 'published');
}

export function createActivity(data) {
  const activity = normalizeActivity(data);
  const activities = [activity, ...getActivities()];
  save(ACTIVITIES_KEY, activities);
  return activity;
}

export function updateActivityStatus(activityId, status) {
  const normalizedStatus = status === 'draft' ? 'draft' : 'published';
  const activities = getActivities().map((activity) =>
    activity.id === activityId
      ? { ...activity, status: normalizedStatus, updatedAt: new Date().toISOString() }
      : activity
  );
  save(ACTIVITIES_KEY, activities);
  return activities;
}

export function getActivityById(activityId) {
  return getActivities().find((activity) => activity.id === activityId) ?? null;
}

function normalizeActivity(data) {
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
