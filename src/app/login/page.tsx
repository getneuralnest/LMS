import { LoginForm } from "./login-form";
import { getTurnstileSiteKey } from "../../lib/supabase-env";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm siteKey={getTurnstileSiteKey()} />
    </main>
  );
}
