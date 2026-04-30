const ICONS = {
  books: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4.75h8.25A2.75 2.75 0 0 1 16 7.5v11.75H7.75A2.75 2.75 0 0 0 5 22V4.75Z" />
      <path d="M16 7.5h3A2 2 0 0 1 21 9.5v10.25H16V7.5Z" />
      <path d="M5 4.75H3.75A1.75 1.75 0 0 0 2 6.5v12.75A2.75 2.75 0 0 0 4.75 22h3" />
      <path d="M8 8h4.5M8 11h4.5M8 14h3" />
    </svg>
  `,
  student: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 11v4.2c0 1.7 2.2 3.05 5 3.05s5-1.35 5-3.05V11" />
      <path d="M21 8.5v5" />
    </svg>
  `,
  timer: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 2.75h6" />
      <path d="M12 6.5a7.25 7.25 0 1 0 0 14.5 7.25 7.25 0 0 0 0-14.5Z" />
      <path d="m17.25 7.25 1.25-1.25" />
      <path d="M12 10.25v3.9l2.5 1.55" />
    </svg>
  `,
  essay: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5.5 3.5h8.75L19 8.25V20.5H5.5v-17Z" />
      <path d="M14 3.75v4.75h4.75" />
      <path d="M8.5 12h7M8.5 15h7M8.5 18h4.5" />
    </svg>
  `,
  seed: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20V9" />
      <path d="M12 13.25c-4.5-.2-7.25-2.5-8-7.25 4.75.25 7.25 2.75 8 7.25Z" />
      <path d="M12 15.25c4.5-.2 7.25-2.5 8-7.25-4.75.25-7.25 2.75-8 7.25Z" />
    </svg>
  `,
  target: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
      <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  `,
  chart: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 19.5h16" />
      <path d="M7 16v-4" />
      <path d="M12 16V7" />
      <path d="M17 16v-7" />
      <path d="M5.5 20.5V4.5" />
    </svg>
  `,
  classroom: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5h16v10H4V5Z" />
      <path d="M8 19h8" />
      <path d="M12 15v4" />
      <path d="M7 9h10M7 12h6" />
    </svg>
  `
};

export function icon(name, className = 'icon') {
  const svg = ICONS[name] ?? ICONS.seed;
  return `<span class="${className}" aria-hidden="true">${svg}</span>`;
}
