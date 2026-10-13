-- ADDITIVE. Review existing schema, privileges and school workflow before applying.
-- Parent invite codes are distinct from CLASS codes. Never use a class code as proof of guardianship.
create extension if not exists pgcrypto;
create table if not exists public.parent_student_links (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 school_id uuid not null references public.schools(id),
 status text not null default 'pending' check(status in ('pending','verified','revoked')),
 verified_at timestamptz, created_at timestamptz not null default now(),
 unique(parent_id,student_id,school_id)
);
alter table public.parent_student_links enable row level security;
revoke all on public.parent_student_links from anon;
grant select on public.parent_student_links to authenticated;
drop policy if exists parent_read_verified_links on public.parent_student_links;
create policy parent_read_verified_links on public.parent_student_links for select to authenticated
 using(parent_id=auth.uid() and status='verified');

create table if not exists public.parent_invites (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id),
 school_id uuid not null references public.schools(id),
 code_hash text not null unique,
 expires_at timestamptz not null default (now()+interval '7 days'),
 redeemed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.parent_invites enable row level security;
revoke all on public.parent_invites from anon,authenticated;
-- Student can generate a single-use, 7-day family invite. A parent must still be school-verified.
create or replace function public.edu_create_parent_invite()
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_school uuid; v_code text;
begin
 select school_id into v_school from public.profiles where id=auth.uid() and role='student';
 if v_school is null then raise exception 'Student login required'; end if;
 -- Limit active codes per student to reduce uncontrolled sharing.
 if (select count(*) from public.parent_invites where student_id=auth.uid() and redeemed_at is null and expires_at>now())>=3 then
   raise exception 'Too many active invites; ask school staff for help';
 end if;
 v_code:='PARENT-'||upper(encode(gen_random_bytes(12),'hex'));
 insert into public.parent_invites(student_id,school_id,code_hash) values(auth.uid(),v_school,encode(digest(v_code,'sha256'),'hex'));
 return v_code;
end $$;
revoke all on function public.edu_create_parent_invite() from public,anon;
grant execute on function public.edu_create_parent_invite() to authenticated;

create or replace function public.edu_redeem_parent_invite(p_code text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_inv public.parent_invites%rowtype; v_role text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if v_role is not null and v_role<>'parent' then raise exception 'Account already has another role'; end if;
 select * into v_inv from public.parent_invites
 where code_hash=encode(digest(upper(trim(p_code)),'sha256'),'hex') and redeemed_at is null and expires_at>now()
 for update;
 if v_inv.id is null then raise exception 'Invalid or expired invite'; end if;
 if v_inv.student_id=auth.uid() then raise exception 'Cannot link own account'; end if;
 insert into public.profiles(id,full_name,role,school_id)
 values(auth.uid(),'Parent','parent',v_inv.school_id)
 on conflict(id) do update set school_id=excluded.school_id where public.profiles.role='parent';
 if not found then raise exception 'Parent profile conflict'; end if;
 insert into public.parent_student_links(parent_id,student_id,school_id,status)
 values(auth.uid(),v_inv.student_id,v_inv.school_id,'pending')
 on conflict(parent_id,student_id,school_id) do update set status='pending',verified_at=null;
 update public.parent_invites set redeemed_at=now() where id=v_inv.id;
 return 'pending_school_verification';
end $$;
revoke all on function public.edu_redeem_parent_invite(text) from public,anon;
grant execute on function public.edu_redeem_parent_invite(text) to authenticated;
-- Verification is a separate school-admin workflow. Do not grant a public RPC that
-- marks pending links verified. Until verification, no child records are readable.
-- Review existing RLS on profiles, student_interests, growth_events before enabling
-- parent read access. Do not grant broad SELECT to the authenticated role.
