export const APP_CONFIG = {
  appName: 'Sementes Digitais',
  moduleName: 'Simulados',
  organization: 'ANIMUS',
  slogan: 'Clareza para decidir. Técnica para construir. Impacto para transformar.',
  questionBankLabel: 'Mais de 2700 questões do ENEM',
  sessionDurationHours: 10,
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  },
  admin: {
    emails: ['admin@sementesdigitais.com']
  },
  defaultExam: {
    title: 'Simulado Sementes Digitais 01',
    durationMinutes: 180,
    questionCount: 60,
    classCode: 'SEMENTES2026'
  },
  personalActivity: {
    title: 'Prática pessoal ENEM',
    durationMinutes: 60,
    questionCount: 20
  },
  activities: {
    emptyStudentMessage: 'Nenhuma atividade da turma foi publicada ainda. Você pode criar uma prática pessoal enquanto aguarda a equipe.'
  }
};
