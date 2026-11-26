alter table public.profiles
  add column uni_roll_no text;

alter table public.class_members
  add column roll_no text,
  add column uni_roll_no text;

create unique index class_members_class_roll_no_key
  on public.class_members (class_id, roll_no)
  where roll_no is not null;

create unique index class_members_class_uni_roll_no_key
  on public.class_members (class_id, uni_roll_no)
  where uni_roll_no is not null;

drop policy "Profiles are visible to their owner" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Teachers can read profiles of class members"
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.class_members cm
    where cm.user_id = profiles.id
      and public.has_role(cm.class_id, array['teacher'])
  )
);
