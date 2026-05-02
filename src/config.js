const DEFAULT_ADMIN_EMAILS = ['admin@sementesdigitais.com', 'professor@sementesdigitais.com'];

const configuredAdminEmails = (import.meta.env.VITE_ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(','))
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const APP_CONFIG = {
  appName: 'Sementes Digitais',
  moduleName: 'Simulados',
  organization: 'ANIMUS',
  slogan: 'Clareza para decidir. Técnica para construir. Impacto para transformar.',
  questionBankLabel: 'Mais de 2700 questões do ENEM',
  sessionDurationHours: 10,
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  },
  admin: {
    emails: configuredAdminEmails
  },
  defaultExam: {
    title: 'Simulado Sementes Digitais 01',
    durationMinutes: 180,
    questionCount: 60,
    classCode: 'SEMENTES2026',
    sourceMode: 'enem-dev',
    examYear: 'mixed'
  },
  personalActivity: {
    title: 'Prática pessoal ENEM',
    durationMinutes: 60,
    questionCount: 30
  },
  activities: {
    emptyStudentMessage: 'Nenhuma atividade da turma foi publicada ainda. Você pode criar uma prática pessoal enquanto aguarda a equipe.'
  }
};
