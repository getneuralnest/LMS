import { describe, expect, it } from "vitest";
import {
  loginFormSchema,
  passwordChangeFormSchema,
  teacherAccountSchema,
} from "../../src/lib/auth-schemas";

describe("loginFormSchema", () => {
  it("requires a username, password, and CAPTCHA token", () => {
    expect(
      loginFormSchema.safeParse({
        username: "teacher",
        password: "password",
        captchaToken: "turnstile-token",
      }).success,
    ).toBe(true);
    expect(
      loginFormSchema.safeParse({
        username: "teacher",
        password: "password",
        captchaToken: "",
      }).success,
    ).toBe(false);
  });

  it("rejects oversized login fields on the server", () => {
    expect(
      loginFormSchema.safeParse({
        username: "u".repeat(257),
        password: "password",
        captchaToken: "turnstile-token",
      }).success,
    ).toBe(false);
    expect(
      loginFormSchema.safeParse({
        username: "user",
        password: "p".repeat(1025),
        captchaToken: "turnstile-token",
      }).success,
    ).toBe(false);
  });
});

describe("passwordChangeFormSchema", () => {
  it("requires a longer new password different from the temporary password", () => {
    expect(
      passwordChangeFormSchema.safeParse({
        currentPassword: "temporary-password",
        password: "new-password-8",
        confirmPassword: "new-password-8",
        captchaToken: "turnstile-token",
      }).success,
    ).toBe(true);
    expect(
      passwordChangeFormSchema.safeParse({
        currentPassword: "temporary-password",
        password: "temporary-password",
        confirmPassword: "temporary-password",
        captchaToken: "turnstile-token",
      }).success,
    ).toBe(false);
  });
});

describe("teacherAccountSchema", () => {
  const validTeacher = {
    fullName: "Abdullah Khan",
    username: "abdullah",
    password: "",
    classId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("normalizes usernames to lowercase", () => {
    expect(
      teacherAccountSchema.parse({ ...validTeacher, username: "Abdullah" }).username,
    ).toBe("abdullah");
  });

  it("rejects spaces and explains the allowed username format", () => {
    const result = teacherAccountSchema.safeParse({
      ...validTeacher,
      username: "Abdullah Khan",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Username must be 3-64 characters",
      );
    }
  });
});
