import { describe, expect, it } from "vitest";
import {
  loginFormSchema,
  passwordChangeFormSchema,
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
