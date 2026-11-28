import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ResetPasswordForm />
    </main>
  );
}
