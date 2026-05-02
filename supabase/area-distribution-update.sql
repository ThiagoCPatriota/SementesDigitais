-- Sprint: distribuição de questões por área do ENEM
-- Execute este arquivo uma vez no SQL Editor do Supabase se a tabela já existir.

alter table public.class_activities
  add column if not exists area_distribution jsonb not null default '{}'::jsonb;

alter table public.personal_activities
  add column if not exists area_distribution jsonb not null default '{}'::jsonb;
