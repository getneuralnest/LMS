import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_EMAIL_DOMAIN = "students.example.com";

export const studentImportRequestSchema = z
  .object({
    class_id: z.string().uuid(),
    csv: z.string().min(1).max(1_000_000),
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
): string {
  const namePart = name.toLowerCase().replace(/[^a-z]/g, "");
  const rollPart = rollNo.trim();

  if (!namePart || !rollPart) {
    throw new Error("A username requires ASCII letters in the name and a roll number.");
  }

  return `${namePart}${rollPart}`;
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

export type StudentImportRowResult = {
  name: string;
  roll_no: string;
  username?: string;
  reason?: string;
};

export type StudentImportResult = {
  created: StudentImportRowResult[];
  skipped: StudentImportRowResult[];
  failed: StudentImportRowResult[];
};

export async function createStudentAccounts(
  adminClient: SupabaseClient,
  classId: string,
  students: StudentCsvRow[],
  actorId?: string,
): Promise<StudentImportResult> {
  const { data: classMembers, error: classMembersError } = await adminClient
    .from("class_members")
    .select("roll_no")
    .eq("class_id", classId)
    .not("roll_no", "is", null);

  if (classMembersError) {
    throw new Error("Could not read class student records.");
  }

  const existingRollNumbers = new Set(
    classMembers.map((member) => member.roll_no).filter((value): value is string => !!value),
  );
  const result: StudentImportResult = { created: [], skipped: [], failed: [] };

  for (const student of students) {
    if (existingRollNumbers.has(student.roll_no)) {
      result.skipped.push({
        name: student.name,
        roll_no: student.roll_no,
        reason: "Roll number already exists in this class.",
      });
      continue;
    }

    let userId: string | null = null;
    try {
      const username = generateUsername(student.name, student.roll_no);
      const { data: usernameMatch, error: usernameError } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (usernameError) {
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Could not check username availability.",
        });
        continue;
      }
      if (usernameMatch) {
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Generated username is already in use.",
        });
        continue;
      }

      const { data: createdUser, error: createUserError } =
        await adminClient.auth.admin.createUser({
          email: `${username}@${AUTH_EMAIL_DOMAIN}`,
          password: username,
          email_confirm: true,
          app_metadata: { must_change_password: true },
          user_metadata: { full_name: student.name },
        });

      if (createUserError || !createdUser.user) {
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Could not create the student account.",
        });
        continue;
      }

      userId = createdUser.user.id;
      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        full_name: student.name,
        username,
        roll_no: student.roll_no,
        uni_roll_no: student.uni_roll_no,
      });
      const { error: membershipError } = profileError
        ? { error: profileError }
        : await adminClient.from("class_members").insert({
            class_id: classId,
            user_id: userId,
            role: "student",
            roll_no: student.roll_no,
            uni_roll_no: student.uni_roll_no,
          });

      if (membershipError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: cleanupError
            ? "Student insert failed and account cleanup could not be completed."
            : "Could not save student records; the temporary account was removed.",
        });
        userId = null;
        continue;
      }

      const { error: auditError } = await adminClient.from("account_audit_log").insert({
        class_id: classId,
        actor: actorId ?? null,
        target_user_id: userId,
        action: "student_created",
      });
      if (auditError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: cleanupError
            ? "Student audit record failed and account cleanup could not be completed."
            : "Could not record account creation; the account was removed.",
        });
        userId = null;
        continue;
      }

      userId = null;
      existingRollNumbers.add(student.roll_no);
      result.created.push({ name: student.name, roll_no: student.roll_no, username });
    } catch {
      if (userId) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: cleanupError
            ? "Student creation failed and account cleanup could not be completed."
            : "Could not create the student account; the account was removed.",
        });
      } else {
        result.failed.push({
          name: student.name,
          roll_no: student.roll_no,
          reason: "Could not create the student account.",
        });
      }
    }
  }

  return result;
}
