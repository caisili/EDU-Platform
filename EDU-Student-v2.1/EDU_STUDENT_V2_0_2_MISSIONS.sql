-- Additive migration. Run after inspecting existing tables and applying v2.0.1 interests SQL.
create table if not exists public.student_mission_attempts (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 mission_id text not null check (mission_id in ('basketball','space','coding')),
 answer_text text not null check (length(answer_text)<=24),
 correct boolean not null,
 created_at timestamptz not null default now()
);
create index if not exists student_mission_attempts_student_idx on public.student_mission_attempts(student_id,created_at desc);
create index if not exists student_mission_attempts_school_idx on public.student_mission_attempts(school_id,created_at desc);
alter table public.student_mission_attempts enable row level security;
revoke all on public.student_mission_attempts from anon;
grant select on public.student_mission_attempts to authenticated;
revoke insert,update,delete on public.student_mission_attempts from authenticated;
drop policy if exists edu_mission_student_read on public.student_mission_attempts;
create policy edu_mission_student_read on public.student_mission_attempts for select to authenticated using (
 student_id=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='student' and p.school_id=student_mission_attempts.school_id)
);
-- Grade inside a database function. Client cannot forge correct=true via REST.
create or replace function public.edu_submit_mission_attempt(p_mission_id text,p_answer text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; expected numeric; answer_value numeric; is_correct boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select school_id into sid from public.profiles where id=auth.uid() and role='student';
 if sid is null then raise exception 'Student school membership required'; end if;
 expected:=case p_mission_id when 'basketball' then 80 when 'space' then 50 when 'coding' then 21 else null end;
 if expected is null or p_answer is null or length(p_answer)>24 or p_answer !~ '^[-+]?[0-9]+(\.[0-9]+)?$' then raise exception 'Invalid answer'; end if;
 answer_value:=p_answer::numeric;
 is_correct:=answer_value=expected;
 insert into public.student_mission_attempts(student_id,school_id,mission_id,answer_text,correct)
 values(auth.uid(),sid,p_mission_id,p_answer,is_correct);
 return jsonb_build_object('correct',is_correct);
end $$;
revoke all on function public.edu_submit_mission_attempt(text,text) from public,anon;
grant execute on function public.edu_submit_mission_attempt(text,text) to authenticated;
-- Teacher and principal aggregates are intentionally NOT exposed in this migration.
