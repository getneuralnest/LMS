"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  saveGrade,
  type AssignmentActionState,
} from "./actions";

const initialState: AssignmentActionState = { error: null, message: null };

export function GradeForm({
  submissionId,
  studentName,
  maxMarks,
  marks,
  feedback,
}: {
  submissionId: string;
  studentName: string;
  maxMarks: number;
  marks?: number;
  feedback?: string;
}) {
  const [state, formAction, pending] = useActionState(saveGrade, initialState);

  return (
    <form
      action={formAction}
      aria-label={`Grade ${studentName}`}
      className="space-y-2 border-t pt-3"
    >
      <input type="hidden" name="submission_id" value={submissionId} />
      <label className="block space-y-1 text-sm">
        Marks (out of {maxMarks})
        <Input
          name="marks"
          type="number"
          min="0"
          max={maxMarks}
          step="0.01"
          defaultValue={marks}
          required
        />
      </label>
      <label className="block space-y-1 text-sm">
        Feedback
        <textarea
          name="feedback"
          defaultValue={feedback ?? ""}
          maxLength={5000}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save grade"}
      </Button>
    </form>
  );
}
