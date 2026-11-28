"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { createAttendanceSession } from "./actions";

export function CreateAttendanceSessionForm({ classId }: { classId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startsAt = new Date(String(formData.get("starts_at_local") ?? ""));
    const endsAt = new Date(String(formData.get("ends_at_local") ?? ""));
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
      setError("Enter valid start and end times.");
      return;
    }

    formData.set("class_id", classId);
    formData.set("starts_at", startsAt.toISOString());
    formData.set("ends_at", endsAt.toISOString());
    setError(null);
    startTransition(async () => {
      const result = await createAttendanceSession(formData);
      if (result.error || !result.sessionId) {
        setError(result.error ?? "Could not create the session.");
        return;
      }

      router.push(
        `/teacher/attendance?class_id=${encodeURIComponent(classId)}&session_id=${encodeURIComponent(result.sessionId)}`,
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Create attendance session</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Subject</span>
          <input
            name="subject"
            required
            maxLength={120}
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Late fine</span>
          <input
            name="late_fine"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            defaultValue="0"
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Starts at</span>
          <input
            name="starts_at_local"
            type="datetime-local"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Ends at</span>
          <input
            name="ends_at_local"
            type="datetime-local"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3"
          />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create session"}
      </Button>
    </form>
  );
}
