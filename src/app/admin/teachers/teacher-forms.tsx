"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  createTeacher,
  deactivateTeacher,
  resetTeacherPassword,
  type AdminTeacherActionState,
} from "./actions";

const initialState: AdminTeacherActionState = { error: null, message: null };

export function CreateTeacherForm({
  classes,
}: {
  classes: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(createTeacher, initialState);

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="text-lg font-semibold">Create teacher</h2>
      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create a class before adding a teacher.</p>
      ) : (
        <form action={formAction} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Full name
            <Input name="fullName" maxLength={200} required />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block">Username</span>
            <Input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={64}
              pattern="[A-Za-z0-9._-]{3,64}"
              required
            />
            <span className="block text-xs text-muted-foreground">
              3-64 letters, numbers, periods, underscores, or hyphens. Uppercase
              letters are saved lowercase; spaces are not allowed.
            </span>
          </label>
          <label className="space-y-1 text-sm">
            Password (leave blank to generate one)
            <Input name="password" type="password" autoComplete="new-password" minLength={12} />
          </label>
          <label className="space-y-1 text-sm">
            Class
            <select
              name="classId"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>{classRecord.name}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            {state.error && <p role="alert" className="mb-2 text-sm text-destructive">{state.error}</p>}
            {state.message && <p role="status" className="mb-2 text-sm">{state.message}</p>}
            {state.generatedPassword && (
              <p className="mb-2 text-sm">
                Generated password (shown once): <code>{state.generatedPassword}</code>
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create teacher"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function TeacherAccountActions({
  classId,
  teacherId,
  active,
}: {
  classId: string;
  teacherId: string;
  active: boolean;
}) {
  const [resetState, resetAction, resetPending] = useActionState(
    resetTeacherPassword,
    initialState,
  );
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateTeacher,
    initialState,
  );

  return (
    <div className="space-y-2">
      <form action={resetAction}>
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="teacherId" value={teacherId} />
        <Button type="submit" variant="outline" disabled={resetPending || !active}>
          {resetPending ? "Resetting..." : "Reset password"}
        </Button>
      </form>
      {resetState.error && <p role="alert" className="text-xs text-destructive">{resetState.error}</p>}
      {resetState.generatedPassword && (
        <p role="status" className="text-xs">
          New password (shown once): <code>{resetState.generatedPassword}</code>
        </p>
      )}
      {active && (
        <form action={deactivateAction}>
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="teacherId" value={teacherId} />
          <Button
            type="submit"
            variant="outline"
            className="border-red-600 text-red-600 hover:bg-red-50"
            disabled={deactivatePending}
          >
            {deactivatePending ? "Deactivating..." : "Deactivate"}
          </Button>
          {deactivateState.error && (
            <p role="alert" className="text-xs text-destructive">{deactivateState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
