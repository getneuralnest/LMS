import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export default async function AdminPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin,is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin || !profile.is_active) redirect("/");

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Administrator portal</h1>
      <nav className="flex gap-4 text-sm">
        <Link href="/admin/teachers" className="underline underline-offset-4">
          Manage teachers
        </Link>
        <Link href="/admin/students" className="underline underline-offset-4">
          Import students
        </Link>
      </nav>
    </main>
  );
}
