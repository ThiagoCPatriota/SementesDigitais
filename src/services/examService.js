import { APP_CONFIG } from '../config.js';
import {
  ENEM_AREA_OPTIONS,
  ENEM_NO_LANGUAGE_CHOICE,
  getLanguageLabel,
  isNoLanguageChoice
} from './enemApi.js';
import { fetchQuestionSetFromQuestionBank } from './questionBankService.js';
import { mockQuestions } from '../data/mockQuestions.js';
import { clearAttemptData, load, save } from './storage.js';
import {
  markPersonalActivityFinished,
  recordClassActivityStart,
  updateClassActivityAttemptProgress,
  updateClassActivityAttemptResult,
  updatePersonalActivityProgress
} from './activityService.js';

const FOREIGN_LANGUAGE_COUNT = 5;

export function getExamConfig() {
  return load('examConfig', {
    ...APP_CONFIG.defaultExam,
    sourceMode: 'enem-bank',
    examYear: 'mixed',
    questionSeed: Date.now(),
    requiresLanguageChoice: true,
    areaDistribution: {}
  });
}

export function saveExamConfig(config) {
  const normalized = {
    title: config.title?.trim() || APP_CONFIG.defaultExam.title,
    durationMinutes: Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes,
    questionCount: Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount,
    sourceMode: config.sourceMode || 'enem-bank',
    examYear: config.examYear || 'mixed',
    questionSeed: config.questionSeed || Date.now(),
    requiresLanguageChoice: config.requiresLanguageChoice !== false,
    areaDistribution: normalizeAreaDistribution(config.areaDistribution),
    questionsSnapshot: Array.isArray(config.questionsSnapshot) ? config.questionsSnapshot : []
  };

  save('examConfig', normalized);
  clearAttemptData();
  return normalized;
}

export function getCachedExamQuestions() {
  const result = getResult();
  if (Array.isArray(result?.questionsSnapshot) && result.questionsSnapshot.length > 0) {
    return result.questionsSnapshot;
  }

  const attempt = getCurrentAttempt();
  if (Array.isArray(attempt?.questionsSnapshot) && attempt.questionsSnapshot.length > 0) {
    return attempt.questionsSnapshot;
  }

  if (!attempt || attempt.sourceMode === 'mock') {
    return buildMockExamQuestions(attempt);
  }

  return [];
}

