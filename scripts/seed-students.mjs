import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createStudentAccounts, parseStudentCsv } from "../src/lib/students.ts";

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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

const host = new URL(supabaseUrl).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
if (!isLocal && !process.argv.includes("--confirm-production")) {
  throw new Error("Production seeding requires --confirm-production.");
}

const classIdArgument = process.argv.find((argument) => argument.startsWith("--class-id="));
let classId = classIdArgument?.slice("--class-id=".length);
const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (!classId) {
  const { data: classes, error } = await client.from("classes").select("id").limit(2);
  if (error) throw new Error("Could not read classes for student seeding.");
  if (classes.length !== 1) {
    throw new Error("Pass --class-id=<uuid> unless exactly one class exists.");
  }
  classId = classes[0].id;
}

const { data: adminProfiles, error: adminError } = await client
  .from("profiles")
  .select("id")
  .eq("is_admin", true)
  .eq("is_active", true)
  .limit(1);
if (adminError || !adminProfiles?.[0]) {
  throw new Error("Create an active administrator before seeding students.");
}

const csv = await readFile("data/students.csv", "utf8");
const students = parseStudentCsv(csv);
const result = await createStudentAccounts(client, classId, students, adminProfiles[0].id);
console.log(
  `Student seed complete: ${result.created.length} created, ${result.skipped.length} skipped, ${result.failed.length} failed.`,
);
if (result.failed.length > 0) process.exitCode = 1;
