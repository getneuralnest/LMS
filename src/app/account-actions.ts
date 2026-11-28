"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  accountClaimSchema,
  accountEmailSchema,
  forgotPasswordSchema,
} from "../lib/auth-schemas";
import { getSiteUrl } from "../lib/supabase-env";
import { createAdminClient } from "../utils/supabase/admin";
import { createClient } from "../utils/supabase/server";

export type AccountActionState = { error: string | null; message?: string | null };

const genericRecoveryMessage =
  "If the account is eligible, password-reset instructions will be sent to its confirmed email.";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function confirmationUrl(): string {
  return new URL("/auth/confirm", getSiteUrl()).toString();
}

export async function claimAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = accountClaimSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email and password." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata.must_change_password !== true) {
    return { error: "This account is not awaiting setup." };
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
    return { error: "Choose a password that differs from your username." };
  }

  const { error: updateError } = await supabase.auth.updateUser(
    { email: parsed.data.email, password: parsed.data.password },
    { emailRedirectTo: confirmationUrl() },
  );
  if (updateError) {
    return { error: "Account setup could not be completed. Check the email and try again." };
  }

  const admin = createAdminClient();
  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({
      contact_email: parsed.data.email,
      claimed_at: new Date().toISOString(),
      email_confirmed_at: null,
    })
    .eq("id", user.id);
  if (profileUpdateError) {
    return { error: "Password changed, but account setup could not be completed. Try again." };
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (metadataError) {
    return { error: "Password changed, but account activation could not be completed." };
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return { error: "Account setup completed. Refresh the page to continue." };
  }

  redirect("/student?emailReminder=1");
}

export async function updateContactEmail(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = accountEmailSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata.must_change_password === true) {
    return { error: "Sign in again before changing your email." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("contact_email,email_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return { error: "Could not verify the account profile." };

  const { error: updateError } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: confirmationUrl() },
  );
  if (updateError) return { error: "Could not update the email address. Try again later." };

  const admin = createAdminClient();
  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ contact_email: parsed.data.email, email_confirmed_at: null })
    .eq("id", user.id);
  if (profileUpdateError) return { error: "Email updated, but its status could not be saved." };

  return { error: null, message: "Confirmation instructions were sent to the new email." };
}

export async function resendConfirmation(
  previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  void previousState;
  void formData;
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata.must_change_password === true) {
    return { error: "Sign in again before requesting confirmation." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("contact_email,email_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return { error: "Could not verify the account profile." };
  if (profile.email_confirmed_at) {
    return { error: null, message: "This email address is already confirmed." };
  }
  if (!profile.contact_email) {
    return { error: "Add an email address before requesting confirmation." };
  }

  const { error } = await supabase.auth.resend({
    type: "email_change",
    email: profile.contact_email,
    options: { emailRedirectTo: confirmationUrl() },
  });
  return error
    ? { error: "Could not resend confirmation. Wait before trying again." }
    : { error: null, message: "A confirmation email has been sent." };
}

export async function forgotPassword(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    username: formString(formData, "username"),
    captchaToken: formString(formData, "captchaToken"),
  });
  if (!parsed.success) {
    return { error: "If the account is eligible, password-reset instructions will be sent." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,contact_email,email_confirmed_at,is_active")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (profile?.is_active && profile.contact_email && profile.email_confirmed_at) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.resetPasswordForEmail(profile.contact_email, {
      redirectTo: confirmationUrl(),
      captchaToken: parsed.data.captchaToken,
    });
    if (error) {
      return { error: genericRecoveryMessage };
    }
  }

  return { error: null, message: genericRecoveryMessage };
}

const resetPasswordSchema = z
  .object({
    password: z.string().min(8).max(1024),
    confirmPassword: z.string().min(8).max(1024),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function finishForcedPasswordChange(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid new password." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata.must_change_password !== true) {
    return { error: "This account is not awaiting a password change." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username,claimed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.claimed_at) {
    return { error: "Complete account setup before changing the password." };
  }
  if (parsed.data.password.toLowerCase() === profile.username.toLowerCase()) {
    return { error: "Choose a password that differs from your username." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError) return { error: "Could not update the password. Please try again." };

  const admin = createAdminClient();
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (metadataError) return { error: "Password changed, but account activation failed." };
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return { error: "Password changed. Refresh the page to continue." };
  redirect("/student");
}

export async function resetPassword(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid new password." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.app_metadata.must_change_password === true) {
    return { error: "The password reset link is invalid or expired." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update the password. Try requesting a new link." };
  redirect("/student");
}

export async function signOut(): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Could not sign out.");
  redirect("/login");
}
