import { APP_CONFIG } from '../config.js';
import { mockQuestions } from '../data/mockQuestions.js';
import { clearAttemptData, load, save } from './storage.js';
import {
  markPersonalActivityFinished,
  recordClassActivityStart,
  updateClassActivityAttemptProgress,
  updateClassActivityAttemptResult,
  updatePersonalActivityProgress
} from './activityService.js';

export function getExamConfig() {
  return load('examConfig', {
    ...APP_CONFIG.defaultExam,
    sourceMode: 'mock'
  });
}

export function saveExamConfig(config) {
  const normalized = {
    title: config.title?.trim() || APP_CONFIG.defaultExam.title,
    classCode: config.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes,
    questionCount: Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount,
    sourceMode: config.sourceMode || 'mock',
    areaDistribution: normalizeAreaDistribution(config.areaDistribution)
  };

  save('examConfig', normalized);
  clearAttemptData();
  return normalized;
}

export function getExamQuestions() {
  const config = getExamConfig();
  const attempt = getCurrentAttempt();
  const questionCount = Number(attempt?.questionCount || config.questionCount || APP_CONFIG.defaultExam.questionCount);
  const areaDistribution = normalizeAreaDistribution(attempt?.areaDistribution || config.areaDistribution);

  const selectedQuestions = hasDistribution(areaDistribution)
    ? selectQuestionsByArea(areaDistribution, questionCount)
    : takeQuestions(mockQuestions, questionCount);

  return selectedQuestions.slice(0, questionCount).map((question, index) => ({
    ...question,
    id: `${question.id}-slot-${index + 1}`,
    number: index + 1
  }));
}

export function startAttempt(student, activityConfig = {}) {
  const defaultConfig = getExamConfig();
  const config = { ...defaultConfig, ...activityConfig };
  const now = new Date();
  const durationMinutes = Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes;
  const questionCount = Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount;
  const deadline = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const attempt = {
    id: `attempt-${Date.now()}`,
    student,
    examTitle: config.title,
    activityType: config.activityType || 'turma',
    activityId: config.activityId || config.id || null,
    durationMinutes,
    questionCount,
    areaDistribution: normalizeAreaDistribution(config.areaDistribution),
    startedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    submittedAt: null,
    status: 'em_andamento'
  };

  save('attempt', attempt);
  save('answers', {});
  save('result', null);

  if (attempt.activityType === 'turma' && attempt.activityId) {
    recordClassActivityStart(config, attempt);
  }

  return attempt;
}

export function getCurrentAttempt() {
  return load('attempt', null);
}

export function setAttemptLanguageChoice(languageChoice) {
  const attempt = getCurrentAttempt();
  if (!attempt) return null;

  const updatedAttempt = {
    ...attempt,
    languageChoice,
    requiresLanguageChoice: false
  };

  save('attempt', updatedAttempt);
  return updatedAttempt;
}

export function getAnswers() {
  return load('answers', {});
}

export function saveAnswer(questionId, letter) {
  const answers = getAnswers();
  answers[questionId] = {
    selectedAlternative: letter,
    answeredAt: new Date().toISOString()
  };
  save('answers', answers);

  const attempt = getCurrentAttempt();
  if (attempt?.activityType === 'turma') {
    updateClassActivityAttemptProgress(attempt, answers);
  }

  if (attempt?.activityType === 'pessoal') {
    updatePersonalActivityProgress(attempt, answers);
  }

  return answers;
}

export function finalizeAttempt(reason = 'manual') {
  const attempt = getCurrentAttempt();
  if (!attempt) return null;

  const questions = getExamQuestions();
  const answers = getAnswers();
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.reduce((total, question) => {
    const selected = answers[question.id]?.selectedAlternative;
    return total + (selected === question.correctAlternative ? 1 : 0);
  }, 0);

  const result = {
    attemptId: attempt.id,
    reason,
    totalQuestions: questions.length,
    answeredCount,
    correctCount,
    blankCount: questions.length - answeredCount,
    scorePercent: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    finalizedAt: new Date().toISOString()
  };

  const finalizedAttempt = {
    ...attempt,
    submittedAt: result.finalizedAt,
    status: reason === 'expired' ? 'expirada' : 'finalizada'
  };

  save('attempt', finalizedAttempt);
  save('result', result);

  if (finalizedAttempt.activityType === 'pessoal' && finalizedAttempt.activityId) {
    markPersonalActivityFinished(finalizedAttempt.activityId, result, finalizedAttempt, answers);
  }

  if (finalizedAttempt.activityType === 'turma' && finalizedAttempt.activityId) {
    updateClassActivityAttemptResult(finalizedAttempt, result, answers);
  }

  return result;
}

export function getResult() {
  return load('result', null);
}

function normalizeAreaDistribution(distribution = {}) {
  if (!distribution || typeof distribution !== 'object') return {};

  return Object.fromEntries(
    Object.entries(distribution)
      .map(([area, value]) => [area, Number(value || 0)])
      .filter(([, value]) => value > 0)
  );
}

function hasDistribution(distribution = {}) {
  return Object.values(distribution).some((value) => Number(value || 0) > 0);
}

function selectQuestionsByArea(distribution, totalQuestions) {
  const selected = [];

  Object.entries(distribution).forEach(([area, count]) => {
    const areaQuestions = mockQuestions.filter((question) => normalizeArea(question.area) === normalizeArea(area));
    selected.push(...takeQuestions(areaQuestions.length ? areaQuestions : mockQuestions, Number(count || 0)));
  });

  if (selected.length < totalQuestions) {
    selected.push(...takeQuestions(mockQuestions, totalQuestions - selected.length));
  }

  return selected;
}

function takeQuestions(sourceQuestions, count) {
  const source = Array.isArray(sourceQuestions) && sourceQuestions.length ? sourceQuestions : mockQuestions;
  const total = Math.max(0, Number(count || 0));

  return Array.from({ length: total }, (_, index) => ({
    ...source[index % source.length]
  }));
}

function normalizeArea(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
