import { formatSeconds, secondsUntil } from '../utils/timer.js';

export function Timer({ deadlineAt, remainingSeconds }) {
  const remaining = typeof remainingSeconds === 'number' ? remainingSeconds : secondsUntil(deadlineAt);
  const dangerClass = remaining <= 300 ? 'timer--danger' : '';

  return (
    <aside className={`timer ${dangerClass}`} aria-label="Cronômetro da prova">
      <span>Tempo restante</span>
      <strong>{formatSeconds(remaining)}</strong>
    </aside>
  );
}
