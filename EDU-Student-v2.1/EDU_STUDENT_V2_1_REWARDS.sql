-- EDU Student v2.1 rewards. Apply AFTER v2.0.1 interests and v2.0.2 missions.
-- Run in Supabase SQL Editor. No existing rows are deleted.
create table if not exists public.student_reward_profiles (
 student_id uuid primary key references auth.users(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 balance integer not null default 0 check(balance>=0),
 lifetime_points integer not null default 0 check(lifetime_points>=0),
 active_pet text check(active_pet in ('bunny','fox','dragon')),
 active_theme text not null default 'classic' check(active_theme in ('classic','ocean','forest','sunset','lavender','candy')),
 updated_at timestamptz not null default now()
);
create table if not exists public.student_points_ledger (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references auth.users(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 event_key text not null,
 amount integer not null check(amount<>0),
 created_at timestamptz not null default now(),
 unique(student_id,event_key)
);
create table if not exists public.student_reward_unlocks (
 student_id uuid not null references auth.users(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 reward_type text not null check(reward_type in ('pet','theme')),
 reward_key text not null,
 unlocked_at timestamptz not null default now(),
 primary key(student_id,reward_type,reward_key)
);
create index if not exists student_points_ledger_recent on public.student_points_ledger(student_id,created_at desc);
-- Read-only for students; all mutations are server-validated RPCs.
do $$ declare t text; begin
 foreach t in array array['student_reward_profiles','student_points_ledger','student_reward_unlocks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('revoke insert,update,delete on public.%I from authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('drop policy if exists student_own_read on public.%I',t);
 execute format('create policy student_own_read on public.%I for select to authenticated using (student_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''student'' and p.school_id=%I.school_id))',t,t);
 end loop;
end $$;
-- Replaces the previous mission RPC, retaining its signature and answer validation.
-- A mission grants points only on the FIRST correct answer per student/mission.
create or replace function public.edu_submit_mission_attempt(p_mission_id text,p_answer text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; expected numeric; answer_value numeric; is_correct boolean; reward integer:=0; key text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select school_id into sid from public.profiles where id=auth.uid() and role='student';
 if sid is null then raise exception 'Student school membership required'; end if;
 expected:=case p_mission_id when 'basketball' then 80 when 'space' then 50 when 'coding' then 21 else null end;
 if expected is null or p_answer is null or length(p_answer)>24 or p_answer !~ '^[-+]?[0-9]+(\.[0-9]+)?$' then raise exception 'Invalid answer'; end if;
 answer_value:=p_answer::numeric; is_correct:=answer_value=expected;
 insert into public.student_mission_attempts(student_id,school_id,mission_id,answer_text,correct)
 values(auth.uid(),sid,p_mission_id,p_answer,is_correct);
 if is_correct then
  key:='mission:'||p_mission_id;
  reward:=case p_mission_id when 'basketball' then 20 when 'space' then 30 when 'coding' then 50 end;
  insert into public.student_reward_profiles(student_id,school_id) values(auth.uid(),sid) on conflict(student_id) do nothing;
  -- The unique ledger key ensures repeat attempts and concurrent requests cannot farm points.
  insert into public.student_points_ledger(student_id,school_id,event_key,amount)
  values(auth.uid(),sid,key,reward) on conflict(student_id,event_key) do nothing;
  if not found then reward:=0;
  else
   update public.student_reward_profiles set balance=balance+reward,lifetime_points=lifetime_points+reward,updated_at=now()
   where student_id=auth.uid() and school_id=sid;
  end if;
 end if;
 return jsonb_build_object('correct',is_correct,'points_awarded',reward);
end $$;
revoke all on function public.edu_submit_mission_attempt(text,text) from public,anon;
grant execute on function public.edu_submit_mission_attempt(text,text) to authenticated;
-- Spend balance on themes; pets unlock by lifetime points and never consume balance.
create or replace function public.edu_reward_action(p_action text,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; threshold integer; row_profile public.student_reward_profiles%rowtype;
begin
 select school_id into sid from public.profiles where id=auth.uid() and role='student';
 if sid is null then raise exception 'Student sign in required'; end if;
 insert into public.student_reward_profiles(student_id,school_id) values(auth.uid(),sid) on conflict(student_id) do nothing;
 select * into row_profile from public.student_reward_profiles where student_id=auth.uid() and school_id=sid for update;
 if p_action='pet' then
  threshold:=case p_key when 'bunny' then 1000 when 'fox' then 1500 when 'dragon' then 2500 end;
  if threshold is null then raise exception 'Unknown pet'; end if;
  if row_profile.lifetime_points<threshold then raise exception 'Not enough lifetime points'; end if;
  insert into public.student_reward_unlocks(student_id,school_id,reward_type,reward_key)
  values(auth.uid(),sid,'pet',p_key) on conflict do nothing;
  update public.student_reward_profiles set active_pet=p_key,updated_at=now() where student_id=auth.uid();
 elsif p_action='theme' then
  if p_key not in ('ocean','forest','sunset','lavender','candy') then raise exception 'Unknown theme'; end if;
  if not exists(select 1 from public.student_reward_unlocks where student_id=auth.uid() and reward_type='theme' and reward_key=p_key) then
   if row_profile.balance<800 then raise exception 'Not enough points'; end if;
   insert into public.student_reward_unlocks(student_id,school_id,reward_type,reward_key)
   values(auth.uid(),sid,'theme',p_key);
   update public.student_reward_profiles set balance=balance-800,updated_at=now() where student_id=auth.uid();
   insert into public.student_points_ledger(student_id,school_id,event_key,amount)
   values(auth.uid(),sid,'purchase:theme:'||p_key,-800);
  end if;
  update public.student_reward_profiles set active_theme=p_key,updated_at=now() where student_id=auth.uid();
 elsif p_action='classic' then
  update public.student_reward_profiles set active_theme='classic',updated_at=now() where student_id=auth.uid();
 else raise exception 'Unknown action'; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.edu_reward_action(text,text) from public,anon;
grant execute on function public.edu_reward_action(text,text) to authenticated;
