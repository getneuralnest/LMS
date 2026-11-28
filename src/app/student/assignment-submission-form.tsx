"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  submitAssignment,
  type SubmissionActionState,
} from "./actions";

const initialState: SubmissionActionState = { error: null, message: null };

type StudentSubmissionFormProps = {
  classId: string;
  assignmentId: string;
  dueAt: string;
  submissionMode: "hard" | "soft";
  status: "pending" | "submitted" | "graded";
  submissionType: "file" | "link" | "either";
  existingLink: string | null;
  existingFileUrl: string | null;
};

export function StudentSubmissionForm({
  classId,
  assignmentId,
  dueAt,
  submissionMode,
  status,
  submissionType,
  existingLink,
  existingFileUrl,
}: StudentSubmissionFormProps) {
  const [state, formAction, pending] = useActionState(submitAssignment, initialState);
  const [pastDue, setPastDue] = useState(false);

  useEffect(() => {
    const delay = Math.max(0, Date.parse(dueAt) - Date.now());
    const timer = window.setTimeout(() => setPastDue(true), delay);
    return () => window.clearTimeout(timer);
  }, [dueAt]);
  const isLocked = submissionMode === "hard" && pastDue;
  const visibleStatus =
    status === "graded" ? "Graded" : status === "submitted" ? "Submitted" : pastDue ? "Overdue" : "Pending";

  return (
    <div className="space-y-2">
      <p className="text-sm">{visibleStatus}</p>
      {existingLink && (
        <p className="text-sm">
          Current submission:{" "}
          <a
            href={existingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Open submitted link
          </a>
        </p>
      )}
      {existingFileUrl && (
        <p className="text-sm">
          Current submission:{" "}
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Open submitted file
          </a>
        </p>
      )}
      {isLocked ? (
        <p className="text-sm text-muted-foreground">The hard deadline has passed.</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="assignment_id" value={assignmentId} />
          {submissionType !== "link" && (
            <label className="flex-1 space-y-1 text-sm">
              File (PDF, DOCX, PPTX, PNG, or JPG; max 10 MB)
              <Input
                name="file"
                type="file"
                accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                disabled={pending}
              />
            </label>
          )}
          {submissionType !== "file" && (
            <label className="flex-1 space-y-1 text-sm">
              Link
              <Input
                name="link"
                type="url"
                maxLength={2048}
                placeholder="https://"
                disabled={pending}
              />
            </label>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting..." : "Submit work"}
          </Button>
        </form>
      )}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
    </div>
  );
}
