# Class Portal

## Local setup

Requirements: Node.js 22+, Docker, and the Supabase CLI available through `npx`.

1. Install dependencies and copy the environment template:

   ```sh
   npm ci
   cp .env.example .env.local
   ```

2. Start local Supabase and fill `.env.local` with the matching URL, publishable
   key, and service-role key from `npx supabase status -o env`. Set independent,
   strong values for `SEED_ADMIN_PASSWORD`, `E2E_ADMIN_PASSWORD`, and
   `E2E_TEACHER_PASSWORD`. Keep the service-role key server-side.

3. If `supabase/config.toml` changed, restart Supabase before resetting the DB.
   Then seed the local administrator:

   ```sh
   npx supabase stop
   npx supabase start
   npm run db:reset
   npm run seed:admin
   ```

   The local administrator is named Abdullah, username `abdullah`. Its password
   is read from the ignored `.env.local`; it is never stored in source control.
   The seed also creates the `Local Class`. The global administrator is not
   assigned a class role and therefore cannot read class attendance, grades, or
   fines.

4. To import the provided class roster locally, place the CSV at
   `data/students.csv` with the exact header `name,roll_no,uni_roll_no`, then run:

   ```sh
   npm run seed:students
   ```

   The file is git-ignored. Student usernames are the ASCII letters from the full
   name followed by the full roll number; their initial password equals that
   username. Students must claim the account and choose a new password at first
   sign-in. Credentials are not exported or stored.

## Attendance

Teachers use `/teacher/attendance` to view sessions and mark each student
present, absent, or late. Changes stay in the table until **Save attendance** is
clicked, then save together. Choose **Create session** to open the separate
session form; after creation, the portal returns to that session's attendance table.
Creating a session atomically creates unmarked attendance rows for every active
student and CR in that class. A late fine is added to the append-only ledger by
a database trigger when the session has a positive late-fine amount. After the
session ends, pg_cron marks unmarked rows absent and locks all attendance rows;
database triggers reject later changes.

## CR ledger

Teachers and class representatives can add collections and expenses at
`/teacher/ledger`. Ledger entries are append-only. Fine entries are generated
only by the attendance workflow. Students see their own fines and collections,
their dues (student-linked fines minus student-linked collections, floored at
zero), and class totals by entry type.

## Assignments and submissions

Teachers create and edit assignments or presentations at
`/teacher/assignments`, set a hard or soft deadline, and grade submissions with
marks and feedback. Students can submit allowed private files or HTTP/HTTPS
links. Hard deadlines are enforced by the database and Storage policies;
late soft submissions are accepted and flagged. Private file links are signed
and short-lived.

## Security and operations

The portal uses membership-based RLS, server-side role checks, a nonce-based
Content Security Policy, secure cookies in production, and a database-backed
health endpoint. See [deployment preparation](./docs/DEPLOY.md),
[backup recovery](./docs/RESTORE.md), and [operational limits](./docs/LIMITS.md).

Run the production-safe, read-only smoke check with:

```sh
npm run smoke:prod -- --url=https://<your-site>
```

## Tests and development

```sh
npm run db:reset
npx supabase test db
npm run test:unit
npx supabase functions serve --no-verify-jwt
```

In another terminal:

```sh
npm run dev
npm run test:e2e
```

Playwright uses dedicated local administrator and teacher accounts with the
E2E passwords from `.env.local`, and tests with fake students in
`tests/fixtures/students-fixture.csv`. Student names and roll numbers are
unique per run in the dedicated E2E class because attendance history is
immutable and is not deleted. Playwright also checks the account-claim and
email confirmation flows against local Mailpit at `http://localhost:54324`.
`npm run env:check` is run before app, test, and seed commands and rejects a
hosted Supabase URL combined with local Supabase keys.
When a local Next.js server is already running, set
`PLAYWRIGHT_BASE_URL=http://localhost:3000` to run Playwright against it instead
of starting another dev server.

## Production account bootstrap

Keep Supabase Auth self-signup disabled. Create the first administrator as a
confirmed user through the Supabase Dashboard. In the SQL editor, create the
profile using that Auth user ID, then create the class. Do not add a class
membership for the global administrator:

```sql
insert into public.profiles (id, full_name, username, is_admin, is_active)
values ('<auth-user-uuid>', '<admin-name>', '<admin-username>', true, true);

insert into public.classes (name, created_by)
values ('<class-name>', '<auth-user-uuid>');
```

The administrator can create teachers and assign them to a class at
`/admin/teachers`. Teacher passwords may be provided by the administrator or
generated and displayed once. Student accounts are imported through the teacher
roster UI or with `npm run seed:students -- --confirm-production
--class-id=<class-uuid>`; production seeding requires both the explicit flag and
the target class ID.

Configure Supabase Auth with the production Turnstile secret, email provider,
password policy, and rate limits. Configure `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel. Set `SUPABASE_SERVICE_ROLE_KEY` only
as a server-side Vercel environment variable. The internal Auth email domain
defaults to `students.example.com`; users only sign in with their usernames.
Never use local testing keys or seed passwords in production.
# LMS
