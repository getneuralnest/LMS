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
import { ImportStudentsForm } from "./import-form";
import { SetCrRoleButton } from "./role-button";

type StudentsPageProps = {
  searchParams: Promise<{ class_id?: string | string[] }>;
};

export default async function TeacherStudentsPage({ searchParams }: StudentsPageProps) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/login");
  }

  const { data: teacherMemberships, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", user.id)
    .eq("role", "teacher");
  if (membershipError) {
    throw new Error("Could not load teacher class memberships.");
  }

  const classIds = [...new Set(teacherMemberships.map((membership) => membership.class_id))];
  if (classIds.length === 0) {
    redirect("/");
  }

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id,name")
    .in("id", classIds);
  if (classesError) {
    throw new Error("Could not load teacher classes.");
  }

  const params = await searchParams;
  const requestedClassId = typeof params.class_id === "string" ? params.class_id : "";
  const classId = classIds.includes(requestedClassId) ? requestedClassId : classIds[0];
  const { data: members, error: membersError } = await supabase
    .from("class_members")
    .select("user_id,roll_no,uni_roll_no,role")
    .eq("class_id", classId)
    .in("role", ["student", "cr"]);
  if (membersError) {
    throw new Error("Could not load class student records.");
  }

  const memberIds = members.map((member) => member.user_id);
  const { data: profiles, error: profilesError } = memberIds.length
    ? await supabase.from("profiles").select("id,full_name,username").in("id", memberIds)
    : { data: [], error: null };
  if (profilesError) {
    throw new Error("Could not load student profiles.");
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const className = classes.find((item) => item.id === classId)?.name ?? "Class";

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-sm text-muted-foreground">{className}</p>
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

      <ImportStudentsForm classId={classId} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Class members</h2>
        {members.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">No students yet.</CardContent></Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Roll number</TableHead>
                <TableHead>University roll number</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const profile = profilesById.get(member.user_id);
                return (
                  <TableRow key={member.user_id}>
                    <TableCell>{profile?.full_name ?? "Unknown"}</TableCell>
                    <TableCell>{profile?.username ?? "—"}</TableCell>
                    <TableCell>{member.roll_no ?? "—"}</TableCell>
                    <TableCell>{member.uni_roll_no ?? "—"}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>
                      {member.role === "student" && (
                        <SetCrRoleButton classId={classId} studentId={member.user_id} />
                      )}
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
