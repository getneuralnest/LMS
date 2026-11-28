import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LocalDateTimeText } from "../../../components/local-date-time";
import { createClient } from "../../../utils/supabase/server";
import { AssignmentForm } from "./assignment-form";
import { GradeForm } from "./grade-form";

type AssignmentsPageProps = {
  searchParams: Promise<{ class_id?: string | string[] }>;
};

export default async function TeacherAssignmentsPage({
  searchParams,
}: AssignmentsPageProps) {
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
  const className = classes.find((item) => item.id === classId)?.name ?? "Class";
  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select(
      "id,kind,title,description,due_at,max_marks,submission_type,submission_mode",
    )
    .eq("class_id", classId)
    .order("due_at", { ascending: true });
  if (assignmentsError) throw new Error("Could not load class assignments.");
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { data: submissions, error: submissionsError } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id,assignment_id,student_id,file_path,link,submitted_at,submitted_late")
        .eq("class_id", classId)
        .in("assignment_id", assignmentIds)
        .order("submitted_at", { ascending: false })
    : { data: [], error: null };
  if (submissionsError) throw new Error("Could not load class submissions.");
  const submissionIds = submissions.map((submission) => submission.id);
  const { data: grades, error: gradesError } = submissionIds.length
    ? await supabase
        .from("grades")
        .select("submission_id,marks,feedback")
        .in("submission_id", submissionIds)
    : { data: [], error: null };
  if (gradesError) throw new Error("Could not load submission grades.");
  const studentIds = [...new Set(submissions.map((submission) => submission.student_id))];
  const { data: profiles, error: profilesError } = studentIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", studentIds)
    : { data: [], error: null };
  if (profilesError) throw new Error("Could not load student names.");
  const gradeBySubmission = new Map(
    grades.map((grade) => [grade.submission_id, grade]),
  );
  const profileByStudent = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
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

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Assignments</h1>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Create assignment</h2>
        <AssignmentForm classId={classId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Class assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          assignments.map((assignment) => (
            <article key={assignment.id} className="space-y-3">
              <div>
                <h3 className="font-medium">{assignment.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {assignment.kind} · due <LocalDateTimeText value={assignment.due_at} /> ·{" "}
                  {assignment.max_marks} marks · {assignment.submission_type} ·{" "}
                  {assignment.submission_mode} deadline
                </p>
              </div>
              <AssignmentForm
                classId={classId}
                assignment={{
                  ...assignment,
                  maxMarks: assignment.max_marks,
                  dueAt: assignment.due_at,
                  submissionType: assignment.submission_type,
                  submissionMode: assignment.submission_mode,
                }}
              />
              <section className="space-y-3 rounded-lg border p-4">
                <h4 className="font-medium">Submissions</h4>
                {submissions.filter((submission) => submission.assignment_id === assignment.id)
                  .length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions yet.</p>
                ) : (
                  submissions
                    .filter((submission) => submission.assignment_id === assignment.id)
                    .map((submission) => {
                      const grade = gradeBySubmission.get(submission.id);
                      return (
                        <article key={submission.id} className="space-y-2 rounded-md border p-3">
                          <div>
                            <h5 className="font-medium">
                              {profileByStudent.get(submission.student_id) ?? "Student"}
                            </h5>
                            <p className="text-sm text-muted-foreground">
                              Submitted <LocalDateTimeText value={submission.submitted_at} />
                              {submission.submitted_late ? " · Late" : ""}
                            </p>
                          </div>
                          {submission.link && (
                            <a
                              className="text-sm underline underline-offset-4"
                              href={submission.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open submitted link
                            </a>
                          )}
                          {signedFileBySubmission.get(submission.id) && (
                            <a
                              className="text-sm underline underline-offset-4"
                              href={signedFileBySubmission.get(submission.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open submitted file
                            </a>
                          )}
                          <GradeForm
                            submissionId={submission.id}
                            studentName={profileByStudent.get(submission.student_id) ?? "Student"}
                            maxMarks={assignment.max_marks}
                            marks={grade?.marks}
                            feedback={grade?.feedback}
                          />
                        </article>
                      );
                    })
                )}
              </section>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
