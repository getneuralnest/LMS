import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createStudentAccounts,
  parseStudentCsv,
  studentImportRequestSchema,
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

  let students: ReturnType<typeof parseStudentCsv>;
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
  const result = await createStudentAccounts(
    adminClient,
    parsedInput.data.class_id,
    students,
    user.id,
  );
  return jsonResponse(result, 200);
});
