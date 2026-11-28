"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  createAssignment,
  updateAssignment,
  type AssignmentActionState,
} from "./actions";

type AssignmentValues = {
  id: string;
  kind: "assignment" | "presentation";
  title: string;
  description: string;
  dueAt: string;
  maxMarks: number;
  submissionType: "file" | "link" | "either";
  submissionMode: "hard" | "soft";
};

const initialState: AssignmentActionState = { error: null, message: null };

function localDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function AssignmentForm({
  classId,
  assignment,
}: {
  classId: string;
  assignment?: AssignmentValues;
}) {
  const action = assignment ? updateAssignment : createAssignment;
  const [state, formAction, pending] = useActionState(action, initialState);
  const dueAtRef = useRef<HTMLInputElement>(null);
  const timezoneOffsetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dueAtRef.current && assignment?.dueAt) {
      dueAtRef.current.value = localDateTimeValue(assignment.dueAt);
    }
  }, [assignment?.dueAt]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (timezoneOffsetRef.current) {
          timezoneOffsetRef.current.value = String(new Date().getTimezoneOffset());
        }
      }}
      className="space-y-3 rounded-lg border p-4"
    >
      <input type="hidden" name="class_id" value={classId} />
      {assignment && <input type="hidden" name="id" value={assignment.id} />}
      <input ref={timezoneOffsetRef} type="hidden" name="timezone_offset" defaultValue="0" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Type
          <select
            name="kind"
            defaultValue={assignment?.kind ?? "assignment"}
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="assignment">Assignment</option>
            <option value="presentation">Presentation</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Title
          <Input name="title" defaultValue={assignment?.title} maxLength={160} required />
        </label>
        <label className="space-y-1 text-sm">
          Due date and time
          <Input
            ref={dueAtRef}
            name="due_at"
            type="datetime-local"
            defaultValue={assignment ? localDateTimeValue(assignment.dueAt) : undefined}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          Maximum marks
          <Input
            name="max_marks"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={assignment?.maxMarks ?? 100}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          Accepted submission
          <select
            name="submission_type"
            defaultValue={assignment?.submissionType ?? "either"}
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="file">File</option>
            <option value="link">Link</option>
            <option value="either">File or link</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Deadline mode
          <select
            name="submission_mode"
            defaultValue={assignment?.submissionMode ?? "hard"}
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="hard">Hard deadline</option>
            <option value="soft">Accept late submissions</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        Description
        <textarea
          name="description"
          defaultValue={assignment?.description ?? ""}
          maxLength={5000}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : assignment ? "Save assignment" : "Create assignment"}
      </Button>
    </form>
  );
}
