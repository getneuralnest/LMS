alter table public.assignments
  add column submission_type text not null default 'either'
    check (submission_type in ('file', 'link', 'either'));

alter table public.submissions
  add column submitted_late boolean not null default false,
  add constraint submissions_links_use_http
    check (link is null or (length(link) <= 2048 and link ~* '^https?://'));

drop policy "Students can submit their own work before the deadline"
  on public.submissions;
drop policy "Students can update their own work before the deadline"
  on public.submissions;

create policy "Students can submit allowed work"
on public.submissions for insert to authenticated
with check (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student', 'cr'])
);

create policy "Students can replace allowed work"
on public.submissions for update to authenticated
using (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student', 'cr'])
)
with check (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student', 'cr'])
);

create or replace function public.guard_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_due_at timestamptz;
  v_submission_mode text;
  v_submission_type text;
begin
  if tg_op = 'UPDATE' and (
    new.class_id is distinct from old.class_id
    or new.assignment_id is distinct from old.assignment_id
    or new.student_id is distinct from old.student_id
  ) then
    raise exception using errcode = '55000', message = 'Submission ownership cannot change';
  end if;

  select a.due_at, a.submission_mode, a.submission_type
  into v_due_at, v_submission_mode, v_submission_type
  from public.assignments a
  where a.id = new.assignment_id
    and a.class_id = new.class_id;

  if v_due_at is null then
    raise exception using errcode = '23503', message = 'Assignment does not exist';
  end if;
  if v_submission_mode = 'hard' and now() > v_due_at then
    raise exception using errcode = '55000', message = 'The submission deadline has passed';
  end if;
  if new.file_path is not null and v_submission_type not in ('file', 'either') then
    raise exception using errcode = '23514', message = 'This assignment does not accept files';
  end if;
  if new.link is not null and v_submission_type not in ('link', 'either') then
    raise exception using errcode = '23514', message = 'This assignment does not accept links';
  end if;
  if new.file_path is not null and new.link is not null then
    raise exception using errcode = '23514', message = 'Submit either a file or a link';
  end if;
  if new.file_path is not null and new.file_path not like
    new.class_id::text || '/' || new.assignment_id::text || '/' || new.student_id::text || '/%'
  then
    raise exception using errcode = '23514', message = 'Invalid submission file path';
  end if;

  new.submitted_late := now() > v_due_at;
  return new;
end;
$$;

revoke all on function public.guard_submission()
  from public, anon, authenticated;

create trigger submissions_guard_before_write
before insert or update on public.submissions
for each row execute function public.guard_submission();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'submissions',
  'submissions',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Class teachers and submission owners can read files"
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1
    from public.assignments a
    where a.class_id::text = split_part(name, '/', 1)
      and a.id::text = split_part(name, '/', 2)
      and (
        public.has_role(a.class_id, array['teacher'])
        or (
          split_part(name, '/', 3) = (select auth.uid())::text
          and public.has_role(a.class_id, array['student', 'cr'])
        )
      )
  )
);

create policy "Students can upload allowed submission files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and exists (
    select 1
    from public.assignments a
    where a.class_id::text = split_part(name, '/', 1)
      and a.id::text = split_part(name, '/', 2)
      and public.has_role(a.class_id, array['student', 'cr'])
      and a.submission_type in ('file', 'either')
      and (a.submission_mode = 'soft' or a.due_at >= now())
  )
);

create policy "Students can replace allowed submission files"
on storage.objects for update to authenticated
using (
  bucket_id = 'submissions'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and exists (
    select 1
    from public.assignments a
    where a.class_id::text = split_part(name, '/', 1)
      and a.id::text = split_part(name, '/', 2)
      and public.has_role(a.class_id, array['student', 'cr'])
      and a.submission_type in ('file', 'either')
      and (a.submission_mode = 'soft' or a.due_at >= now())
  )
)
with check (
  bucket_id = 'submissions'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and exists (
    select 1
    from public.assignments a
    where a.class_id::text = split_part(name, '/', 1)
      and a.id::text = split_part(name, '/', 2)
      and public.has_role(a.class_id, array['student', 'cr'])
      and a.submission_type in ('file', 'either')
      and (a.submission_mode = 'soft' or a.due_at >= now())
  )
);

create policy "Students can remove replaced submission files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submissions'
  and split_part(name, '/', 3) = (select auth.uid())::text
  and exists (
    select 1
    from public.assignments a
    where a.class_id::text = split_part(name, '/', 1)
      and a.id::text = split_part(name, '/', 2)
      and public.has_role(a.class_id, array['student', 'cr'])
      and (a.submission_mode = 'soft' or a.due_at >= now())
  )
);

create index assignments_due_at_by_class
  on public.assignments (class_id, due_at);
create index submissions_student_by_class
  on public.submissions (class_id, student_id);
