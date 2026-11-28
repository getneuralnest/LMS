"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { createLedgerEntry, type LedgerActionState } from "./actions";

export type LedgerStudentOption = {
  userId: string;
  label: string;
};

const initialLedgerActionState: LedgerActionState = {
  error: null,
  message: null,
};

export function LedgerEntryForm({
  classId,
  students,
}: {
  classId: string;
  students: LedgerStudentOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createLedgerEntry,
    initialLedgerActionState,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Add ledger entry</h2>
      <input type="hidden" name="class_id" value={classId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Type</span>
          <select
            name="type"
            defaultValue="collection"
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="collection">Collection</option>
            <option value="expense">Expense</option>
            <option value="fine_payment">Fine payment</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Student (required for fine payments)</span>
          <select
            name="student_id"
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="">Class-level entry</option>
            {students.map((student) => (
              <option key={student.userId} value={student.userId}>{student.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Note</span>
          <input
            name="note"
            required
            maxLength={500}
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add entry"}
      </Button>
    </form>
  );
}
