import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  generateUsername,
  parseStudentCsv,
  StudentCsvError,
} from "../../src/lib/students";

describe("generateUsername", () => {
  it("strips dots from the first name word and appends the last two roll digits", () => {
    expect(generateUsername("M.Umair Ali", "241124")).toBe("mumair24");
    expect(generateUsername("Syed M.Zubair Bukhari", "241132")).toBe("syed32");
  });

  it("creates distinct usernames for students with the same first name", () => {
    expect(generateUsername("Aman Fatima", "241117")).toBe("aman17");
    expect(generateUsername("Aman Ahmed", "241143")).toBe("aman43");
  });

  it("uses the full roll number when the short username is already taken", () => {
    expect(generateUsername("Aman Fatima", "241117", new Set(["aman17"]))).toBe(
      "aman241117",
    );
    expect(() =>
      generateUsername("Aman Fatima", "241117", new Set(["aman17", "aman241117"])),
    ).toThrow("Both generated usernames are already in use.");
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

    expect(students).toHaveLength(4);
    expect(students[0]).toEqual({
      name: "M.Umair Ali",
      roll_no: "241124",
      uni_roll_no: "UNI-241124",
    });
    expect(students.filter((student) => student.name.startsWith("Aman"))).toHaveLength(2);
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
