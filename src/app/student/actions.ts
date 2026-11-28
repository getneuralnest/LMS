"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { submissionLinkSchema } from "../../lib/assignments";
import { createClient } from "../../utils/supabase/server";

export type SubmissionActionState = {
  error: string | null;
  message: string | null;
};

const submissionInputSchema = z
  .object({
    class_id: z.string().uuid(),
    assignment_id: z.string().uuid(),
    link: z.string().trim().max(2048).optional(),
  })
  .strict();

const initialError = (error: string): SubmissionActionState => ({
  error,
  message: null,
});

export async function submitAssignment(
  _previousState: SubmissionActionState,
  formData: FormData,
): Promise<SubmissionActionState> {
  const fileValue = formData.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const parsed = submissionInputSchema.safeParse({
    class_id: formData.get("class_id"),
    assignment_id: formData.get("assignment_id"),
    link: typeof formData.get("link") === "string" ? formData.get("link") : "",
  });
  if (!parsed.success) return initialError("Invalid submission details.");

  const link = parsed.data.link || null;
  if (link && !submissionLinkSchema.safeParse(link).success) {
    return initialError("Use a valid http or https link.");
  }
  if (!file && !link) return initialError("Choose a file or provide a link.");
  if (file && link) return initialError("Submit either a file or a link, not both.");

  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return initialError("Sign in again before submitting work.");

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("role")
    .eq("class_id", parsed.data.class_id)
    .eq("user_id", user.id)
    .in("role", ["student", "cr"])
    .maybeSingle();
  if (membershipError) return initialError("Could not verify class access.");
  if (!membership) return initialError("You cannot submit work for this class.");

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id,submission_type,submission_mode,due_at")
    .eq("id", parsed.data.assignment_id)
    .eq("class_id", parsed.data.class_id)
    .maybeSingle();
  if (assignmentError || !assignment) return initialError("Assignment not found.");
  if (assignment.submission_mode === "hard" && Date.now() > Date.parse(assignment.due_at)) {
    return initialError("The hard deadline has passed.");
  }
  if (file && !["file", "either"].includes(assignment.submission_type)) {
    return initialError("This assignment accepts links only.");
  }
  if (link && !["link", "either"].includes(assignment.submission_type)) {
    return initialError("This assignment accepts files only.");
  }

  const allowedTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  let filePath: string | null = null;
  let previousFilePath: string | null = null;

  const { data: existing, error: existingError } = await supabase
    .from("submissions")
    .select("file_path")
    .eq("assignment_id", assignment.id)
    .eq("student_id", user.id)
    .maybeSingle();
  if (existingError) return initialError("Could not load the current submission.");
  previousFilePath = existing?.file_path ?? null;

  if (file) {
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (
      file.size > 10 * 1024 * 1024 ||
      !allowedTypes[extension] ||
      allowedTypes[extension] !== file.type
    ) {
      return initialError("Choose a PDF, DOCX, PPTX, PNG, or JPG file up to 10 MB.");
    }

    filePath = `${parsed.data.class_id}/${assignment.id}/${user.id}/submission${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) return initialError("Could not upload the submission file.");
  }

  const { error: saveError } = await supabase.from("submissions").upsert(
    {
      class_id: parsed.data.class_id,
      assignment_id: assignment.id,
      student_id: user.id,
      file_path: filePath,
      link,
      status: "submitted",
    },
    { onConflict: "assignment_id,student_id" },
  );
  if (saveError) {
    if (filePath && filePath !== previousFilePath) {
      const { error: cleanupError } = await supabase.storage
        .from("submissions")
        .remove([filePath]);
      if (cleanupError) console.error("Could not remove an orphaned submission upload.", cleanupError);
    }
    return initialError("Could not save your submission.");
  }

  if (previousFilePath && previousFilePath !== filePath) {
    const { error: removeError } = await supabase.storage
      .from("submissions")
      .remove([previousFilePath]);
    if (removeError) {
      console.error("Could not remove the replaced submission file.", removeError);
    }
  }

  revalidatePath("/student");
  revalidatePath("/teacher/assignments");
  return {
    error: null,
    message: "Submission saved.",
  };
}
