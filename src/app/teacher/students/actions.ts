"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { classRoleChangeSchema } from "../../../lib/auth-schemas";
import {
  createStudentAccounts,
  generateTemporaryPassword,
  parseStudentCsv,
  studentImportRequestSchema,
  type StudentImportResult,
} from "../../../lib/students";
import { studentResetSchema } from "../../../lib/auth-schemas";
import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

export type StudentImportState = {
  error: string | null;
  result: StudentImportResult | null;
};
export type StudentRoleState = { message: string | null; error: string | null };
export type StudentResetState = {
  message: string | null;
  error: string | null;
  generatedPassword?: string;
};

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
  if (file.size > 1_000_000) {
    return initialImportFailure("CSV files must be 1 MB or smaller.");
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active) {
    return initialImportFailure("Could not verify account access.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) {
    return initialImportFailure("Could not verify class access.");
  }
  if (!profile.is_admin && membership?.role !== "teacher") {
    return initialImportFailure("Teacher access required.");
  }

  let students: ReturnType<typeof parseStudentCsv>;
  try {
    students = parseStudentCsv(parsed.data.csv);
  } catch (error) {
    return initialImportFailure(
      error instanceof Error ? error.message : "Could not parse the student CSV.",
    );
  }

  let result: StudentImportResult;
  try {
    result = await createStudentAccounts(
      createAdminClient(),
      parsed.data.class_id,
      students,
      user.id,
    );
  } catch (error) {
    return initialImportFailure(
      error instanceof Error ? error.message : "Student import failed.",
    );
  }

  revalidatePath("/teacher/students");
  revalidatePath("/admin/students");
  return { error: null, result };
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

export async function resetStudentPassword(
  _previousState: StudentResetState,
  formData: FormData,
): Promise<StudentResetState> {
  const parsed = studentResetSchema.safeParse({
    classId: formString(formData, "classId"),
    studentId: formString(formData, "studentId"),
  });
  if (!parsed.success) return { message: null, error: "Invalid class or student." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { message: null, error: "Sign in again before resetting a password." };

  const { data: teacherMembership, error: teacherError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (teacherError || teacherMembership?.role !== "teacher") {
    return { message: null, error: "Teacher access required." };
  }

  const { data: studentMembership, error: studentError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", parsed.data.studentId)
    .maybeSingle();
  if (studentError || !studentMembership || !["student", "cr"].includes(studentMembership.role)) {
    return { message: null, error: "The selected account is not a student in this class." };
  }

  const password = generateTemporaryPassword();
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.studentId, {
    password,
    app_metadata: { must_change_password: true },
  });
  if (authError) return { message: null, error: "Could not reset the student password." };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ sessions_revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.studentId);
  if (profileError) return { message: null, error: "Password reset, but active sessions remain." };

  const { error: auditError } = await admin.from("account_audit_log").insert({
    class_id: parsed.data.classId,
    actor: user.id,
    target_user_id: parsed.data.studentId,
    action: "student_password_reset",
  });
  if (auditError) return { message: null, error: "Password reset, but audit logging failed." };

  revalidatePath("/teacher/students");
  return {
    message: "Password reset. The student must set a new password at next sign-in.",
    error: null,
    generatedPassword: password,
  };
}
