"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  assignmentDueAt,
  assignmentSchema,
  gradeSchema,
} from "../../../lib/assignments";
import { createClient } from "../../../utils/supabase/server";

export type AssignmentActionState = {
  error: string | null;
  message: string | null;
};

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function validateTeacherAndInput(formData: FormData) {
  const parsed = assignmentSchema.safeParse({
    class_id: formValue(formData, "class_id"),
    id: formValue(formData, "id") || undefined,
    kind: formValue(formData, "kind"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    due_at: formValue(formData, "due_at"),
    timezone_offset: formValue(formData, "timezone_offset"),
    max_marks: formValue(formData, "max_marks"),
    submission_type: formValue(formData, "submission_type"),
    submission_mode: formValue(formData, "submission_mode"),
  });
  if (!parsed.success) {
    return {
      error: "Check the assignment fields and try again.",
      supabase: null,
      input: null,
    } as const;
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      error: "Sign in again before saving this assignment.",
      supabase: null,
      input: null,
    } as const;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();
  if (membershipError) {
    return { error: "Could not verify teacher access.", supabase: null, input: null } as const;
  }
  if (!membership) {
    return { error: "Teacher access required.", supabase: null, input: null } as const;
  }

  return { error: null, supabase, input: parsed.data } as const;
}

export async function createAssignment(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const validated = await validateTeacherAndInput(formData);
  if (validated.error || !validated.supabase || !validated.input) {
    return { error: validated.error, message: null };
  }
  if (validated.input.id) {
    return { error: "Invalid assignment identifier.", message: null };
  }

  const { input, supabase } = validated;
  const { error } = await supabase.from("assignments").insert({
    class_id: input.class_id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    due_at: assignmentDueAt(input),
    max_marks: input.max_marks,
    submission_type: input.submission_type,
    submission_mode: input.submission_mode,
  });
  if (error) return { error: "Could not create the assignment.", message: null };

  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  return { error: null, message: "Assignment created." };
}

export async function updateAssignment(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const validated = await validateTeacherAndInput(formData);
  if (validated.error || !validated.supabase || !validated.input) {
    return { error: validated.error, message: null };
  }
  if (!validated.input.id) {
    return { error: "Assignment identifier is required.", message: null };
  }

  const { input, supabase } = validated;
  const { data, error } = await supabase
    .from("assignments")
    .update({
      kind: input.kind,
      title: input.title,
      description: input.description,
      due_at: assignmentDueAt(input),
      max_marks: input.max_marks,
      submission_type: input.submission_type,
      submission_mode: input.submission_mode,
    })
    .eq("id", input.id)
    .eq("class_id", input.class_id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not update the assignment.", message: null };

  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  return { error: null, message: "Assignment updated." };
}

export async function saveGrade(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const parsed = gradeSchema.safeParse({
    submission_id: formValue(formData, "submission_id"),
    marks: formValue(formData, "marks"),
    feedback: formValue(formData, "feedback"),
  });
  if (!parsed.success) {
    return { error: "Enter valid marks and feedback.", message: null };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Sign in again before grading submissions.", message: null };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id,class_id,assignment_id")
    .eq("id", parsed.data.submission_id)
    .maybeSingle();
  if (submissionError || !submission) {
    return { error: "Submission not found.", message: null };
  }
  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("class_id", submission.class_id)
    .eq("user_id", user.id)
    .eq("role", "teacher")
    .maybeSingle();
  if (membershipError) {
    return { error: "Could not verify teacher access.", message: null };
  }
  if (!membership) return { error: "Teacher access required.", message: null };

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("max_marks")
    .eq("id", submission.assignment_id)
    .eq("class_id", submission.class_id)
    .single();
  if (assignmentError || !assignment || parsed.data.marks > assignment.max_marks) {
    return { error: "Marks cannot exceed the assignment maximum.", message: null };
  }

  const { error: gradeError } = await supabase.from("grades").upsert(
    {
      submission_id: submission.id,
      class_id: submission.class_id,
      marks: parsed.data.marks,
      feedback: parsed.data.feedback,
      graded_by: user.id,
    },
    { onConflict: "submission_id" },
  );
  if (gradeError) return { error: "Could not save the grade.", message: null };

  revalidatePath("/teacher/assignments");
  revalidatePath("/student");
  return { error: null, message: "Grade saved." };
}
