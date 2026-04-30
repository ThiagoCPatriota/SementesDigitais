import { APP_CONFIG } from '../config.js';
import { mockQuestions } from '../data/mockQuestions.js';
import { essayThemes } from '../data/essayThemes.js';
import { clearAttemptData, load, save } from './storage.js';

export function getExamConfig() {
  return load('examConfig', {
    ...APP_CONFIG.defaultExam,
    essayThemeId: essayThemes[0].id,
    sourceMode: 'mock'
  });
}

export function saveExamConfig(config) {
  const normalized = {
    title: config.title?.trim() || APP_CONFIG.defaultExam.title,
    classCode: config.classCode?.trim() || APP_CONFIG.defaultExam.classCode,
    durationMinutes: Number(config.durationMinutes) || APP_CONFIG.defaultExam.durationMinutes,
    questionCount: Number(config.questionCount) || APP_CONFIG.defaultExam.questionCount,
    essayThemeId: config.essayThemeId || essayThemes[0].id,
    sourceMode: config.sourceMode || 'mock'
  };

  save('examConfig', normalized);
  clearAttemptData();
  return normalized;
}

export function getSelectedTheme() {
  const config = getExamConfig();
  return essayThemes.find((theme) => theme.id === config.essayThemeId) ?? essayThemes[0];
}

export function getExamQuestions() {
  const config = getExamConfig();
  return mockQuestions.slice(0, config.questionCount).map((question, index) => ({
    ...question,
    number: index + 1
  }));
}

export function startAttempt(student) {
  const config = getExamConfig();
  const now = new Date();
  const deadline = new Date(now.getTime() + config.durationMinutes * 60 * 1000);

  const attempt = {
    id: `attempt-${Date.now()}`,
    student,
    examTitle: config.title,
    startedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    submittedAt: null,
    status: 'em_andamento'
  };

  save('attempt', attempt);
  save('answers', {});
  save('essay', '');
  save('result', null);
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
  return answers;
}

export function saveEssay(content) {
  save('essay', content);
}

export function getEssay() {
  return load('essay', '');
}

export function finalizeAttempt(reason = 'manual') {
  const attempt = getCurrentAttempt();
  if (!attempt) return null;

  const questions = getExamQuestions();
  const answers = getAnswers();
  const correctCount = questions.reduce((total, question) => {
    const selected = answers[question.id]?.selectedAlternative;
    return total + (selected === question.correctAlternative ? 1 : 0);
  }, 0);

  const result = {
    attemptId: attempt.id,
    reason,
    totalQuestions: questions.length,
    answeredCount: Object.keys(answers).length,
    correctCount,
    blankCount: questions.length - Object.keys(answers).length,
    scorePercent: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    essaySaved: Boolean(getEssay().trim()),
    finalizedAt: new Date().toISOString()
  };

  save('attempt', {
    ...attempt,
    submittedAt: result.finalizedAt,
    status: reason === 'expired' ? 'expirada' : 'finalizada'
  });
  save('result', result);

  return result;
}

export function getResult() {
  return load('result', null);
}
