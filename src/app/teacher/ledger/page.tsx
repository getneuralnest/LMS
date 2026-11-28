import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LocalDateTimeText } from "../../../components/local-date-time";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { createClient } from "../../../utils/supabase/server";
import { LedgerEntryForm } from "./ledger-entry-form";

type LedgerPageProps = {
  searchParams: Promise<{ class_id?: string | string[] }>;
};

export default async function TeacherLedgerPage({ searchParams }: LedgerPageProps) {
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
    .in("role", ["teacher", "cr"]);
  if (membershipsError) throw new Error("Could not load ledger class memberships.");

  const classIds = [...new Set(memberships.map((membership) => membership.class_id))];
  if (classIds.length === 0) redirect("/student");

  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id,name")
    .in("id", classIds);
  if (classesError) throw new Error("Could not load ledger classes.");

  const params = await searchParams;
  const requestedClassId = typeof params.class_id === "string" ? params.class_id : "";
  const classId = classIds.includes(requestedClassId) ? requestedClassId : classIds[0];
  const className = classes.find((item) => item.id === classId)?.name ?? "Class";

  const { data: totals, error: totalsError } = await supabase.rpc(
    "get_class_ledger_totals",
    { p_class_id: classId },
  );
  if (totalsError || !totals?.[0]) throw new Error("Could not load class ledger totals.");

  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("id,type,amount,note,student_id,created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (entriesError) throw new Error("Could not load class ledger entries.");

  const { data: students, error: studentsError } = await supabase
    .from("class_members")
    .select("user_id,roll_no,uni_roll_no")
    .eq("class_id", classId)
    .in("role", ["student", "cr"]);
  if (studentsError) throw new Error("Could not load class students.");

  const studentLabels = new Map(
    students.map((student) => [
      student.user_id,
      student.roll_no
        ? `Roll ${student.roll_no}`
        : student.uni_roll_no
          ? `University roll ${student.uni_roll_no}`
          : "Student",
    ] as const),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">CR ledger</h1>
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
        <h2 className="text-lg font-semibold">Class totals</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Collections</p>
            <p className="text-xl font-semibold">{Number(totals[0].collection_total).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-xl font-semibold">{Number(totals[0].expense_total).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-xl font-semibold">{Number(totals[0].balance_total).toFixed(2)}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Fines: {Number(totals[0].fine_total).toFixed(2)} · Fine payments:{" "}
          {Number(totals[0].fine_payment_total).toFixed(2)}
        </p>
      </section>

      <LedgerEntryForm
        classId={classId}
        students={students.map((student) => ({
          userId: student.user_id,
          label: studentLabels.get(student.user_id) ?? "Student",
        }))}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Entries</h2>
          <Link
            href={`/teacher/ledger/export?class_id=${encodeURIComponent(classId)}`}
            className="text-sm underline underline-offset-4"
          >
            Export CSV
          </Link>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell><LocalDateTimeText value={entry.created_at} /></TableCell>
                  <TableCell>{entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</TableCell>
                  <TableCell>{Number(entry.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {entry.student_id ? studentLabels.get(entry.student_id) ?? "Student" : "Class"}
                  </TableCell>
                  <TableCell>{entry.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
