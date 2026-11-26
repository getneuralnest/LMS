# Class Portal

## Local development

1. Install Node.js 22+, Docker, and the project dependencies:

   ```sh
   npm ci
   ```

2. Copy `.env.example` to `.env.local`. Start Supabase and use the local API URL,
   publishable key, and service-role key printed by `npx supabase status -o env`.
   Keep the service-role key server-side.

3. Start Supabase, reset the local database, and run the tests:

   ```sh
   npx supabase start
   npx supabase db reset
   npx supabase test db
   npm run test:unit
   npm run test:e2e
   ```

The local seed creates a teacher account with username `teacher` and password
`Local-Teacher-Password-8`. This account and password are for local development
only. The CSV test fixture is at `tests/fixtures/students-fixture.csv`; do not
commit real student CSV files.

## Production teacher account

Keep Auth self-signup disabled. In the production Supabase dashboard, create a
confirmed email/password user with an internal email such as
`teacher@class.local`. In the SQL editor, create the corresponding profile and
class; the class insert trigger assigns its creator the teacher role:

```sql
insert into public.profiles (id, full_name, username)
values ('<auth-user-uuid>', '<teacher-name>', '<teacher-username>');

insert into public.classes (name, created_by)
values ('<class-name>', '<auth-user-uuid>');
```

Configure Supabase Auth with your Turnstile secret and the production password
and rate-limit settings. Set the Supabase URL and publishable key as
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and set
`SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel environment variable.
Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the matching Turnstile site key. Replace
the local testing keys in production; never use the seeded local account there.
# LMS
