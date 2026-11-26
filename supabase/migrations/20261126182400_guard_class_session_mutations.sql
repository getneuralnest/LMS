create or replace function public.class_session_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.ends_at <= now()
      and (
        new.starts_at is distinct from old.starts_at
        or new.ends_at is distinct from old.ends_at
        or new.late_fine is distinct from old.late_fine
        or new.class_id is distinct from old.class_id
      )
    then
      raise exception using errcode = '55000', message = 'The session has ended';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.ends_at <= now() then
      raise exception using errcode = '55000', message = 'The session has ended';
    end if;

    if exists (
      select 1
      from public.attendance a
      where a.session_id = old.id
    ) then
      raise exception using errcode = '55000', message = 'Class session has attendance';
    end if;

    return old;
  end if;

  return new;
end;
$$;

drop trigger class_sessions_closed_after_end on public.class_sessions;

create trigger class_sessions_guard_sensitive_update
before update of starts_at, ends_at, late_fine, class_id on public.class_sessions
for each row execute function public.class_session_guard();

create trigger class_sessions_guard_delete
before delete on public.class_sessions
for each row execute function public.class_session_guard();

create or replace function public.audit_class_session_end_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (
    class_id, table_name, row_id, action, old, new, actor
  )
  values (
    new.class_id,
    'class_sessions',
    new.id,
    'UPDATE',
    to_jsonb(old),
    to_jsonb(new),
    auth.uid()
  );
  return new;
end;
$$;

revoke all on function public.audit_class_session_end_change()
  from public, anon, authenticated;

create trigger class_sessions_audit_end_change
after update of ends_at on public.class_sessions
for each row
when (old.ends_at is distinct from new.ends_at)
execute function public.audit_class_session_end_change();
