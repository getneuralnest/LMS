import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "../../../../utils/supabase/server";

function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const classId = z.string().uuid().safeParse(
    new URL(request.url).searchParams.get("class_id"),
  );
  if (!classId.success) return new Response("Invalid class.", { status: 400 });

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return new Response("Sign in required.", { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", classId.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return new Response("Could not verify class access.", { status: 500 });
  if (!membership || !["teacher", "cr"].includes(membership.role)) {
    return new Response("Teacher or CR access required.", { status: 403 });
  }

  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("created_at,type,amount,student_id,note,recorded_by")
    .eq("class_id", classId.data)
    .order("created_at", { ascending: true });
  if (entriesError) return new Response("Could not load ledger entries.", { status: 500 });

  const csv = [
    ["created_at", "type", "amount", "student_id", "note", "recorded_by"]
      .map(csvCell)
      .join(","),
    ...entries.map((entry) =>
      [
        entry.created_at,
        entry.type,
        entry.amount,
        entry.student_id,
        entry.note,
        entry.recorded_by,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="class-ledger-${classId.data}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
