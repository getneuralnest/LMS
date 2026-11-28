"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ledgerEntrySchema } from "../../../lib/ledger";
import { createClient } from "../../../utils/supabase/server";

export type LedgerActionState = {
  error: string | null;
  message: string | null;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createLedgerEntry(
  _previousState: LedgerActionState,
  formData: FormData,
): Promise<LedgerActionState> {
  const parsed = ledgerEntrySchema.safeParse({
    class_id: formValue(formData, "class_id"),
    type: formValue(formData, "type"),
    amount: formValue(formData, "amount"),
    note: formValue(formData, "note"),
    student_id: formValue(formData, "student_id") || null,
  });
  if (!parsed.success) {
    return { error: "Enter a valid collection or expense.", message: null };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Sign in again before adding a ledger entry.", message: null };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) {
    return { error: "Could not verify class access.", message: null };
  }
  if (!membership || !["teacher", "cr"].includes(membership.role)) {
    return { error: "Teacher or CR access required.", message: null };
  }

  if (parsed.data.student_id) {
    const { data: studentMembership, error: studentError } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", parsed.data.class_id)
      .eq("user_id", parsed.data.student_id)
      .in("role", ["student", "cr"])
      .maybeSingle();
    if (studentError) return { error: "Could not verify the selected student.", message: null };
    if (!studentMembership) {
      return { error: "Select a student from this class.", message: null };
    }
    if (parsed.data.type === "fine_payment" && !parsed.data.student_id) {
      return { error: "Select a student for a fine payment.", message: null };
    }
  }

  const { error: insertError } = await supabase.from("ledger_entries").insert({
    class_id: parsed.data.class_id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    note: parsed.data.note,
    student_id: parsed.data.student_id,
    recorded_by: user.id,
  });
  if (insertError) {
    return { error: "Could not add the ledger entry.", message: null };
  }

  revalidatePath("/teacher/ledger");
  revalidatePath("/student");
  return { error: null, message: "Ledger entry added." };
}
