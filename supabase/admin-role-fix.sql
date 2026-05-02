-- Correção rápida para liberar a área administrativa pelo e-mail do professor.
-- Troque/adicione os e-mails abaixo. Use sempre minúsculo e sem espaços.

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
