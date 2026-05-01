import { APP_CONFIG } from '../config.js';
import { mockQuestions } from '../data/mockQuestions.js';
import { fetchQuestionSetFromEnemDev, normalizeLanguageChoice } from './enemApi.js';
import { clearAttemptData, load, save } from './storage.js';
import {
  markPersonalActivityFinished,
  recordClassActivityStart,
  updateClassActivityAttemptProgress,
  updateClassActivityAttemptResult,
  updatePersonalActivityProgress
} from './activityService.js';

const ATTEMPT_QUESTIONS_KEY = 'attemptQuestions';

export function getExamConfig() {
  return load('examConfig', {
    ...APP_CONFIG.defaultExam,
    sourceMode: 'enem-dev',
    examYear: 'mixed',
    requiresLanguageChoice: true
  });
}

export function saveExamConfig(config) {
  const sourceMode = config.sourceMode || 'enem-dev';
  const normalized = {
    title: config.title?.trim() || APP_CONFIG.defaultExam.title,
    classCode: config.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes,
    questionCount: Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount,
    sourceMode,
    examYear: config.examYear || 'mixed',
    requiresLanguageChoice: sourceMode === 'enem-dev' ? config.requiresLanguageChoice !== false : false
  };

  save('examConfig', normalized);
  clearAttemptData();
  save(ATTEMPT_QUESTIONS_KEY, []);
  return normalized;
}

export function getExamQuestions() {
  const savedQuestions = load(ATTEMPT_QUESTIONS_KEY, []);
  if (Array.isArray(savedQuestions) && savedQuestions.length > 0) {
    return numberQuestions(savedQuestions);
  }

  const attempt = getCurrentAttempt();
  if (Array.isArray(attempt?.questionsSnapshot) && attempt.questionsSnapshot.length > 0) {
    return numberQuestions(attempt.questionsSnapshot);
  }

  const config = getExamConfig();
  const questionCount = Number(attempt?.questionCount || config.questionCount || APP_CONFIG.defaultExam.questionCount);

  if ((attempt?.sourceMode || config.sourceMode) === 'mock') {
    return getMockQuestionSet(questionCount);
  }

  return [];
}

export async function prepareExamQuestions() {
  const attempt = getCurrentAttempt();
  if (!attempt) return [];

  const currentQuestions = getExamQuestions();
  if (currentQuestions.length > 0) return currentQuestions;

  const questionCount = Number(attempt.questionCount || APP_CONFIG.defaultExam.questionCount);
  const sourceMode = attempt.sourceMode || 'enem-dev';
  const seed = attempt.questionSeed || attempt.startedAt || Date.now();
  const examYear = attempt.examYear || 'mixed';
  const languageChoice = normalizeLanguageChoice(attempt.languageChoice || 'ingles');
  const includeLanguageChoice = sourceMode === 'enem-dev' && attempt.requiresLanguageChoice !== false;

  const questions = sourceMode === 'mock'
    ? getMockQuestionSet(questionCount)
    : await fetchQuestionSetFromEnemDev({
        questionCount,
        examYear,
        seed,
        language: languageChoice,
        includeLanguageChoice
      });

  const numberedQuestions = numberQuestions(questions).slice(0, questionCount);
  save(ATTEMPT_QUESTIONS_KEY, numberedQuestions);

  const updatedAttempt = {
    ...attempt,
    languageChoice: includeLanguageChoice ? languageChoice : attempt.languageChoice,
    questionsSnapshot: numberedQuestions,
    updatedAt: new Date().toISOString()
  };

  save('attempt', updatedAttempt);

  const answers = getAnswers();
  if (updatedAttempt.activityType === 'turma') {
    updateClassActivityAttemptProgress(updatedAttempt, answers);
  }

  if (updatedAttempt.activityType === 'pessoal') {
    updatePersonalActivityProgress(updatedAttempt, answers);
  }

  return numberedQuestions;
}

export function startAttempt(student, activityConfig = {}) {
  const defaultConfig = getExamConfig();
  const config = { ...defaultConfig, ...activityConfig };
  const now = new Date();
  const durationMinutes = Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes;
  const questionCount = Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount;
  const sourceMode = config.sourceMode || 'enem-dev';
  const requiresLanguageChoice = sourceMode === 'enem-dev' && config.requiresLanguageChoice !== false;
  const deadline = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const attempt = {
    id: `attempt-${Date.now()}`,
    student,
    examTitle: config.title,
    activityType: config.activityType || 'turma',
    activityId: config.activityId || config.id || null,
    durationMinutes,
    questionCount,
    sourceMode,
    examYear: config.examYear || 'mixed',
    requiresLanguageChoice,
    languageChoice: requiresLanguageChoice ? config.languageChoice || '' : config.languageChoice || '',
    questionSeed: config.questionSeed || Date.now(),
    questionsSnapshot: Array.isArray(config.questionsSnapshot) ? config.questionsSnapshot : [],
    startedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    submittedAt: null,
    status: 'em_andamento'
  };

  save('attempt', attempt);
  save('answers', {});
  save('result', null);
  save(ATTEMPT_QUESTIONS_KEY, attempt.questionsSnapshot || []);

  if (attempt.activityType === 'turma' && attempt.activityId) {
    recordClassActivityStart(config, attempt);
  }

  return attempt;
}

export function setAttemptLanguageChoice(languageChoice) {
  const attempt = getCurrentAttempt();
  if (!attempt) return null;

  const normalizedLanguage = normalizeLanguageChoice(languageChoice);
  const updatedAttempt = {
    ...attempt,
    languageChoice: normalizedLanguage,
    questionsSnapshot: [],
    updatedAt: new Date().toISOString()
  };

  save('attempt', updatedAttempt);
  save(ATTEMPT_QUESTIONS_KEY, []);

  const answers = getAnswers();
  if (updatedAttempt.activityType === 'turma') {
    updateClassActivityAttemptProgress(updatedAttempt, answers);
  }

  if (updatedAttempt.activityType === 'pessoal') {
    updatePersonalActivityProgress(updatedAttempt, answers);
  }

  return updatedAttempt;
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
  if (!questions.length) return null;

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
    languageChoice: attempt.languageChoice || '',
    questionsSnapshot: questions,
    finalizedAt: new Date().toISOString()
  };

  const finalizedAttempt = {
    ...attempt,
    questionsSnapshot: questions,
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

function getMockQuestionSet(questionCount) {
  return mockQuestions.slice(0, questionCount).map((question, index) => ({
    ...question,
    number: index + 1
  }));
}

function numberQuestions(questions) {
  return questions.map((question, index) => ({
    ...question,
    number: index + 1
  }));
}
