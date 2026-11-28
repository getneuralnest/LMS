alter table public.profiles
  add column is_admin boolean not null default false,
  add column is_active boolean not null default true,
  add column sessions_revoked_at timestamptz,
  add column claimed_at timestamptz,
  add column contact_email text,
  add column email_confirmed_at timestamptz;

alter table public.audit_log
  alter column class_id drop not null;

create table public.account_audit_log (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete set null,
  actor uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  at timestamptz not null default now()
);

alter table public.account_audit_log enable row level security;

create or replace function public.is_session_current()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and (
          p.sessions_revoked_at is null
          or to_timestamp(coalesce((auth.jwt() ->> 'iat')::bigint, 0))
            > p.sessions_revoked_at
        )
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and public.is_session_current()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin
        and p.is_active
    );
$$;

create policy "Admins can read account audit logs"
on public.account_audit_log for select to authenticated
using (public.is_admin());

create policy "Teachers can read account audit logs for their class"
on public.account_audit_log for select to authenticated
using (class_id is not null and public.has_role(class_id, array['teacher']));

create or replace function public.is_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and public.is_session_current()
    and exists (
      select 1
      from public.class_members cm
      join public.profiles p on p.id = cm.user_id
      where cm.class_id = p_class_id
        and cm.user_id = auth.uid()
        and p.is_active
    );
$$;

create or replace function public.has_role(p_class_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and public.is_session_current()
    and exists (
      select 1
      from public.class_members cm
      join public.profiles p on p.id = cm.user_id
      where cm.class_id = p_class_id
        and cm.user_id = auth.uid()
        and cm.role = any (p_roles)
        and p.is_active
    );
$$;

create or replace function public.add_class_creator_as_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.is_admin
  ) then
    insert into public.class_members (class_id, user_id, role)
    values (new.id, new.created_by, 'teacher');
  end if;
  return new;
end;
$$;

drop policy "Members can read their classes" on public.classes;
create policy "Members and admins can read classes"
on public.classes for select to authenticated
using (public.is_member(id) or public.is_admin());

drop policy "Authenticated users can create classes" on public.classes;
create policy "Teachers and admins can create classes"
on public.classes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_admin()
    or exists (
      select 1
      from public.class_members cm
      where cm.user_id = (select auth.uid())
        and cm.role = 'teacher'
    )
  )
);

drop policy "Teachers can update classes" on public.classes;
create policy "Teachers and admins can update classes"
on public.classes for update to authenticated
using (public.has_role(id, array['teacher']) or public.is_admin())
with check (public.has_role(id, array['teacher']) or public.is_admin());

create policy "Admins can manage class memberships"
on public.class_members for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can read profiles"
on public.profiles for select to authenticated
using (public.is_admin());

create policy "Admins can create account audit logs"
on public.account_audit_log for insert to authenticated
with check (public.is_admin() and actor = (select auth.uid()));

create policy "Teachers can create account audit logs"
on public.account_audit_log for insert to authenticated
with check (
  class_id is not null
  and public.has_role(class_id, array['teacher'])
  and actor = (select auth.uid())
);

create or replace function public.audit_class_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_user_id uuid;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  v_class_id := coalesce(new.class_id, old.class_id);
  v_user_id := coalesce(new.user_id, old.user_id);
  insert into public.account_audit_log (class_id, actor, target_user_id, action)
  values (
    v_class_id,
    auth.uid(),
    v_user_id,
    case tg_op
      when 'INSERT' then 'class_membership_added'
      when 'UPDATE' then 'class_membership_updated'
      else 'class_membership_removed'
    end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_class_membership_change()
  from public, anon, authenticated;

create trigger class_members_audit_change
after insert or update or delete on public.class_members
for each row execute function public.audit_class_membership_change();
