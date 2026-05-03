-- Sementes Digitais — Banco de questões ENEM no Supabase/PostgreSQL
-- Execute este arquivo no SQL Editor do Supabase antes de rodar o importador.
--
-- Depois rode no terminal:
--   npm install
--   npm run import:enem
--
-- Observação: a chave SERVICE_ROLE deve ficar somente no seu computador/servidor.
-- Nunca coloque SERVICE_ROLE no front-end.

create table if not exists public.enem_questions (
  id text primary key,
  enem_id text,
  exam_year integer not null,
  original_index integer not null,
  title text not null default '',
  discipline text not null default '',
  area_label text not null default 'ENEM',
  language text,
  context text not null default '',
  statement text not null default '',
  alternatives jsonb not null default '[]'::jsonb,
  correct_alternative text,
  files jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enem_questions_language_check check (
    language is null or language in ('ingles', 'espanhol')
  )
);

create index if not exists enem_questions_year_idx
  on public.enem_questions (exam_year);

create index if not exists enem_questions_year_discipline_idx
  on public.enem_questions (exam_year, discipline);

create index if not exists enem_questions_year_language_idx
  on public.enem_questions (exam_year, language);

create index if not exists enem_questions_original_index_idx
  on public.enem_questions (exam_year, original_index);

alter table public.enem_questions enable row level security;

drop policy if exists "Leitura publica das questoes ENEM" on public.enem_questions;
create policy "Leitura publica das questoes ENEM"
  on public.enem_questions
  for select
  to anon, authenticated
  using (true);

grant select on public.enem_questions to anon, authenticated;

-- Escrita deve ser feita pelo importador com SERVICE_ROLE ou pelo painel SQL.
-- Não há policy pública de insert/update/delete de propósito.
