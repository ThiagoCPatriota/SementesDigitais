const PREFIX = 'sementes-digitais:';

export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function load(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Não foi possível ler ${key} do localStorage`, error);
    return fallback;
  }
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

export function clearAttemptData() {
  remove('attempt');
  remove('answers');
  remove('essay');
  remove('result');
  remove('attemptQuestions');
}
