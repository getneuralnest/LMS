"use client";

import {
  memo,
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ProfilerOnRenderCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  calculateAttendanceFine,
  type AttendanceStatus,
} from "../../../lib/attendance";
import { saveAttendanceBatch } from "./actions";

export type AttendanceRow = {
  id: string;
  studentId: string;
  fullName: string;
  rollNo: string;
  status: AttendanceStatus;
  locked: boolean;
};

type AttendanceTableProps = {
  classId: string;
  sessionId: string;
  rows: AttendanceRow[];
  endsAt: string;
  lateFine: number;
};

type AttendanceDiagnostics = {
  tableCommits: number;
  stateActions: string[];
  effects: string[];
  commits: Array<{ phase: string; actualDuration: number; cause: string }>;
  lastAction: string;
};

declare global {
  interface Window {
    __attendanceDiagnostics?: AttendanceDiagnostics;
  }
}

function traceDiagnostic(kind: "stateActions" | "effects", label: string) {
  if (typeof window === "undefined" || !window.__attendanceDiagnostics) return;
  window.__attendanceDiagnostics[kind].push(label);
  console.trace(`[Attendance diagnostic] ${kind}: ${label}`);
}

const recordTableCommit: ProfilerOnRenderCallback = (
  _id,
  phase,
  actualDuration,
) => {
  if (typeof window === "undefined" || !window.__attendanceDiagnostics) return;
  const diagnostics = window.__attendanceDiagnostics;
  diagnostics.tableCommits += 1;
  diagnostics.commits.push({
    phase,
    actualDuration,
    cause: diagnostics.lastAction,
  });
};

const attendanceColumns: ColumnDef<AttendanceRow>[] = [
  { accessorKey: "rollNo", header: "Roll number" },
  { accessorKey: "fullName", header: "Student" },
  { id: "status", header: "Attendance", accessorFn: () => null },
];

const statusOptions: Array<{
  status: Exclude<AttendanceStatus, null>;
  key: string;
  label: string;
}> = [
  { status: "present", key: "P", label: "Present" },
  { status: "absent", key: "A", label: "Absent" },
  { status: "late", key: "L", label: "Late" },
];

type AttendanceStudentRowProps = {
  studentId: string;
  name: string;
  rollNo: string;
  status: AttendanceStatus;
  locked: boolean;
  onStatusChange: (studentId: string, status: AttendanceStatus) => void;
};

