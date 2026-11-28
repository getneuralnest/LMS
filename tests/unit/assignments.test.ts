import { describe, expect, it } from "vitest";
import {
  assignmentDueAt,
  assignmentSchema,
  gradeSchema,
  submissionLinkSchema,
} from "../../src/lib/assignments";

const assignment = {
  class_id: "013967bc-0f51-44d4-8e92-587188f3feef",
  kind: "assignment",
  title: "Research summary",
  description: "Summarize the reading.",
  due_at: "2026-12-10T09:30",
  timezone_offset: -300,
  max_marks: "25",
  submission_type: "either",
  submission_mode: "hard",
};

describe("assignment schemas", () => {
  it("validates assignment fields and converts local time using the browser offset", () => {
    const parsed = assignmentSchema.parse(assignment);
    expect(assignmentDueAt(parsed)).toBe("2026-12-10T04:30:00.000Z");
  });

  it("rejects impossible dates and invalid assignment types", () => {
    expect(
      assignmentSchema.safeParse({ ...assignment, due_at: "2026-02-30T09:30" }).success,
    ).toBe(false);
    expect(
      assignmentSchema.safeParse({ ...assignment, kind: "quiz" }).success,
    ).toBe(false);
  });

  it("allows only http and https submission links", () => {
    expect(submissionLinkSchema.safeParse("https://example.org/work").success).toBe(true);
    expect(submissionLinkSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(submissionLinkSchema.safeParse("file:///etc/passwd").success).toBe(false);
  });

  it("validates grade bounds and feedback length", () => {
    const validGrade = {
      submission_id: "d3d2c119-eef8-43df-bb26-d12f2046c315",
      marks: "18.5",
      feedback: "Clear and complete.",
    };
    expect(gradeSchema.safeParse(validGrade).success).toBe(true);
    expect(gradeSchema.safeParse({ ...validGrade, marks: "-1" }).success).toBe(false);
  });
});
