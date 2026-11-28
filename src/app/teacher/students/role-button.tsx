"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import {
  resetStudentPassword,
  setStudentRoleToCr,
  type StudentResetState,
  type StudentRoleState,
} from "./actions";

const initialState: StudentRoleState = { message: null, error: null };
const initialResetState: StudentResetState = { message: null, error: null };

export function SetCrRoleButton({
  classId,
  studentId,
}: {
  classId: string;
  studentId: string;
}) {
  const [state, formAction, pending] = useActionState(setStudentRoleToCr, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Updating..." : "Set as CR"}
      </Button>
      {state.message && <span role="status" className="text-sm text-muted-foreground">{state.message}</span>}
      {state.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}

export function ResetStudentPasswordButton({
  classId,
  studentId,
}: {
  classId: string;
  studentId: string;
}) {
  const [state, formAction, pending] = useActionState(resetStudentPassword, initialResetState);

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="classId" value={classId} />
        <input type="hidden" name="studentId" value={studentId} />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Resetting..." : "Reset password"}
        </Button>
      </form>
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
      {state.message && <p role="status" className="text-xs">{state.message}</p>}
      {state.generatedPassword && (
        <p className="text-xs">Temporary password (shown once): <code>{state.generatedPassword}</code></p>
      )}
    </div>
  );
}
