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
    sourceMode: config.sourceMode || 'mock'
  };

  save('examConfig', normalized);
  clearAttemptData();
  return normalized;
}

export function getExamQuestions() {
  const config = getExamConfig();
  const attempt = getCurrentAttempt();
  const questionCount = Number(attempt?.questionCount || config.questionCount || APP_CONFIG.defaultExam.questionCount);

  return mockQuestions.slice(0, questionCount).map((question, index) => ({
    ...question,
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
