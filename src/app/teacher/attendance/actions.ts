"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  attendanceBatchSchema,
  attendanceSessionSchema,
} from "../../../lib/attendance";
import { createClient } from "../../../utils/supabase/server";

export type AttendanceActionResult = {
  error: string | null;
  message?: string;
  sessionId?: string;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createAttendanceSession(
  formData: FormData,
): Promise<AttendanceActionResult> {
  const parsed = attendanceSessionSchema.safeParse({
    class_id: formValue(formData, "class_id"),
    subject: formValue(formData, "subject"),
    starts_at: formValue(formData, "starts_at"),
    ends_at: formValue(formData, "ends_at"),
    late_fine: formValue(formData, "late_fine"),
  });
  if (!parsed.success) {
    return { error: "Enter a subject, valid times, and a non-negative late fine." };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Sign in again before creating a session." };

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();
  if (membershipError) return { error: "Could not verify teacher access." };
  if (!membership) return { error: "Teacher access required." };

  const { data: session, error: insertError } = await supabase
    .from("class_sessions")
    .insert({
      class_id: parsed.data.class_id,
      subject: parsed.data.subject,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at,
      late_fine: parsed.data.late_fine,
    })
    .select("id")
    .single();
  if (insertError || !session) {
    return { error: "Could not create the attendance session." };
  }

  revalidatePath("/teacher/attendance");
  return { error: null, sessionId: session.id };
}

export async function saveAttendanceBatch(formData: FormData): Promise<AttendanceActionResult> {
  const rawInput = formData.get("payload");
  if (typeof rawInput !== "string") return { error: "Invalid attendance changes." };

  let input: unknown;
  try {
    input = JSON.parse(rawInput);
  } catch {
    return { error: "Invalid attendance changes." };
  }

  const parsed = attendanceBatchSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid attendance changes." };

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Sign in again before updating attendance." };

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", parsed.data.classId)
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();
  if (membershipError) return { error: "Could not verify teacher access." };
  if (!membership) return { error: "Teacher access required." };

  const { error: saveError } = await supabase.rpc("save_attendance_batch", {
    p_class_id: parsed.data.classId,
    p_session_id: parsed.data.sessionId,
    p_updates: parsed.data.updates.map((update) => ({
      attendance_id: update.attendanceId,
      status: update.status,
    })),
  });
  if (saveError) {
    return {
      error: "Could not save attendance. Check that the session is still open and try again.",
    };
  }

  revalidatePath("/teacher/attendance");
  return { error: null, message: "Attendance saved." };
}
