"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  teacherAccountSchema,
  teacherResetSchema,
} from "../../../lib/auth-schemas";
import { generateTemporaryPassword, AUTH_EMAIL_DOMAIN } from "../../../lib/students";
import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

export type AdminTeacherActionState = {
  error: string | null;
  message: string | null;
  generatedPassword?: string;
};

const initialState: AdminTeacherActionState = { error: null, message: null };
const deactivateSchema = z.object({ teacherId: z.string().uuid(), classId: z.string().uuid() }).strict();

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function getActiveAdmin() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile?.is_admin || !profile.is_active) return null;
  return user;
}

export async function createTeacher(
  _previousState: AdminTeacherActionState,
  formData: FormData,
): Promise<AdminTeacherActionState> {
  const parsed = teacherAccountSchema.safeParse({
    fullName: formString(formData, "fullName"),
    username: formString(formData, "username"),
    password: formString(formData, "password") || undefined,
    classId: formString(formData, "classId"),
  });
  if (!parsed.success) {
    return {
      ...initialState,
      error: parsed.error.issues[0]?.message ?? "Invalid teacher details.",
    };
  }

  const actor = await getActiveAdmin();
  if (!actor) return { ...initialState, error: "Administrator access required." };

  const admin = createAdminClient();
  const { data: existingProfile, error: usernameError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();
  if (usernameError) return { ...initialState, error: "Could not check username availability." };
  if (existingProfile) return { ...initialState, error: "That username is already in use." };

  const { data: targetClass, error: classError } = await admin
    .from("classes")
    .select("id")
    .eq("id", parsed.data.classId)
    .maybeSingle();
  if (classError || !targetClass) return { ...initialState, error: "Select a valid class." };

  const isGenerated = !parsed.data.password;
  const password = parsed.data.password ?? generateTemporaryPassword();
  const generatedPassword = isGenerated ? password : undefined;
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: `${parsed.data.username}@${AUTH_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    app_metadata: { must_change_password: false },
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (createError || !createdUser.user) {
    return { ...initialState, error: "Could not create the teacher account." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: createdUser.user.id,
    full_name: parsed.data.fullName,
    username: parsed.data.username,
    is_admin: false,
    is_active: true,
  });
  const { error: membershipError } = profileError
    ? { error: profileError }
    : await admin.from("class_members").insert({
        class_id: parsed.data.classId,
        user_id: createdUser.user.id,
        role: "teacher",
      });
  const { error: auditError } = membershipError
    ? { error: membershipError }
    : await admin.from("account_audit_log").insert({
        class_id: parsed.data.classId,
        actor: actor.id,
        target_user_id: createdUser.user.id,
        action: "teacher_created",
      });

  if (auditError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(createdUser.user.id);
    return {
      ...initialState,
      error: cleanupError
        ? "Teacher setup failed and account cleanup could not be completed."
        : "Teacher setup failed; the account was removed.",
    };
  }

  revalidatePath("/admin/teachers");
  return {
    error: null,
    message: "Teacher account created.",
    generatedPassword,
  };
}

export async function resetTeacherPassword(
  _previousState: AdminTeacherActionState,
  formData: FormData,
): Promise<AdminTeacherActionState> {
  const parsed = teacherResetSchema.safeParse({
    classId: formString(formData, "classId"),
    teacherId: formString(formData, "teacherId"),
  });
  if (!parsed.success) return { ...initialState, error: "Invalid class or teacher." };

  const actor = await getActiveAdmin();
  if (!actor) return { ...initialState, error: "Administrator access required." };
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", parsed.data.teacherId)
    .maybeSingle();
  if (membershipError || membership?.role !== "teacher") {
    return { ...initialState, error: "The selected account is not a teacher in this class." };
  }

  const password = generateTemporaryPassword();
  const { error: passwordError } = await admin.auth.admin.updateUserById(
    parsed.data.teacherId,
    { password, app_metadata: { must_change_password: false } },
  );
  if (passwordError) return { ...initialState, error: "Could not reset the teacher password." };

  const { error: revokeError } = await admin
    .from("profiles")
    .update({ sessions_revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.teacherId);
  if (revokeError) return { ...initialState, error: "Password reset, but active sessions remain." };

  const { error: auditError } = await admin.from("account_audit_log").insert({
    class_id: parsed.data.classId,
    actor: actor.id,
    target_user_id: parsed.data.teacherId,
    action: "teacher_password_reset",
  });
  if (auditError) return { ...initialState, error: "Password reset, but audit logging failed." };

  revalidatePath("/admin/teachers");
  return {
    error: null,
    message: "Password reset. Existing sessions have been signed out.",
    generatedPassword: password,
  };
}

export async function deactivateTeacher(
  _previousState: AdminTeacherActionState,
  formData: FormData,
): Promise<AdminTeacherActionState> {
  const parsed = deactivateSchema.safeParse({
    teacherId: formString(formData, "teacherId"),
    classId: formString(formData, "classId"),
  });
  if (!parsed.success) return { ...initialState, error: "Invalid class or teacher." };
  const actor = await getActiveAdmin();
  if (!actor) return { ...initialState, error: "Administrator access required." };

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", parsed.data.teacherId)
    .maybeSingle();
  if (membershipError || membership?.role !== "teacher") {
    return { ...initialState, error: "The selected account is not a teacher in this class." };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_active: false, sessions_revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.teacherId);
  if (updateError) return { ...initialState, error: "Could not deactivate the teacher." };

  const { error: auditError } = await admin.from("account_audit_log").insert({
    class_id: parsed.data.classId,
    actor: actor.id,
    target_user_id: parsed.data.teacherId,
    action: "teacher_deactivated",
  });
  if (auditError) return { ...initialState, error: "Teacher deactivated, but audit logging failed." };
  revalidatePath("/admin/teachers");
  return { error: null, message: "Teacher account deactivated.", generatedPassword: undefined };
}
