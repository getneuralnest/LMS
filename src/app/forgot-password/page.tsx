import { getTurnstileSiteKey } from "../../lib/supabase-env";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ForgotPasswordForm siteKey={getTurnstileSiteKey()} />
    </main>
  );
}
