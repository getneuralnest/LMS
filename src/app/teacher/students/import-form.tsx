"use client";

import { useActionState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  uploadStudents,
  type StudentImportState,
} from "./actions";

const initialState: StudentImportState = { error: null, result: null };

export function ImportStudentsForm({ classId }: { classId: string }) {
  const [state, formAction, pending] = useActionState(uploadStudents, initialState);
  const result = state.result;
  const rows = result
    ? [
        ...result.created.map((row) => ({ ...row, status: "Created" })),
        ...result.skipped.map((row) => ({ ...row, status: "Skipped" })),
        ...result.failed.map((row) => ({ ...row, status: "Failed" })),
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import students</CardTitle>
          <CardDescription>
            Upload a CSV with the exact header name,roll_no,uni_roll_no. Initial passwords match
            each generated username; students must set a new password at first sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="class_id" value={classId} />
            <div className="flex-1 space-y-2">
              <label htmlFor="csv" className="text-sm font-medium">Student CSV</label>
              <Input id="csv" name="csv" type="file" accept=".csv,text/csv" required />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Importing..." : "Upload CSV"}
            </Button>
          </form>
          {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
            <CardDescription>
              {result.created.length} created, {result.skipped.length} skipped,{" "}
              {result.failed.length} failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll number</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${row.status}-${row.roll_no}-${index}`}>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.roll_no}</TableCell>
                    <TableCell>{row.username ?? "—"}</TableCell>
                    <TableCell>{row.reason ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
