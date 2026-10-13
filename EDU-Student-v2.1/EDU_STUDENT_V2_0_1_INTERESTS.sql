-- EDU Student v2.0.1 — ADDITIVE migration. Review before running in Supabase SQL Editor.
-- Prerequisites: public.profiles(id,role,school_id), public.schools(id), auth.users.
create table if not exists public.student_interests (
  student_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  interest_key text not null check (interest_key in ('coding','puzzles','basketball','space','art','animals','music','gaming','science','sports')),
  created_at timestamptz not null default now(),
  primary key(student_id,interest_key)
);
create index if not exists student_interests_school_idx on public.student_interests(school_id,interest_key);
alter table public.student_interests enable row level security;
revoke all on public.student_interests from anon;
grant select on public.student_interests to authenticated;
-- Students read only their own school-scoped interests.
drop policy if exists edu_student_interests_self_read on public.student_interests;
create policy edu_student_interests_self_read on public.student_interests for select to authenticated
using (student_id=auth.uid() and exists (
 select 1 from public.profiles p where p.id=auth.uid() and p.role='student' and p.school_id=student_interests.school_id
));
-- Atomic replacement, validating identity and school from the database (not client inputs).
create or replace function public.edu_set_student_interests(p_interests text[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid; n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select p.school_id into sid from public.profiles p where p.id=auth.uid() and p.role='student';
 if sid is null then raise exception 'Student school membership required'; end if;
 n:=coalesce(array_length(p_interests,1),0);
 if n>10 or exists(select 1 from unnest(p_interests) as i where i is null or i not in ('coding','puzzles','basketball','space','art','animals','music','gaming','science','sports')) then
   raise exception 'Invalid interests';
 end if;
 delete from public.student_interests where student_id=auth.uid();
 insert into public.student_interests(student_id,school_id,interest_key)
 select auth.uid(),sid,x from (select distinct unnest(p_interests) as x) t;
end $$;
revoke all on function public.edu_set_student_interests(text[]) from public,anon;
grant execute on function public.edu_set_student_interests(text[]) to authenticated;
