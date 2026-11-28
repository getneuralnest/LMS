import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { LocalDateTimeText } from "../../components/local-date-time";
import { calculateStudentDue } from "../../lib/ledger";
import { createClient } from "../../utils/supabase/server";
import { StudentSubmissionForm } from "./assignment-submission-form";
import { EmailConfirmationReminder } from "../email-confirmation-reminder";

type StudentPageProps = {
  searchParams: Promise<{ emailReminder?: string | string[] }>;
};

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("contact_email,email_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Could not load student account details.");

  const { data: memberships, error: membershipsError } = await supabase
    .from("class_members")
    .select("class_id,role")
    .eq("user_id", user.id)
    .in("role", ["student", "cr"]);
  if (membershipsError) throw new Error("Could not load student class memberships.");

  const classIds = [...new Set(memberships.map((membership) => membership.class_id))];
  const { data: classes, error: classesError } = classIds.length
    ? await supabase.from("classes").select("id,name").in("id", classIds)
    : { data: [], error: null };
  if (classesError) throw new Error("Could not load student classes.");

  const { data: assignments, error: assignmentsError } = classIds.length
    ? await supabase
        .from("assignments")
        .select(
          "id,class_id,kind,title,description,due_at,max_marks,submission_type,submission_mode",
        )
        .in("class_id", classIds)
        .order("due_at", { ascending: true })
    : { data: [], error: null };
  if (assignmentsError) throw new Error("Could not load class assignments.");
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { data: submissions, error: submissionsError } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id,assignment_id,file_path,link,submitted_at,submitted_late")
        .eq("student_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };
  if (submissionsError) throw new Error("Could not load student submissions.");
  const submissionIds = submissions.map((submission) => submission.id);
  const { data: grades, error: gradesError } = submissionIds.length
    ? await supabase
        .from("grades")
        .select("submission_id,marks,feedback")
        .in("submission_id", submissionIds)
    : { data: [], error: null };
  if (gradesError) throw new Error("Could not load student grades.");

  const submissionsByAssignment = new Map(
    submissions.map((submission) => [submission.assignment_id, submission]),
  );
  const gradesBySubmission = new Map(
    grades.map((grade) => [grade.submission_id, grade]),
  );
  const signedFiles = await Promise.all(
    submissions.flatMap((submission) =>
      submission.file_path
        ? [
            supabase.storage
              .from("submissions")
              .createSignedUrl(submission.file_path, 300)
              .then(({ data, error }) => {
                if (error) throw new Error("Could not create a private submission link.");
                return [submission.id, data.signedUrl] as const;
              }),
          ]
        : [],
    ),
  );
  const signedFileBySubmission = new Map(signedFiles);

  const { data: sessions, error: sessionsError } = classIds.length
    ? await supabase
        .from("class_sessions")
        .select("id,class_id,subject,starts_at,ends_at")
        .in("class_id", classIds)
        .order("starts_at", { ascending: false })
    : { data: [], error: null };
  if (sessionsError) throw new Error("Could not load attendance sessions.");

  const sessionIds = sessions.map((session) => session.id);
  const { data: attendance, error: attendanceError } = sessionIds.length
    ? await supabase
        .from("attendance")
        .select("session_id,status,locked")
        .eq("student_id", user.id)
        .in("session_id", sessionIds)
    : { data: [], error: null };
  if (attendanceError) throw new Error("Could not load student attendance.");

  const attendanceBySession = new Map(
    attendance.map((record) => [record.session_id, record]),
  );
  const studentSessions = sessions.filter((session) =>
    attendanceBySession.has(session.id),
  );
  const { data: ledgerEntries, error: ledgerError } = classIds.length
    ? await supabase
        .from("ledger_entries")
        .select("class_id,type,amount,note,created_at")
        .eq("student_id", user.id)
        .in("class_id", classIds)
        .in("type", ["fine", "fine_payment"])
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (ledgerError) throw new Error("Could not load student ledger entries.");

  const ledgerTotals = await Promise.all(
    classIds.map(async (classId) => {
      const { data, error } = await supabase.rpc("get_class_ledger_totals", {
        p_class_id: classId,
      });
      if (error || !data?.[0]) throw new Error("Could not load class ledger totals.");
      return { classId, ...data[0] };
    }),
  );
  const dueByClass = new Map(
    classIds.map((classId) => [
      classId,
      calculateStudentDue(
        ledgerEntries.filter((entry) => entry.class_id === classId),
      ),
    ]),
  );
  const isClassRepresentative = memberships.some((membership) => membership.role === "cr");
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const params = await searchParams;
  const reminderRequested = params.emailReminder === "1";

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Student portal</h1>
      <p className="text-sm text-muted-foreground">Welcome to your class portal.</p>
      {isClassRepresentative && (
        <Link className="text-sm underline underline-offset-4" href="/teacher/ledger">
          Manage CR ledger
        </Link>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assignments due</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const submission = submissionsByAssignment.get(assignment.id);
              const grade = submission ? gradesBySubmission.get(submission.id) : undefined;
              return (
                <article key={assignment.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{assignment.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {classNames.get(assignment.class_id) ?? "Class"} · {assignment.kind} · due{" "}
                        <LocalDateTimeText value={assignment.due_at} /> · {assignment.max_marks} marks
                      </p>
                      {assignment.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">
                          {assignment.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {submission?.submitted_late && (
                    <p className="text-sm text-muted-foreground">Submitted late.</p>
                  )}
                  {grade && (
                    <div className="text-sm">
                      <p>Marks: {grade.marks}</p>
                      {grade.feedback && <p>Feedback: {grade.feedback}</p>}
                    </div>
                  )}
                  <StudentSubmissionForm
                    classId={assignment.class_id}
                    assignmentId={assignment.id}
                    dueAt={assignment.due_at}
                    submissionMode={assignment.submission_mode}
                    status={grade ? "graded" : submission ? "submitted" : "pending"}
                    submissionType={assignment.submission_type}
                    existingLink={submission?.link ?? null}
                    existingFileUrl={
                      submission ? signedFileBySubmission.get(submission.id) ?? null : null
                    }
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My attendance</h2>
        {studentSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance sessions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Session start</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentSessions.map((session) => {
                const record = attendanceBySession.get(session.id);
                return (
                  <TableRow key={session.id}>
                    <TableCell>{classNames.get(session.class_id) ?? "Class"}</TableCell>
                    <TableCell>{session.subject}</TableCell>
                    <TableCell><LocalDateTimeText value={session.starts_at} /></TableCell>
                    <TableCell>
                      {!record || record.status === null
                        ? "Not marked"
                        : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Class ledger totals</h2>
        {ledgerTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No class totals available.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Collections</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Fines</TableHead>
                <TableHead>My dues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerTotals.map((totals) => (
                <TableRow key={totals.classId}>
                  <TableCell>{classNames.get(totals.classId) ?? "Class"}</TableCell>
                  <TableCell>{Number(totals.collection_total).toFixed(2)}</TableCell>
                  <TableCell>{Number(totals.expense_total).toFixed(2)}</TableCell>
                  <TableCell>{Number(totals.fine_total).toFixed(2)}</TableCell>
                  <TableCell>{(dueByClass.get(totals.classId) ?? 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">My fines and payments</h2>
        {ledgerEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No personal ledger entries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerEntries.map((entry, index) => (
                <TableRow key={`${entry.class_id}-${entry.created_at}-${index}`}>
                  <TableCell><LocalDateTimeText value={entry.created_at} /></TableCell>
                  <TableCell>{entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</TableCell>
                  <TableCell>{Number(entry.amount).toFixed(2)}</TableCell>
                  <TableCell>{entry.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <EmailConfirmationReminder
        email={profile.contact_email}
        open={reminderRequested && !profile.email_confirmed_at}
      />
    </main>
  );
}
