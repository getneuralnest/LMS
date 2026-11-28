import { z } from "zod";

export const ledgerEntrySchema = z
  .object({
    class_id: z.string().uuid(),
    type: z.enum(["collection", "expense", "fine_payment"]),
    amount: z.coerce.number().finite().positive(),
    note: z.string().trim().min(1).max(500),
    student_id: z.string().uuid().nullable(),
  })
  .strict()
  .refine((entry) => entry.type !== "expense" || entry.student_id === null, {
    message: "Expenses cannot be linked to a student.",
    path: ["student_id"],
  })
  .refine((entry) => entry.type !== "fine_payment" || entry.student_id !== null, {
    message: "Fine payments must be linked to a student.",
    path: ["student_id"],
  });

export type StudentLedgerEntry = {
  type: "fine" | "fine_payment";
  amount: number | string;
};

export function calculateStudentDue(entries: StudentLedgerEntry[]): number {
  const total = entries.reduce((due, entry) => {
    const amount = Number(entry.amount);
    return due + (entry.type === "fine" ? amount : -amount);
  }, 0);
  return Math.max(0, total);
}
