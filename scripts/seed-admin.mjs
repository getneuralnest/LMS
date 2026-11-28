import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(source) {
  return Object.fromEntries(
    source.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) return [];
      return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
    }),
  );
}

// Accept --env-file=.env.production.local to target production. Never auto-load it.
const envFileArg = process.argv.find((a) => a.startsWith("--env-file="));
const envFilePath = envFileArg?.slice("--env-file=".length) ?? ".env.local";
const fileEnvironment = existsSync(envFilePath)
  ? parseEnvFile(await readFile(envFilePath, "utf8"))
  : {};
const env = { ...fileEnvironment, ...process.env };
const e2e = process.argv.includes("--e2e");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const host = url ? new URL(url).hostname : "";

const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}
// Protect against accidental production use: require explicit --env-file for non-local URLs.
// E2E always targets local only.
if (e2e && !isLocal) {
  throw new Error("seed:admin --e2e can only run against local Supabase.");
}
if (!isLocal && !envFileArg) {
  throw new Error(
    "Production seed:admin requires --env-file=.env.production.local. Never uses .env.local for production.",
  );
}
if (!isLocal && !process.argv.includes("--confirm-production")) {
  throw new Error("Production seed:admin requires --confirm-production.");
}

const adminPassword = e2e ? env.E2E_ADMIN_PASSWORD : env.SEED_ADMIN_PASSWORD;
const teacherPassword = e2e ? env.E2E_TEACHER_PASSWORD : null;
if (!adminPassword || adminPassword.length < 12 || (e2e && !teacherPassword)) {
  throw new Error(
    `Set ${e2e ? "E2E_ADMIN_PASSWORD and E2E_TEACHER_PASSWORD" : "SEED_ADMIN_PASSWORD"} in .env.local.`,
  );
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAccount({ username, fullName, password, isAdmin }) {
  const email = `${username}@students.example.com`;
  const { data: existingProfile, error: profileLookupError } = await client
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (profileLookupError) throw new Error("Could not check the local account profile.");

  let userId = existingProfile?.id;
  if (userId) {
    const { error } = await client.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true,
      app_metadata: { must_change_password: false },
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error("Could not update the local account.");
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { must_change_password: false },
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw new Error("Could not create the local account.");
    userId = data.user.id;
  }

  const { error: saveProfileError } = await client.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      username,
      roll_no: null,
      uni_roll_no: null,
      is_admin: isAdmin,
      is_active: true,
      sessions_revoked_at: null,
      claimed_at: null,
      contact_email: null,
      email_confirmed_at: null,
    },
    { onConflict: "id" },
  );
  if (saveProfileError) throw new Error("Could not save the local account profile.");
  return userId;
}

async function ensureClass(className, teacherId) {
  const { data: existingClass, error: classLookupError } = await client
    .from("classes")
    .select("id")
    .eq("name", className)
    .limit(1)
    .maybeSingle();
  if (classLookupError) throw new Error("Could not check the local class.");
  if (existingClass) return existingClass.id;

  const { data: createdClass, error: createClassError } = await client
    .from("classes")
    .insert({ name: className, created_by: teacherId })
    .select("id")
    .single();
  if (createClassError || !createdClass) throw new Error("Could not create the local class.");
  return createdClass.id;
}

async function addTeacher(classId, teacherId, actorId) {
  const { error: membershipError } = await client.from("class_members").upsert(
    { class_id: classId, user_id: teacherId, role: "teacher" },
    { onConflict: "class_id,user_id" },
  );
  if (membershipError) throw new Error("Could not assign the local teacher to the class.");

  const { error: auditError } = await client.from("account_audit_log").insert({
    class_id: classId,
    actor: actorId,
    target_user_id: teacherId,
    action: "teacher_created",
  });
  if (auditError) throw new Error("Could not audit the local teacher account.");
}

const adminUsername = e2e ? "e2eadmin" : "abdullah";
const adminName = e2e ? "E2E Admin" : "Abdullah";
const className = e2e ? "E2E Test Class" : "Local Class";
const adminId = await ensureAccount({
  username: adminUsername,
  fullName: adminName,
  password: adminPassword,
  isAdmin: true,
});

const { error: removeAdminMembershipsError } = await client
  .from("class_members")
  .delete()
  .eq("user_id", adminId);
if (removeAdminMembershipsError) {
  throw new Error("Could not remove class access from the global administrator.");
}

let classId;
if (e2e) {
  const teacherId = await ensureAccount({
    username: "e2eteacher",
    fullName: "E2E Teacher",
    password: teacherPassword,
    isAdmin: false,
  });
  const crId = await ensureAccount({
    username: "e2ecr",
    fullName: "E2E Class Representative",
    password: teacherPassword,
    isAdmin: false,
  });
  classId = await ensureClass(className, adminId);
  await addTeacher(classId, teacherId, adminId);
  const { error: crMembershipError } = await client.from("class_members").upsert(
    { class_id: classId, user_id: crId, role: "cr" },
    { onConflict: "class_id,user_id" },
  );
  if (crMembershipError) throw new Error("Could not assign the E2E CR to the class.");
} else {
  classId = await ensureClass(className, adminId);
}

console.log(`Seeded local ${e2e ? "E2E accounts and class" : "administrator and class"}.`);
