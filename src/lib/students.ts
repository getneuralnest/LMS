import { z } from "zod";

export const studentImportRequestSchema = z
  .object({
    class_id: z.string().uuid(),
    csv: z.string().min(1),
  })
  .strict();

const studentCsvRowSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty."),
    roll_no: z.string().trim().min(1, "Roll number cannot be empty."),
    uni_roll_no: z.string().trim().min(1, "University roll number cannot be empty."),
  })
  .strict();

export type StudentCsvRow = z.infer<typeof studentCsvRowSchema>;

export class StudentCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentCsvError";
  }
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  const input = csv.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (closedQuote) {
      if (character === "," || character === "\n" || character === "\r") {
        closedQuote = false;
      } else if (character.trim() === "") {
        continue;
      } else {
        throw new StudentCsvError("Unexpected character after a quoted CSV field.");
      }
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new StudentCsvError("Unexpected quote in an unquoted CSV field.");
      }
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new StudentCsvError("CSV contains an unterminated quoted field.");
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

export function parseStudentCsv(csv: string): StudentCsvRow[] {
  const rows = parseCsvRows(csv);
  const header = rows[0];

  if (
    !header ||
    header.length !== 3 ||
    header[0] !== "name" ||
    header[1] !== "roll_no" ||
    header[2] !== "uni_roll_no"
  ) {
    throw new StudentCsvError("CSV header must be exactly: name,roll_no,uni_roll_no.");
  }

  if (rows.length === 1) {
    throw new StudentCsvError("CSV must contain at least one student.");
  }
  if (rows.length - 1 > 200) {
    throw new StudentCsvError("CSV cannot contain more than 200 students.");
  }

  const seenRollNumbers = new Set<string>();
  const seenUniversityRollNumbers = new Set<string>();
  const students: StudentCsvRow[] = [];

  for (const [index, cells] of rows.slice(1).entries()) {
    if (cells.length !== 3) {
      throw new StudentCsvError(`Row ${index + 2} must contain exactly three columns.`);
    }

    const parsed = studentCsvRowSchema.safeParse({
      name: cells[0],
      roll_no: cells[1],
      uni_roll_no: cells[2],
    });
    if (!parsed.success) {
      throw new StudentCsvError(
        `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Invalid student row."}`,
      );
    }
    if (seenRollNumbers.has(parsed.data.roll_no)) {
      throw new StudentCsvError(`Duplicate roll_no in row ${index + 2}.`);
    }
    if (seenUniversityRollNumbers.has(parsed.data.uni_roll_no)) {
      throw new StudentCsvError(`Duplicate uni_roll_no in row ${index + 2}.`);
    }

    seenRollNumbers.add(parsed.data.roll_no);
    seenUniversityRollNumbers.add(parsed.data.uni_roll_no);
    students.push(parsed.data);
  }

  return students;
}

export function generateUsername(
  name: string,
  rollNo: string,
  existingUsernames: ReadonlySet<string> = new Set(),
): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  const namePart = firstWord.toLowerCase().replaceAll(".", "").replace(/[^a-z]/g, "");
  const digits = rollNo.match(/\d/g)?.join("") ?? "";

  if (!namePart || !digits) {
    throw new Error("A username requires letters in the name and digits in the roll number.");
  }

  const primary = `${namePart}${digits.slice(-2)}`;
  if (!existingUsernames.has(primary)) {
    return primary;
  }

  const fallback = `${namePart}${digits}`;
  if (!existingUsernames.has(fallback)) {
    return fallback;
  }
  throw new Error("Both generated usernames are already in use.");
}

const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
const TEMP_PASSWORD_LENGTH = 12;

export function generateTemporaryPassword(): string {
  const maxByte = Math.floor(256 / TEMP_PASSWORD_ALPHABET.length) * TEMP_PASSWORD_ALPHABET.length;
  let password = "";

  while (password.length < TEMP_PASSWORD_LENGTH) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(24));
    for (const byte of randomBytes) {
      if (byte < maxByte) {
        password += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length];
        if (password.length === TEMP_PASSWORD_LENGTH) {
          break;
        }
      }
    }
  }

  return password;
}
