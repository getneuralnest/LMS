import { z } from "zod";

export const attendanceStatusSchema = z.enum(["present", "absent", "late"]).nullable();

export const attendanceBatchSchema = z
  .object({
    classId: z.string().uuid(),
    sessionId: z.string().uuid(),
    updates: z
      .array(
        z
          .object({
            attendanceId: z.string().uuid(),
            status: attendanceStatusSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const attendanceSessionSchema = z
  .object({
    class_id: z.string().uuid(),
    subject: z.string().trim().min(1).max(120),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    late_fine: z.coerce.number().finite().min(0).max(1_000_000),
  })
  .strict()
  .refine((session) => Date.parse(session.ends_at) > Date.parse(session.starts_at), {
    message: "The end time must be after the start time.",
    path: ["ends_at"],
  });

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export function calculateAttendanceFine(
  status: AttendanceStatus,
  lateFine: number,
): number {
  return status === "late" ? lateFine : 0;
}
