-- EDU School Admin Phase 1.4
-- Run once in Supabase SQL Editor.
-- Gives school admins a safe teacher directory using public profile names + Auth emails.

create or replace function public.edu_school_teacher_directory()
returns table(id uuid, username text, email text)
language sql
security definer
set search_path = public, auth
as $$
  select p.id,
         coalesce(nullif(p.full_name,''), split_part(u.email,'@',1), 'Teacher') as username,
         coalesce(nullif(p.email,''), u.email) as email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'teacher'
    and p.school_id = (
      select me.school_id from public.profiles me
      where me.id = auth.uid() and me.role in ('principal','admin')
      limit 1
    )
  order by coalesce(nullif(p.full_name,''), u.email);
$$;

revoke all on function public.edu_school_teacher_directory() from public;
grant execute on function public.edu_school_teacher_directory() to authenticated;

-- Backfill profile emails so the rest of EDU can also use them.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or btrim(p.email) = '')
  and u.email is not null;
