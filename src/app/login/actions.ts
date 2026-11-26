"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginFormSchema } from "../../lib/auth-schemas";
import { createAdminClient } from "../../utils/supabase/admin";
import { createClient } from "../../utils/supabase/server";

export type LoginActionState = { error: string | null };

const genericLoginError = "Unable to sign in. Check your username and password and try again.";

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
    return { error: "Enter your username and password and complete CAPTCHA." };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username.toLowerCase())
    .maybeSingle();

  if (profileError) {
    return { error: "Sign-in is temporarily unavailable." };
  }
  if (!profile) {
    return { error: genericLoginError };
  }

  const { data: userResult, error: userError } = await admin.auth.admin.getUserById(
    profile.id,
  );
  if (userError || !userResult.user?.email) {
    return { error: "Sign-in is temporarily unavailable." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: userResult.user.email,
    password: parsed.data.password,
    options: { captchaToken: parsed.data.captchaToken },
  });
  if (signInError) {
    return { error: genericLoginError };
  }

  redirect("/");
}
