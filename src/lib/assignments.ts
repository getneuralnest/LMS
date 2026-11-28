import { z } from "zod";

const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid due date.")
  .refine((value) => {
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day &&
      parsed.getUTCHours() === hour &&
      parsed.getUTCMinutes() === minute
    );
  }, "Enter a valid due date.");

export const assignmentSchema = z
  .object({
    class_id: z.string().uuid(),
    id: z.string().uuid().optional(),
    kind: z.enum(["assignment", "presentation"]),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(5000),
    due_at: localDateTimeSchema,
    timezone_offset: z.coerce.number().int().min(-840).max(840),
    max_marks: z.coerce.number().finite().positive().max(1_000_000),
    submission_type: z.enum(["file", "link", "either"]),
    submission_mode: z.enum(["hard", "soft"]),
  })
  .strict();

export type AssignmentInput = z.infer<typeof assignmentSchema>;

export function assignmentDueAt(input: Pick<AssignmentInput, "due_at" | "timezone_offset">) {
  const [date, time] = input.due_at.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) + input.timezone_offset * 60_000,
  ).toISOString();
}

export const submissionLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Use an http or https link.");

export const gradeSchema = z
  .object({
    submission_id: z.string().uuid(),
    marks: z.coerce.number().finite().min(0).max(1_000_000),
    feedback: z.string().trim().max(5000),
  })
  .strict();
