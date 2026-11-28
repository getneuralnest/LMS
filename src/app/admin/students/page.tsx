import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import { ImportStudentsForm } from "../../teacher/students/import-form";

type AdminStudentsPageProps = {
  searchParams: Promise<{ class_id?: string | string[] }>;
};

export default async function AdminStudentsPage({ searchParams }: AdminStudentsPageProps) {
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

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id,name")
    .order("name");
  if (classesError) throw new Error("Could not load classes.");

  const params = await searchParams;
  const requestedClassId = typeof params.class_id === "string" ? params.class_id : "";
  const classId = classes.find((item) => item.id === requestedClassId)?.id ?? classes[0]?.id;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Import students</h1>
        <p className="text-sm text-muted-foreground">Add students to a selected class.</p>
      </header>
      {classes.length > 1 && (
        <form method="get" className="flex items-center gap-3">
          <label htmlFor="class_id" className="text-sm font-medium">Class</label>
          <select
            id="class_id"
            name="class_id"
            defaultValue={classId}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button type="submit" className="text-sm underline underline-offset-4">Open</button>
        </form>
      )}
      {classId ? (
        <ImportStudentsForm classId={classId} />
      ) : (
        <p className="text-sm text-muted-foreground">Create a class before importing students.</p>
      )}
    </main>
  );
}
