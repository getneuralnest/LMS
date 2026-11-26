"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { setStudentRoleToCr, type StudentRoleState } from "./actions";

const initialState: StudentRoleState = { message: null, error: null };

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
