"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginFormSchema } from "../../lib/auth-schemas";
import { createAdminClient } from "../../utils/supabase/admin";
import { createClient } from "../../utils/supabase/server";

export type LoginActionState = { error: string | null };

const genericLoginError = "Unable to sign in. Check your username and password and try again.";
const loginDestinations = {
  admin: "/admin",
  teacher: "/teacher",
  cr: "/student",
  student: "/student",
} as const;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginFormSchema.safeParse({
    username: formString(formData, "username"),
    password: formString(formData, "password"),
    captchaToken: formString(formData, "captchaToken"),
  });
  if (!parsed.success) {
    return { error: genericLoginError };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,is_admin,is_active,email_confirmed_at,contact_email")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    return { error: genericLoginError };
  }

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(
    profile.id,
  );
  if (userError || !userResult.user?.email) {
    return { error: genericLoginError };
  }

  const { data: memberships, error: membershipsError } = await admin
    .from("class_members")
    .select("role")
    .eq("user_id", profile.id);
  if (membershipsError) {
    return { error: genericLoginError };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: userResult.user.email,
    password: parsed.data.password,
    options: { captchaToken: parsed.data.captchaToken },
  });

  if (signInError) {
    return { error: genericLoginError };
  }

  if (signInData.user?.app_metadata.must_change_password === true) redirect("/");

  if (!profile.is_admin && memberships.length === 0) {
    await supabase.auth.signOut();
    return { error: genericLoginError };
  }

  const role = profile.is_admin
    ? "admin"
    : memberships.some((membership) => membership.role === "teacher")
      ? "teacher"
      : memberships.some((membership) => membership.role === "cr")
        ? "cr"
        : "student";

  if (role === "student" && !profile.email_confirmed_at && profile.contact_email) {
    redirect("/student?emailReminder=1");
  }
  redirect(loginDestinations[role]);
}
