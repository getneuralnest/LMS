drop policy "Teachers and CRs can read the class ledger" on public.ledger_entries;
create policy "Class members can read their permitted ledger entries"
on public.ledger_entries for select to authenticated
using (
  public.has_role(class_id, array['teacher', 'cr'])
  or (
    student_id = (select auth.uid())
    and type in ('fine', 'collection')
    and public.has_role(class_id, array['student', 'cr'])
  )
);

create or replace function public.ledger_entry_student_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.student_id is not null
    and not exists (
      select 1
      from public.class_members cm
      where cm.class_id = new.class_id
        and cm.user_id = new.student_id
        and cm.role in ('student', 'cr')
    )
  then
    raise exception using errcode = '23503', message = 'Ledger student must belong to the same class';
  end if;

  return new;
end;
$$;

create trigger ledger_entry_student_guard_before_insert
before insert on public.ledger_entries
for each row execute function public.ledger_entry_student_guard();

create or replace function public.ledger_fine_insert_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.type = 'fine' and current_user <> 'postgres' then
    raise exception using errcode = '55000', message = 'Fines can only be created by the attendance trigger';
  end if;

  return new;
end;
$$;

create trigger ledger_fine_insert_guard_before_insert
before insert on public.ledger_entries
for each row execute function public.ledger_fine_insert_guard();

create or replace function public.get_class_ledger_totals(p_class_id uuid)
returns table (
  collection_total numeric,
  expense_total numeric,
  fine_total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_class_id) then
    raise exception using errcode = '42501', message = 'Class membership required';
  end if;

  return query
  select
    coalesce(sum(le.amount) filter (where le.type = 'collection'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'expense'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'fine'), 0)
  from public.ledger_entries le
  where le.class_id = p_class_id;
end;
$$;

revoke all on function public.get_class_ledger_totals(uuid)
  from public, anon, service_role;
grant execute on function public.get_class_ledger_totals(uuid) to authenticated;
