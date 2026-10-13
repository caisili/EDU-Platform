-- EDU V1.9.5 — Auth + Teaching Report RLS repair
-- Run once in the SAME Supabase project used by Teacher and School Admin.

create or replace function public.edu_current_school_id() returns uuid
language sql stable security definer set search_path=public as $$
  select school_id from public.profiles where id=auth.uid() limit 1
$$;
create or replace function public.edu_current_role() returns text
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() limit 1
$$;

grant execute on function public.edu_current_school_id() to authenticated;
grant execute on function public.edu_current_role() to authenticated;
grant select on public.schools, public.profiles to authenticated;
grant select,insert on public.teaching_reports, public.student_attendance, public.staff_attendance, public.time_off_requests to authenticated;
grant update on public.time_off_requests to authenticated;

alter table public.teaching_reports enable row level security;

drop policy if exists "edu ops read" on public.teaching_reports;
drop policy if exists "edu ops insert" on public.teaching_reports;
drop policy if exists "edu teaching reports read" on public.teaching_reports;
drop policy if exists "edu teaching reports insert" on public.teaching_reports;

create policy "edu teaching reports read" on public.teaching_reports
for select to authenticated
using (
  school_id = public.edu_current_school_id()
  and (user_id = auth.uid() or public.edu_current_role() in ('principal','admin'))
);

create policy "edu teaching reports insert" on public.teaching_reports
for insert to authenticated
with check (
  user_id = auth.uid()
  and school_id = public.edu_current_school_id()
  and public.edu_current_role() = 'teacher'
);
