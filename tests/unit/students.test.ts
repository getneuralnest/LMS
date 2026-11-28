import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  generateUsername,
  parseStudentCsv,
  StudentCsvError,
} from "../../src/lib/students";

describe("generateUsername", () => {
  it("removes non-ASCII letters from the full name and appends the full roll number", () => {
    expect(generateUsername("M.Umair Ali", "241124")).toBe("mumairali241124");
    expect(generateUsername("Syed M.Zubair Bukhari", "241132")).toBe(
      "syedmzubairbukhari241132",
    );
  });

  it("preserves leading zeroes in the roll number and rejects names without ASCII letters", () => {
    expect(generateUsername("Éva 2", "00124")).toBe("va00124");
    expect(() => generateUsername("123", "00124")).toThrow(
      "A username requires ASCII letters in the name and a roll number.",
    );
  });
});

describe("generateTemporaryPassword", () => {
  it("returns twelve characters without ambiguous characters", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%_-]+$/);
    expect(password).not.toMatch(/[0O1lI]/);
  });
});

describe("parseStudentCsv", () => {
  it("parses the three-column fixture and trims each field", async () => {
    const csv = await readFile(
      new URL("../fixtures/students-fixture.csv", import.meta.url),
      "utf8",
    );
    const students = parseStudentCsv(csv);

    expect(students).toHaveLength(3);
    expect(students[0]).toEqual({
      name: "Test Student Alpha",
      roll_no: "990001",
      uni_roll_no: "UNI-990001",
    });
    expect(students.filter((student) => student.name.startsWith("Test Student"))).toHaveLength(3);
  });

  it("rejects duplicated roll numbers and university roll numbers", () => {
    expect(() =>
      parseStudentCsv("name,roll_no,uni_roll_no\nA,123,UNI-A\nB,123,UNI-B"),
    ).toThrow("Duplicate roll_no");
    expect(() =>
      parseStudentCsv("name,roll_no,uni_roll_no\nA,123,UNI-A\nB,124,UNI-A"),
    ).toThrow("Duplicate uni_roll_no");
  });

  it("rejects empty names, extra columns, and more than 200 rows", () => {
    expect(() =>
      parseStudentCsv("name,roll_no,uni_roll_no\n ,123,UNI-A"),
    ).toThrow("Name cannot be empty.");
    expect(() =>
      parseStudentCsv("name,roll_no,uni_roll_no\nA,123,UNI-A,extra"),
    ).toThrow("exactly three columns");

    const rows = Array.from({ length: 201 }, (_, index) => `A${index},${index},UNI-${index}`);
    expect(() =>
      parseStudentCsv(`name,roll_no,uni_roll_no\n${rows.join("\n")}`),
    ).toThrow("more than 200");
  });

  it("rejects a header that is not exactly the required three columns", () => {
    expect(() =>
      parseStudentCsv("name,roll_no,extra\nA,123,UNI-A"),
    ).toThrow(StudentCsvError);
  });
});
