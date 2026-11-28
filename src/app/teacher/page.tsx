import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

export default async function TeacherPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .limit(1)
    .maybeSingle();
  if (error || !membership) redirect("/");

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Teacher portal</h1>
      <nav className="flex gap-4 text-sm">
        <Link className="underline underline-offset-4" href="/teacher/students">Students</Link>
        <Link className="underline underline-offset-4" href="/teacher/attendance">Attendance</Link>
        <Link className="underline underline-offset-4" href="/teacher/ledger">CR ledger</Link>
        <Link className="underline underline-offset-4" href="/teacher/assignments">Assignments</Link>
      </nav>
    </main>
  );
}
