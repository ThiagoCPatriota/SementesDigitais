import { formatSeconds, secondsUntil } from '../utils/timer.js';

export function renderTimer(deadlineAt) {
  const remainingSeconds = secondsUntil(deadlineAt);
  const dangerClass = remainingSeconds <= 300 ? 'timer--danger' : '';

  return `
    <aside class="timer ${dangerClass}" aria-label="Cronômetro da prova">
      <span>Tempo restante</span>
      <strong data-timer>${formatSeconds(remainingSeconds)}</strong>
    </aside>
  `;
}
