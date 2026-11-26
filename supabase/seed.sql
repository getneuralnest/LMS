-- Local-only teacher account: teacher / Local-Teacher-Password-8
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '90000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'teacher@class.local',
  extensions.crypt('Local-Teacher-Password-8', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Local Teacher"}',
  now(),
  now()
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  'teacher@class.local',
  '90000000-0000-0000-0000-000000000001',
  '{"sub":"90000000-0000-0000-0000-000000000001","email":"teacher@class.local","email_verified":true}',
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, full_name, username, roll_no, uni_roll_no)
values (
  '90000000-0000-0000-0000-000000000001',
  'Local Teacher',
  'teacher',
  null,
  null
)
on conflict (id) do nothing;

insert into public.classes (id, name, created_by)
values (
  '90000000-0000-0000-0000-000000000002',
  'Local Class',
  '90000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;
