import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { createClient } from "../../../utils/supabase/server";
import { CreateTeacherForm, TeacherAccountActions } from "./teacher-forms";

export default async function AdminTeachersPage() {
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

  const { data: memberships, error: membershipsError } = await supabase
    .from("class_members")
    .select("class_id,user_id")
    .eq("role", "teacher");
  if (membershipsError) throw new Error("Could not load teacher assignments.");

  const teacherIds = [...new Set(memberships.map((membership) => membership.user_id))];
  const { data: teachers, error: teachersError } = teacherIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,username,is_active,is_admin")
        .in("id", teacherIds)
    : { data: [], error: null };
  if (teachersError) throw new Error("Could not load teacher profiles.");

  const classesById = new Map(classes.map((classRecord) => [classRecord.id, classRecord]));
  const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Teacher accounts</h1>
        <p className="text-sm text-muted-foreground">Manage teacher access by class.</p>
      </header>
      <CreateTeacherForm classes={classes} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assigned teachers</h2>
        {memberships.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">No teachers assigned.</CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => {
                const teacher = teachersById.get(membership.user_id);
                if (!teacher || teacher.is_admin) return null;
                return (
                  <TableRow key={`${membership.class_id}-${membership.user_id}`}>
                    <TableCell>{teacher.full_name}</TableCell>
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>{classesById.get(membership.class_id)?.name ?? "Unknown"}</TableCell>
                    <TableCell>{teacher.is_active ? "Active" : "Inactive"}</TableCell>
                    <TableCell>
                      <TeacherAccountActions
                        classId={membership.class_id}
                        teacherId={teacher.id}
                        active={teacher.is_active}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
