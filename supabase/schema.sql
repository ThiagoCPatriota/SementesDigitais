-- Sementes Digitais — correção de persistência no Supabase
-- Execute no SQL Editor do Supabase.
-- Depois, troque/adicione os e-mails reais dos professores em public.admin_users.

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email)
values ('professor@sementesdigitais.com')
on conflict (email) do nothing;

create or replace function public.is_sdu_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.get_current_sdu_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_sdu_admin() then 'admin' else 'student' end;
$$;

grant usage on schema public to authenticated;
grant execute on function public.is_sdu_admin() to authenticated;
grant execute on function public.get_current_sdu_role() to authenticated;

create table if not exists public.class_activities (
  id text primary key,
  title text not null,
  duration_minutes integer not null default 180,
  question_count integer not null default 60,
  source_mode text not null default 'enem-bank',
  exam_year text not null default 'mixed',
  requires_language_choice boolean not null default true,
  area_distribution jsonb not null default '{}'::jsonb,
  question_seed bigint not null default extract(epoch from now())::bigint,
  questions_snapshot jsonb not null default '[]'::jsonb,
  activity_type text not null default 'turma',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_activity_attempts (
  id text primary key,
  attempt_id text not null,
  activity_id text not null references public.class_activities(id) on delete cascade,
  activity_title text not null default '',
  activity_type text not null default 'turma',
  student jsonb not null default '{}'::jsonb,
  student_email text not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'em_andamento',
  total_questions integer not null default 0,
  language_choice text not null default '',
  answered_count integer not null default 0,
  correct_count integer,
  wrong_count integer,
  blank_count integer,
  score_percent numeric,
  result jsonb,
  attempt_snapshot jsonb,
  answers_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_activity_attempts_unique_student unique (activity_id, student_email)
);

create table if not exists public.personal_activities (
  id text primary key,
  owner_email text not null,
  title text not null,
  duration_minutes integer not null default 60,
  question_count integer not null default 20,
  source_mode text not null default 'enem-bank',
  exam_year text not null default 'mixed',
  requires_language_choice boolean not null default true,
  area_distribution jsonb not null default '{}'::jsonb,
  question_seed bigint not null default extract(epoch from now())::bigint,
  questions_snapshot jsonb not null default '[]'::jsonb,
  activity_type text not null default 'pessoal',
  status text not null default 'created',
  started_at timestamptz,
  deadline_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  attempt_snapshot jsonb,
  answers_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_activities
  add column if not exists area_distribution jsonb not null default '{}'::jsonb;

alter table public.personal_activities
  add column if not exists area_distribution jsonb not null default '{}'::jsonb;

create index if not exists class_activities_status_created_idx on public.class_activities(status, created_at desc);
create index if not exists class_activity_attempts_activity_idx on public.class_activity_attempts(activity_id, started_at desc);
create index if not exists class_activity_attempts_student_idx on public.class_activity_attempts(lower(student_email));
create index if not exists personal_activities_owner_idx on public.personal_activities(lower(owner_email), created_at desc);

alter table public.admin_users enable row level security;
alter table public.class_activities enable row level security;
alter table public.class_activity_attempts enable row level security;
alter table public.personal_activities enable row level security;

grant select, insert, update, delete on public.admin_users to authenticated;
grant select, insert, update, delete on public.class_activities to authenticated;
grant select, insert, update, delete on public.class_activity_attempts to authenticated;
grant select, insert, update, delete on public.personal_activities to authenticated;

drop policy if exists "Admins manage admin users" on public.admin_users;
drop policy if exists "Admins read admin users" on public.admin_users;
drop policy if exists "Admins manage class activities" on public.class_activities;
drop policy if exists "Students read published class activities" on public.class_activities;
drop policy if exists "Admins read all class attempts" on public.class_activity_attempts;
drop policy if exists "Admins manage all class attempts" on public.class_activity_attempts;
drop policy if exists "Students manage own class attempts" on public.class_activity_attempts;
drop policy if exists "Students manage own personal activities" on public.personal_activities;
drop policy if exists "Admins read personal activities" on public.personal_activities;

create policy "Admins manage admin users"
on public.admin_users
for all
to authenticated
using (public.is_sdu_admin())
with check (public.is_sdu_admin());

create policy "Admins manage class activities"
on public.class_activities
for all
to authenticated
using (public.is_sdu_admin())
with check (public.is_sdu_admin());

create policy "Students read published class activities"
on public.class_activities
for select
to authenticated
using (status = 'published' or public.is_sdu_admin());

create policy "Admins manage all class attempts"
on public.class_activity_attempts
for all
to authenticated
using (public.is_sdu_admin())
with check (public.is_sdu_admin());

create policy "Students manage own class attempts"
on public.class_activity_attempts
for all
to authenticated
using (lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_sdu_admin())
with check (lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_sdu_admin());

create policy "Students manage own personal activities"
on public.personal_activities
for all
to authenticated
using (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_sdu_admin())
with check (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.is_sdu_admin());

create policy "Admins read personal activities"
on public.personal_activities
for select
to authenticated
using (public.is_sdu_admin());

-- Para cadastrar outro professor, rode algo assim depois:
-- insert into public.admin_users (email) values ('email-do-professor@dominio.com') on conflict do nothing;


-- Banco de questões ENEM no Supabase/PostgreSQL
-- Também disponível de forma isolada em supabase/enem-question-bank.sql.
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