const AttendanceStudentRow = memo(function AttendanceStudentRow({
  studentId,
  name,
  rollNo,
  status,
  locked,
  onStatusChange,
}: AttendanceStudentRowProps) {
  if (typeof window !== "undefined" && window.__attendanceDiagnostics) {
    console.count(`AttendanceStudentRow ${studentId}`);
  }

  const rowLocked = locked;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const pressed = statusOptions.find((option) => option.key === event.key.toUpperCase());
    if (pressed) {
      event.preventDefault();
      onStatusChange(studentId, pressed.status);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const currentRow = event.currentTarget.closest("tr");
    const targetRow = event.key === "ArrowUp"
      ? currentRow?.previousElementSibling
      : currentRow?.nextElementSibling;
    targetRow
      ?.querySelector<HTMLButtonElement>('[data-attendance-status="present"]')
      ?.focus();
  }

  return (
    <TableRow>
      <TableCell>{rollNo}</TableCell>
      <TableCell>{name}</TableCell>
      <TableCell>
        <div
          role="group"
          aria-label={`Attendance for ${name}`}
          className="flex items-center gap-1"
          onKeyDown={handleKeyDown}
        >
          {statusOptions.map((option) => (
            <Button
              key={option.status}
              type="button"
              variant={status === option.status ? "default" : "outline"}
              className="h-8 min-w-8 px-2"
              aria-label={`Mark ${name} ${option.label}`}
              aria-pressed={status === option.status}
              title={option.label}
              data-attendance-status={option.status}
              disabled={rowLocked}
              onClick={() => onStatusChange(studentId, option.status)}
            >
              {option.key}
            </Button>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
});

type AttendanceState = {
  statuses: Map<string, AttendanceStatus>;
  persistedStatuses: Map<string, AttendanceStatus>;
  savePhase: "idle" | "saving" | "saved" | "error";
  error: string | null;
  message: string | null;
};

type AttendanceAction =
  | { type: "set-status"; studentId: string; status: AttendanceStatus }
  | { type: "set-many"; statuses: Array<[string, AttendanceStatus]> }
  | { type: "save-start" }
  | { type: "save-error"; error: string }
  | {
      type: "save-success";
      statuses: Map<string, AttendanceStatus>;
      message: string;
    };

function attendanceReducer(
  state: AttendanceState,
  action: AttendanceAction,
): AttendanceState {
  if (action.type === "save-error") {
    return { ...state, savePhase: "error", error: action.error, message: null };
  }
  if (action.type === "save-start") {
    return { ...state, savePhase: "saving", error: null, message: null };
  }
  if (action.type === "save-success") {
    return {
      ...state,
      persistedStatuses: new Map(action.statuses),
      savePhase: "saved",
      error: null,
      message: action.message,
    };
  }

  const statuses = new Map(state.statuses);
  if (action.type === "set-status") {
    if (statuses.get(action.studentId) === action.status) return state;
    statuses.set(action.studentId, action.status);
  } else {
    let changed = false;
    for (const [studentId, status] of action.statuses) {
      if (statuses.get(studentId) === status) continue;
      statuses.set(studentId, status);
      changed = true;
    }
    if (!changed) return state;
  }
  return { ...state, statuses, savePhase: "idle", error: null, message: null };
}

function initialAttendanceState(rows: AttendanceRow[]): AttendanceState {
  const statuses = new Map(rows.map((row) => [row.studentId, row.status]));
  return {
    statuses,
    persistedStatuses: new Map(statuses),
    savePhase: "idle",
    error: null,
    message: null,
  };
}

export function AttendanceTable({
  classId,
  sessionId,
  rows,
  endsAt,
  lateFine,
}: AttendanceTableProps) {
  "use no memo";

  const [state, rawDispatch] = useReducer(
    attendanceReducer,
    rows,
    initialAttendanceState,
  );
  const [sessionEnded, setSessionEnded] = useState(() => Date.now() >= Date.parse(endsAt));
  const lockRefreshRequested = useRef(false);
  const router = useRouter();
  const pending = state.savePhase === "saving";

  const dispatch = useCallback((action: AttendanceAction) => {
    const label = action.type === "set-status"
      ? `${action.type}:${action.studentId}:${action.status}`
      : action.type;
    traceDiagnostic("stateActions", label);
    if (typeof window !== "undefined" && window.__attendanceDiagnostics) {
      window.__attendanceDiagnostics.lastAction = label;
    }
    rawDispatch(action);
  }, []);

  const updates = useMemo(
    () =>
      rows.flatMap((row) => {
        const status = state.statuses.get(row.studentId) ?? null;
        return status === state.persistedStatuses.get(row.studentId)
          ? []
          : [{ attendanceId: row.id, status }];
      }),
    [rows, state.persistedStatuses, state.statuses],
  );
  const hasUnsavedChanges = updates.length > 0;
  const markedCount = useMemo(
    () =>
      sessionEnded
        ? rows.length
        : rows.reduce(
            (count, row) => count + (state.statuses.get(row.studentId) === null ? 0 : 1),
            0,
          ),
    [rows, sessionEnded, state.statuses],
  );
  const unmarkedCount = rows.length - markedCount;

  useEffect(() => {
    traceDiagnostic("effects", "session end timer");
    if (sessionEnded) return;
    const delay = Math.max(0, Date.parse(endsAt) - Date.now());
    const timer = window.setTimeout(() => {
      traceDiagnostic("stateActions", "set-session-ended:true");
      setSessionEnded(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [endsAt, sessionEnded]);

  useEffect(() => {
    traceDiagnostic("effects", "refresh finalized attendance");
    if (!sessionEnded || rows.every((row) => row.locked) || lockRefreshRequested.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      lockRefreshRequested.current = true;
      router.refresh();
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [router, rows, sessionEnded]);

  useEffect(() => {
    traceDiagnostic("effects", "warn about unsaved attendance");
    if (!hasUnsavedChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (window.confirm("You have unsaved attendance changes. Leave without saving?")) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [hasUnsavedChanges]);

  const onStatusChange = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      dispatch({ type: "set-status", studentId, status });
    },
    [dispatch],
  );

  function markAllPresent() {
    dispatch({
      type: "set-many",
      statuses: rows
        .filter((row) => !row.locked)
        .map((row) => [row.studentId, "present"]),
    });
  }

  function markRemainingAbsent() {
    const updates = rows.flatMap((row) =>
      !row.locked && state.statuses.get(row.studentId) === null
        ? [[row.studentId, "absent"] as [string, AttendanceStatus]]
        : [],
    );
    if (updates.length > 0) dispatch({ type: "set-many", statuses: updates });
  }

  async function saveAction(formData: FormData) {
    const savedStatuses = new Map(state.statuses);
    dispatch({ type: "save-start" });
    try {
      const result = await saveAttendanceBatch(formData);
      if (result.error) {
        dispatch({ type: "save-error", error: result.error });
        return;
      }

      dispatch({
        type: "save-success",
        statuses: savedStatuses,
        message: result.message ?? "Attendance saved.",
      });
      router.refresh();
    } catch (saveError) {
      console.error("Could not save attendance.", saveError);
      dispatch({
        type: "save-error",
        error: "Could not save attendance. Check that the session is still open and try again.",
      });
    }
  }

  // TanStack Table exposes mutable instance methods, so keep it outside compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: attendanceColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  const fineForLate = calculateAttendanceFine("late", lateFine);

  return (
    <Profiler id="attendance-table" onRender={recordTableCommit}>
      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {fineForLate > 0
            ? `Late fine: ${fineForLate.toFixed(2)}`
            : "No late fine for this session."}
          {" "}Use P/A/L to mark a row and the arrow keys to move between students.
        </p>
        {sessionEnded && (
          <p role="status" className="text-sm text-muted-foreground">
            This session has ended. Attendance is locked.
          </p>
        )}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state.message && <p role="status" className="text-sm">{state.message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={sessionEnded || pending || rows.length === 0 || rows.every((row) => row.locked)}
              onClick={markAllPresent}
            >
              Mark all Present
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={sessionEnded || pending || unmarkedCount === 0}
              onClick={markRemainingAbsent}
            >
              Mark remaining Absent
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {markedCount} marked, {unmarkedCount} unmarked
          </p>
        </div>
        {rows.length > 0 && (
          <form action={saveAction} className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify({ classId, sessionId, updates })}
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pending
                ? "Saving attendance..."
                : hasUnsavedChanges
                  ? `${updates.length} unsaved changes.`
                  : "All changes saved."}
            </p>
            <Button
              type="submit"
              disabled={!hasUnsavedChanges || pending || sessionEnded}
              aria-busy={pending}
            >
              Save attendance
            </Button>
          </form>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map(({ original: row }) => (
              <AttendanceStudentRow
                key={row.studentId}
                studentId={row.studentId}
                name={row.fullName}
                rollNo={row.rollNo}
                status={
                  sessionEnded && state.statuses.get(row.studentId) === null
                    ? "absent"
                    : state.statuses.get(row.studentId) ?? null
                }
                locked={row.locked || sessionEnded || pending}
                onStatusChange={onStatusChange}
              />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell className="py-6 text-center text-muted-foreground" colSpan={3}>
                  No student attendance records are available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </Profiler>
  );
}
