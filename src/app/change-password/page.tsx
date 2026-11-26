import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";
import { createClient } from "../../utils/supabase/server";
import { getTurnstileSiteKey } from "../../lib/supabase-env";

export default async function ChangePasswordPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }
  if (user.app_metadata.must_change_password !== true) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error("Could not load the account profile.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ChangePasswordForm username={profile.username} siteKey={getTurnstileSiteKey()} />
    </main>
  );
}
