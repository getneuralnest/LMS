import { describe, expect, it } from "vitest";
import { calculateStudentDue, ledgerEntrySchema } from "../../src/lib/ledger";

describe("ledgerEntrySchema", () => {
  const validEntry = {
    class_id: "550e8400-e29b-41d4-a716-446655440000",
    type: "collection",
    amount: "12.5",
    note: "Class materials",
    student_id: null,
  };

  it("accepts collections, expenses, and linked fine payments but never direct fines", () => {
    expect(ledgerEntrySchema.safeParse(validEntry).success).toBe(true);
    expect(
      ledgerEntrySchema.safeParse({ ...validEntry, type: "expense" }).success,
    ).toBe(true);
    expect(
      ledgerEntrySchema.safeParse({ ...validEntry, type: "fine" }).success,
    ).toBe(false);
    expect(
      ledgerEntrySchema.safeParse({
        ...validEntry,
        type: "fine_payment",
        student_id: "550e8400-e29b-41d4-a716-446655440001",
      }).success,
    ).toBe(true);
    expect(
      ledgerEntrySchema.safeParse({ ...validEntry, type: "fine_payment" }).success,
    ).toBe(false);
  });

  it("rejects non-positive amounts and student-linked expenses", () => {
    expect(
      ledgerEntrySchema.safeParse({ ...validEntry, amount: "0" }).success,
    ).toBe(false);
    expect(
      ledgerEntrySchema.safeParse({
        ...validEntry,
        type: "expense",
        student_id: "550e8400-e29b-41d4-a716-446655440001",
      }).success,
    ).toBe(false);
  });
});

describe("calculateStudentDue", () => {
  it("subtracts fine payments from fines and floors due at zero", () => {
    expect(
      calculateStudentDue([
        { type: "fine", amount: "10.00" },
        { type: "fine", amount: 5 },
        { type: "fine_payment", amount: "4.50" },
      ]),
    ).toBe(10.5);
    expect(
      calculateStudentDue([
        { type: "fine", amount: 5 },
        { type: "fine_payment", amount: 8 },
      ]),
    ).toBe(0);
  });
});
