-- Sementes Digitais — tabelas principais para persistir simulados e respostas no Supabase
-- Antes de rodar em produção: troque os e-mails abaixo pelos e-mails reais dos administradores.

create or replace function public.is_sdu_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'professor@sementesdigitais.com'
  );
$$;

create or replace function public.get_current_sdu_role()
returns text
language sql
stable
as $$
  select case when public.is_sdu_admin() then 'admin' else 'student' end;
$$;

grant execute on function public.get_current_sdu_role() to authenticated;

create table if not exists public.class_activities (
  id text primary key,
  title text not null,
  class_code text not null default '',
  duration_minutes integer not null default 180,
  question_count integer not null default 60,
  source_mode text not null default 'enem-dev',
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
  class_code text not null default '',
  duration_minutes integer not null default 60,
  question_count integer not null default 20,
  source_mode text not null default 'enem-dev',
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

create index if not exists class_activities_status_created_idx on public.class_activities(status, created_at desc);
create index if not exists class_activity_attempts_activity_idx on public.class_activity_attempts(activity_id, started_at desc);
create index if not exists class_activity_attempts_student_idx on public.class_activity_attempts(lower(student_email));
create index if not exists personal_activities_owner_idx on public.personal_activities(lower(owner_email), created_at desc);

alter table public.class_activities enable row level security;
alter table public.class_activity_attempts enable row level security;
alter table public.personal_activities enable row level security;

drop policy if exists "Admins manage class activities" on public.class_activities;
drop policy if exists "Students read published class activities" on public.class_activities;
drop policy if exists "Admins read all class attempts" on public.class_activity_attempts;
drop policy if exists "Students manage own class attempts" on public.class_activity_attempts;
drop policy if exists "Students manage own personal activities" on public.personal_activities;
drop policy if exists "Admins read personal activities" on public.personal_activities;

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

create policy "Admins read all class attempts"
on public.class_activity_attempts
for select
to authenticated
using (public.is_sdu_admin());

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
