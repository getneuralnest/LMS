import { describe, expect, it } from "vitest";
import {
  attendanceBatchSchema,
  attendanceSessionSchema,
  calculateAttendanceFine,
} from "../../src/lib/attendance";

describe("attendanceSessionSchema", () => {
  const validSession = {
    class_id: "550e8400-e29b-41d4-a716-446655440000",
    subject: "Mathematics",
    starts_at: "2026-11-27T09:00:00.000Z",
    ends_at: "2026-11-27T10:00:00.000Z",
    late_fine: "5",
  };

  it("accepts valid sessions and rejects an end time before the start", () => {
    expect(attendanceSessionSchema.safeParse(validSession).success).toBe(true);
    expect(
      attendanceSessionSchema.safeParse({
        ...validSession,
        ends_at: "2026-11-27T08:59:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed or negative late fines", () => {
    expect(
      attendanceSessionSchema.safeParse({ ...validSession, late_fine: "-1" }).success,
    ).toBe(false);
    expect(
      attendanceSessionSchema.safeParse({ ...validSession, late_fine: "not-a-number" })
        .success,
    ).toBe(false);
  });
});

describe("attendanceBatchSchema", () => {
  const update = {
    attendanceId: "550e8400-e29b-41d4-a716-446655440001",
    status: "present",
  };
  const batch = {
    classId: "550e8400-e29b-41d4-a716-446655440000",
    sessionId: "550e8400-e29b-41d4-a716-446655440002",
    updates: [update],
  };

  it("accepts batches and rejects unknown statuses", () => {
    expect(attendanceBatchSchema.safeParse(batch).success).toBe(true);
    expect(
      attendanceBatchSchema.safeParse({
        ...batch,
        updates: [{ ...update, status: "excused" }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one update and rejects unexpected fields", () => {
    expect(
      attendanceBatchSchema.safeParse({ ...batch, updates: [] }).success,
    ).toBe(false);
    expect(
      attendanceBatchSchema.safeParse({
        ...batch,
        updates: [{ ...update, studentId: "untrusted" }],
      }).success,
    ).toBe(false);
  });

  it("accepts clearing a draft status", () => {
    expect(
      attendanceBatchSchema.safeParse({
        ...batch,
        updates: [{ ...update, status: null }],
      }).success,
    ).toBe(true);
  });
});

describe("calculateAttendanceFine", () => {
  it("applies the configured fine only to late attendance", () => {
    expect(calculateAttendanceFine("late", 5.5)).toBe(5.5);
    expect(calculateAttendanceFine("present", 5.5)).toBe(0);
    expect(calculateAttendanceFine(null, 5.5)).toBe(0);
  });
});
