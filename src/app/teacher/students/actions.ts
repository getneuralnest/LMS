"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { classRoleChangeSchema } from "../../../lib/auth-schemas";
import { studentImportRequestSchema } from "../../../lib/students";
import { getSupabasePublicEnvironment } from "../../../lib/supabase-env";
import { createClient } from "../../../utils/supabase/server";

const rowResultSchema = z.object({
  name: z.string(),
  roll_no: z.string(),
  username: z.string().optional(),
  reason: z.string().optional(),
});

const credentialsSchema = z.object({
  name: z.string(),
  roll_no: z.string(),
  username: z.string(),
  temp_password: z.string(),
});

const importResultSchema = z.object({
  created: z.array(rowResultSchema),
  skipped: z.array(rowResultSchema),
  failed: z.array(rowResultSchema),
  credentials: z.array(credentialsSchema),
});

export type StudentImportResult = z.infer<typeof importResultSchema>;
export type StudentImportState = {
  error: string | null;
  result: StudentImportResult | null;
};
export type StudentRoleState = { message: string | null; error: string | null };

const initialImportFailure = (error: string): StudentImportState => ({
  error,
  result: null,
});

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function uploadStudents(
  _previousState: StudentImportState,
  formData: FormData,
): Promise<StudentImportState> {
  const file = formData.get("csv");
  if (!(file instanceof File)) {
    return initialImportFailure("Choose a CSV file.");
  }

  const parsed = studentImportRequestSchema.safeParse({
    class_id: formString(formData, "class_id"),
    csv: await file.text(),
  });
  if (!parsed.success) {
    return initialImportFailure("Select a class and provide a valid CSV file.");
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return initialImportFailure("Sign in again before importing students.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return initialImportFailure("Could not establish an authenticated session.");
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnvironment();
  const response = await fetch(
    `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-students`,
    {
      method: "POST",
      headers: {
        apikey: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    },
  );
  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    return initialImportFailure("Student import returned an invalid response.");
  }

  if (!response.ok) {
    const errorResponse = z.object({ error: z.string() }).safeParse(responseBody);
    return initialImportFailure(
      errorResponse.success ? errorResponse.data.error : "Student import failed.",
    );
  }

  const result = importResultSchema.safeParse(responseBody);
  if (!result.success) {
    return initialImportFailure("Student import returned an invalid response.");
  }

  revalidatePath("/teacher/students");
  return { error: null, result: result.data };
}

export async function setStudentRoleToCr(
  _previousState: StudentRoleState,
  formData: FormData,
): Promise<StudentRoleState> {
  const parsed = classRoleChangeSchema.safeParse({
    classId: formString(formData, "classId"),
    studentId: formString(formData, "studentId"),
  });
  if (!parsed.success) {
    return { message: null, error: "Invalid class or student." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { message: null, error: "Sign in again before changing a class role." };
  }

  const { data: teacherMembership, error: teacherError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (teacherError) {
    return { message: null, error: "Could not verify teacher access." };
  }
  if (teacherMembership?.role !== "teacher") {
    return { message: null, error: "Teacher access required." };
  }

  const { data: studentMembership, error: studentError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", parsed.data.studentId)
    .maybeSingle();
  if (studentError) {
    return { message: null, error: "Could not verify the student record." };
  }
  if (studentMembership?.role !== "student") {
    return { message: null, error: "Only a student can be assigned the CR role." };
  }

  const { error: updateError } = await supabase
    .from("class_members")
    .update({ role: "cr" })
    .eq("class_id", parsed.data.classId)
    .eq("user_id", parsed.data.studentId);
  if (updateError) {
    return { message: null, error: "Could not update the student role." };
  }

  revalidatePath("/teacher/students");
  return { message: "Student role changed to CR.", error: null };
}
