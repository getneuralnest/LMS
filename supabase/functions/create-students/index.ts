import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  generateTemporaryPassword,
  generateUsername,
  parseStudentCsv,
  studentImportRequestSchema,
  type StudentCsvRow,
} from "../../../src/lib/students.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const environmentSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const env = environmentSchema.parse({
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
});

type RowResult = { name: string; roll_no: string; username?: string; reason?: string };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsedInput = studentImportRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return jsonResponse({ error: "Invalid import request." }, 400);
  }

  let students: StudentCsvRow[];
  try {
    students = parseStudentCsv(parsedInput.data.csv);
  } catch (error) {
    if (error instanceof Error) {
      return jsonResponse({ error: error.message }, 400);
    }
    throw error;
  }

  const callerClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const { data: membership, error: membershipError } = await callerClient
    .from("class_members")
    .select("role")
    .eq("class_id", parsedInput.data.class_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return jsonResponse({ error: "Could not verify class membership." }, 403);
  }
  if (membership?.role !== "teacher") {
    return jsonResponse({ error: "Teacher access required." }, 403);
  }

  const adminClient = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: classRolls, error: classRollsError } = await adminClient
    .from("class_members")
    .select("roll_no")
    .eq("class_id", parsedInput.data.class_id)
    .not("roll_no", "is", null);

  if (classRollsError) {
    return jsonResponse({ error: "Could not read class student records." }, 500);
  }

  const existingRollNumbers = new Set(
    classRolls.map((member) => member.roll_no).filter((rollNo): rollNo is string => !!rollNo),
  );
  const created: RowResult[] = [];
  const skipped: RowResult[] = [];
  const failed: RowResult[] = [];
  const credentials: { name: string; roll_no: string; username: string; temp_password: string }[] =
    [];

  for (const student of students) {
    if (existingRollNumbers.has(student.roll_no)) {
      skipped.push({
        name: student.name,
        roll_no: student.roll_no,
        reason: "Roll number already exists in this class.",
      });
      continue;
    }

    let createdUserId: string | null = null;
    try {
      const { data: usernameMatches, error: usernameError } = await adminClient
        .from("profiles")
        .select("username")
        .in("username", [
          generateUsername(student.name, student.roll_no),
          generateUsername(student.name, student.roll_no, new Set([
            generateUsername(student.name, student.roll_no),
          ])),
        ]);

      if (usernameError) {
        failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Could not check username availability.",
        });
        continue;
      }

      const existingUsernames = new Set(usernameMatches.map((profile) => profile.username));
      const username = generateUsername(student.name, student.roll_no, existingUsernames);
      const tempPassword = generateTemporaryPassword();
      const email = `${username}@class.local`;
      const { data: createdUser, error: createUserError } =
        await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          app_metadata: { must_change_password: true },
          user_metadata: { full_name: student.name },
        });

      if (createUserError || !createdUser.user) {
        failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Could not create the student account.",
        });
        continue;
      }

      const userId = createdUser.user.id;
      createdUserId = userId;
      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        full_name: student.name,
        username,
        roll_no: student.roll_no,
        uni_roll_no: student.uni_roll_no,
      });
      const { error: membershipInsertError } = profileError
        ? { error: profileError }
        : await adminClient.from("class_members").insert({
            class_id: parsedInput.data.class_id,
            user_id: userId,
            role: "student",
            roll_no: student.roll_no,
            uni_roll_no: student.uni_roll_no,
          });

      if (membershipInsertError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
        if (!cleanupError) {
          createdUserId = null;
        }
        failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: cleanupError
            ? "Student insert failed and account cleanup could not be completed."
            : "Could not save student records; the temporary account was removed.",
        });
        continue;
      }

      existingRollNumbers.add(student.roll_no);
      existingUsernames.add(username);
      createdUserId = null;
      created.push({ name: student.name, roll_no: student.roll_no, username });
      credentials.push({
        name: student.name,
        roll_no: student.roll_no,
        username,
        temp_password: tempPassword,
      });
    } catch {
      if (createdUserId) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUserId);
        failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: cleanupError
            ? "Student creation failed and account cleanup could not be completed."
            : "Could not create the student account; the temporary account was removed.",
        });
        continue;
      }
      failed.push({
        name: student.name,
        roll_no: student.roll_no,
        reason: "Could not create the student account.",
      });
    }
  }

  return jsonResponse({ created, skipped, failed, credentials }, 200);
});
