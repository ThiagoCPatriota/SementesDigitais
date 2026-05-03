export const ENEM_AVAILABLE_YEARS = Array.from({ length: 11 }, (_, index) => 2023 - index);
export const ENEM_NO_LANGUAGE_CHOICE = 'sem-lingua';
export const ENEM_LANGUAGE_OPTIONS = [
  { value: 'ingles', label: 'Inglês' },
  { value: 'espanhol', label: 'Espanhol' }
];
export const ENEM_LANGUAGE_CHOICE_OPTIONS = [
  ...ENEM_LANGUAGE_OPTIONS,
  { value: ENEM_NO_LANGUAGE_CHOICE, label: 'Não quero fazer nessa prova', shortLabel: 'Sem língua' }
];

export const ENEM_AREA_OPTIONS = [
  { value: 'linguagens', label: 'Linguagens' },
  { value: 'ciencias-humanas', label: 'Ciências Humanas' },
  { value: 'ciencias-natureza', label: 'Ciências da Natureza' },
  { value: 'matematica', label: 'Matemática' }
];

export function normalizeLanguageChoice(value = 'ingles') {
  if (value === ENEM_NO_LANGUAGE_CHOICE) return ENEM_NO_LANGUAGE_CHOICE;
  return value === 'espanhol' ? 'espanhol' : 'ingles';
}

export function isNoLanguageChoice(value = '') {
  return value === ENEM_NO_LANGUAGE_CHOICE;
}

export function getLanguageLabel(value = 'ingles') {
  const normalized = normalizeLanguageChoice(value);
  if (isNoLanguageChoice(normalized)) return 'Sem língua estrangeira';
  return normalized === 'espanhol' ? 'Espanhol' : 'Inglês';
}
