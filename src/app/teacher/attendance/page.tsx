import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LocalDateTimeText } from "../../../components/local-date-time";
import { AttendanceTable, type AttendanceRow } from "./attendance-table";
import { CreateAttendanceSessionForm } from "./create-session-form";
import { createClient } from "../../../utils/supabase/server";

type AttendancePageProps = {
  searchParams: Promise<{
    class_id?: string | string[];
    session_id?: string | string[];
    new_session?: string | string[];
  }>;
};

export default async function TeacherAttendancePage({
  searchParams,
}: AttendancePageProps) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: memberships, error: membershipsError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", user.id)
    .eq("role", "teacher");
  if (membershipsError) throw new Error("Could not load teacher class memberships.");

  const classIds = [...new Set(memberships.map((membership) => membership.class_id))];
  if (classIds.length === 0) redirect("/");

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id,name")
    .in("id", classIds);
  if (classesError) throw new Error("Could not load teacher classes.");

  const params = await searchParams;
  const requestedClassId = typeof params.class_id === "string" ? params.class_id : "";
  const classId = classIds.includes(requestedClassId) ? requestedClassId : classIds[0];
  const creatingSession = params.new_session === "1";
  const className = classes.find((item) => item.id === classId)?.name ?? "Class";

  let sessions: Array<{
    id: string;
    subject: string;
    starts_at: string;
    ends_at: string;
    late_fine: number;
  }> = [];
  if (!creatingSession) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select("id,subject,starts_at,ends_at,late_fine")
      .eq("class_id", classId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error("Could not load attendance sessions.");
    sessions = data;
  }

  const requestedSessionId = typeof params.session_id === "string" ? params.session_id : "";
  const selectedSession =
    sessions.find((session) => session.id === requestedSessionId) ?? sessions[0];

  let attendanceRows: AttendanceRow[] = [];
  if (selectedSession) {
    const { data: members, error: membersError } = await supabase
      .from("class_members")
      .select("user_id,roll_no,role")
      .eq("class_id", classId)
      .in("role", ["student", "cr"]);
    if (membersError) throw new Error("Could not load class students.");

    const memberIds = members.map((member) => member.user_id);
    const { data: profiles, error: profilesError } = memberIds.length
      ? await supabase.from("profiles").select("id,full_name").in("id", memberIds)
      : { data: [], error: null };
    if (profilesError) throw new Error("Could not load student profiles.");

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("id,student_id,status,locked")
      .eq("class_id", classId)
      .eq("session_id", selectedSession.id);
    if (attendanceError) throw new Error("Could not load attendance records.");

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const attendanceByStudent = new Map(
      attendance.map((record) => [record.student_id, record]),
    );
    attendanceRows = members
      .flatMap((member) => {
        const record = attendanceByStudent.get(member.user_id);
        if (!record) return [];
        return [{
          id: record.id,
          studentId: member.user_id,
          fullName: profileById.get(member.user_id)?.full_name ?? "Unknown student",
          rollNo: member.roll_no ?? "",
          status: record.status,
          locked: record.locked,
        }];
      })
      .sort((left, right) => left.rollNo.localeCompare(right.rollNo, undefined, { numeric: true }));
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">{className}</p>
        </div>
        {creatingSession ? (
          <a
            className="text-sm underline underline-offset-4"
            href={`/teacher/attendance?class_id=${encodeURIComponent(classId)}`}
          >
            Back to attendance
          </a>
        ) : (
          <a
            className="text-sm underline underline-offset-4"
            href={`/teacher/attendance?class_id=${encodeURIComponent(classId)}&new_session=1`}
          >
            Create session
          </a>
        )}
      </header>

      {creatingSession ? (
        <CreateAttendanceSessionForm classId={classId} />
      ) : (
        <>
          {classes.length > 1 && (
            <form method="get" className="flex flex-wrap items-center gap-3">
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
              <label htmlFor="session_id" className="text-sm font-medium">Session</label>
              <select
                id="session_id"
                name="session_id"
                defaultValue={selectedSession?.id ?? ""}
                className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.subject} — <LocalDateTimeText value={session.starts_at} />
                  </option>
                ))}
              </select>
              <button type="submit" className="text-sm underline underline-offset-4">Open</button>
            </form>
          )}

          {classes.length === 1 && sessions.length > 0 && (
            <form method="get" className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="class_id" value={classId} />
              <label htmlFor="session_id" className="text-sm font-medium">Session</label>
              <select
                id="session_id"
                name="session_id"
                defaultValue={selectedSession?.id}
                className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.subject} — <LocalDateTimeText value={session.starts_at} />
                  </option>
                ))}
              </select>
              <button type="submit" className="text-sm underline underline-offset-4">Open</button>
            </form>
          )}

          {selectedSession ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedSession.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  Ends <LocalDateTimeText value={selectedSession.ends_at} />
                </p>
              </div>
              <AttendanceTable
                key={selectedSession.id}
                classId={classId}
                sessionId={selectedSession.id}
                rows={attendanceRows}
                endsAt={selectedSession.ends_at}
                lateFine={selectedSession.late_fine}
              />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              No sessions yet. Create a session to record attendance.
            </p>
          )}
        </>
      )}
    </main>
  );
}