export async function getExamQuestions({ forceReload = false } = {}) {
  const attempt = getCurrentAttempt();

  if (attempt && !forceReload && Array.isArray(attempt.questionsSnapshot) && attempt.questionsSnapshot.length > 0) {
    return attempt.questionsSnapshot;
  }

  if (!attempt || attempt.sourceMode === 'mock') {
    const questions = buildMockExamQuestions(attempt);
    if (attempt) persistQuestionsSnapshot(attempt, questions);
    return questions;
  }

  if (attempt.requiresLanguageChoice !== false && !attempt.languageChoice) {
    return [];
  }

  const questionCount = Number(attempt.questionCount || APP_CONFIG.defaultExam.questionCount);
  const languageChoice = attempt.languageChoice || ENEM_NO_LANGUAGE_CHOICE;
  const questions = await fetchQuestionSetFromQuestionBank({
    questionCount,
    examYear: attempt.examYear || 'mixed',
    seed: attempt.questionSeed || attempt.id || Date.now(),
    language: languageChoice,
    includeLanguageChoice: !isNoLanguageChoice(languageChoice),
    areaDistribution: normalizeAreaDistributionForApi(attempt.areaDistribution)
  });

  persistQuestionsSnapshot(attempt, questions);
  return questions;
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
    sourceMode: config.sourceMode || 'enem-bank',
    examYear: config.examYear || 'mixed',
    questionSeed: config.questionSeed || Date.now(),
    requiresLanguageChoice: config.requiresLanguageChoice !== false,
    includeLanguageChoice: config.includeLanguageChoice !== false,
    areaDistribution: normalizeAreaDistribution(config.areaDistribution),
    questionsSnapshot: Array.isArray(config.questionsSnapshot) ? config.questionsSnapshot : [],
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

  const normalizedChoice = languageChoice || ENEM_NO_LANGUAGE_CHOICE;
  const updatedAttempt = {
    ...attempt,
    languageChoice: normalizedChoice,
    includeLanguageChoice: !isNoLanguageChoice(normalizedChoice),
    requiresLanguageChoice: false,
    questionsSnapshot: []
  };

  save('attempt', updatedAttempt);

  const answers = getAnswers();
  if (updatedAttempt.activityType === 'turma') {
    updateClassActivityAttemptProgress(updatedAttempt, answers);
  }

  if (updatedAttempt.activityType === 'pessoal') {
    updatePersonalActivityProgress(updatedAttempt, answers);
  }

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

  const questions = getCachedExamQuestions();
  if (!Array.isArray(questions) || questions.length === 0) return null;

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
    finalizedAt: new Date().toISOString(),
    questionsSnapshot: questions
  };

  const finalizedAttempt = {
    ...attempt,
    submittedAt: result.finalizedAt,
    status: reason === 'expired' ? 'expirada' : 'finalizada',
    questionsSnapshot: questions
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

function persistQuestionsSnapshot(attempt, questions) {
  if (!attempt || !Array.isArray(questions) || questions.length === 0) return attempt;

  const updatedAttempt = {
    ...attempt,
    questionsSnapshot: questions
  };

  save('attempt', updatedAttempt);

  const answers = getAnswers();
  if (updatedAttempt.activityType === 'turma') {
    updateClassActivityAttemptProgress(updatedAttempt, answers);
  }

  if (updatedAttempt.activityType === 'pessoal') {
    updatePersonalActivityProgress(updatedAttempt, answers);
  }

  return updatedAttempt;
}

function buildMockExamQuestions(attempt = null) {
  const config = getExamConfig();
  const baseQuestionCount = Number(attempt?.questionCount || config.questionCount || APP_CONFIG.defaultExam.questionCount);
  const areaDistribution = normalizeAreaDistribution(attempt?.areaDistribution || config.areaDistribution);
  const languageChoice = attempt?.languageChoice || '';
  const shouldAddLanguageQuestions = Boolean(languageChoice && !isNoLanguageChoice(languageChoice));

  const regularQuestions = hasDistribution(areaDistribution)
    ? selectQuestionsByArea(areaDistribution, baseQuestionCount)
    : takeQuestions(mockQuestions, baseQuestionCount);

  const languageQuestions = shouldAddLanguageQuestions
    ? takeQuestions(mockQuestions, FOREIGN_LANGUAGE_COUNT).map((question, index) => ({
        ...question,
        id: `${question.id || 'questao'}-language-${languageChoice}-${index + 1}`,
        area: 'Linguagens',
        language: languageChoice,
        languageLabel: getLanguageLabel(languageChoice),
        isLanguageQuestion: true
      }))
    : [];

  return [...languageQuestions, ...regularQuestions.slice(0, baseQuestionCount)].map((question, index) => ({
    ...question,
    id: question.id?.includes('-slot-') ? question.id : `${question.id || 'questao'}-slot-${index + 1}`,
    number: index + 1
  }));
}

function normalizeAreaDistribution(distribution = {}) {
  if (!distribution || typeof distribution !== 'object') return {};

  return Object.fromEntries(
    Object.entries(distribution)
      .map(([area, value]) => [area, Number(value || 0)])
      .filter(([, value]) => value > 0)
  );
}

function normalizeAreaDistributionForApi(distribution = {}) {
  const normalized = {};

  Object.entries(distribution || {}).forEach(([area, value]) => {
    const apiArea = toApiArea(area);
    const amount = Number(value || 0);
    if (!apiArea || amount <= 0) return;
    normalized[apiArea] = (normalized[apiArea] || 0) + Math.trunc(amount);
  });

  return normalized;
}

function toApiArea(area = '') {
  const normalized = normalizeArea(area);
  const direct = ENEM_AREA_OPTIONS.find((item) => normalizeArea(item.value) === normalized);
  if (direct) return direct.value;

  if (normalized.includes('linguagens')) return 'linguagens';
  if (normalized.includes('humana')) return 'ciencias-humanas';
  if (normalized.includes('natureza')) return 'ciencias-natureza';
  if (normalized.includes('matematica')) return 'matematica';
  return '';
}

function hasDistribution(distribution = {}) {
  return Object.values(distribution).some((value) => Number(value || 0) > 0);
}

function selectQuestionsByArea(distribution, totalQuestions) {
  const selected = [];

  Object.entries(distribution).forEach(([area, count]) => {
    const areaQuestions = mockQuestions.filter((question) => normalizeArea(question.area) === normalizeArea(toMockAreaLabel(area)));
    selected.push(...takeQuestions(areaQuestions.length ? areaQuestions : mockQuestions, Number(count || 0)));
  });

  if (selected.length < totalQuestions) {
    selected.push(...takeQuestions(mockQuestions, totalQuestions - selected.length));
  }

  return selected;
}

function toMockAreaLabel(area = '') {
  const apiArea = toApiArea(area);
  if (apiArea === 'linguagens') return 'Linguagens';
  if (apiArea === 'ciencias-humanas') return 'Ciências Humanas';
  if (apiArea === 'ciencias-natureza') return 'Ciências da Natureza';
  if (apiArea === 'matematica') return 'Matemática';
  return area;
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
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
