"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordChangeFormSchema } from "../../lib/auth-schemas";
import { createAdminClient } from "../../utils/supabase/admin";
import { createClient } from "../../utils/supabase/server";

export type PasswordChangeActionState = { error: string | null };

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function changePassword(
  _previousState: PasswordChangeActionState,
  formData: FormData,
): Promise<PasswordChangeActionState> {
  const parsed = passwordChangeFormSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
    captchaToken: formString(formData, "captchaToken"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password change request." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email || user.app_metadata.must_change_password !== true) {
    return { error: "This account is not awaiting a password change." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Could not verify the account profile." };
  }

  if (parsed.data.password.toLowerCase() === profile.username.toLowerCase()) {
    return { error: "New password must differ from the username." };
  }

  const { data: verifiedSession, error: verifyError } =
    await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
      options: { captchaToken: parsed.data.captchaToken },
    });
  if (verifyError || !verifiedSession.user || verifiedSession.user.id !== user.id) {
    return { error: "The temporary password is incorrect." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError) {
    return { error: "Could not update the password. Please try again." };
  }

  const admin = createAdminClient();
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (metadataError) {
    return { error: "Password changed, but account activation could not be completed." };
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return { error: "Password changed. Refresh the page to finish signing in." };
  }

  redirect("/");
}
