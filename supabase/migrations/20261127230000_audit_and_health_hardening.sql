create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_class_id uuid;
  v_row_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  v_row := coalesce(v_new, v_old);
  v_class_id := nullif(v_row ->> 'class_id', '')::uuid;
  v_row_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'submission_id', '')::uuid
  );

  if tg_op = 'DELETE' and not exists (
    select 1 from public.classes where id = v_class_id
  ) then
    return old;
  end if;

  insert into public.audit_log (
    class_id, table_name, row_id, action, old, new, actor
  )
  values (
    v_class_id, tg_table_name, v_row_id, tg_op, v_old, v_new, auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_row_change()
  from public, anon, authenticated, service_role;

create trigger attendance_audit_change
after insert or update or delete on public.attendance
for each row execute function public.audit_row_change();

create trigger ledger_entries_audit_change
after insert or update or delete on public.ledger_entries
for each row execute function public.audit_row_change();

create trigger grades_audit_change
after insert or update or delete on public.grades
for each row execute function public.audit_row_change();

drop trigger class_sessions_audit_end_change on public.class_sessions;
create trigger class_sessions_audit_change
after insert or update or delete on public.class_sessions
for each row execute function public.audit_row_change();
