import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const genericLoginError =
  "Unable to sign in. Check your username and password and try again.";
const newPassword = "New-Student-Password-8!";

async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("", {
    timeout: 45_000,
  });
}

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function confirmationLink(request: APIRequestContext, email: string): Promise<string> {
  const mailpitUrl = "http://127.0.0.1:54324/api/v1";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const listResponse = await request.get(`${mailpitUrl}/messages?limit=50`);
    if (listResponse.ok()) {
      const { messages } = await listResponse.json() as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      const message = messages.find((item) =>
        item.To.some((recipient) => recipient.Address === email),
      );
      if (message) {
        const detailResponse = await request.get(`${mailpitUrl}/message/${message.ID}`);
        if (detailResponse.ok()) {
          const detail = await detailResponse.json() as { Text?: string; HTML?: string };
          const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`.replaceAll("&amp;", "&");
          const link = body.match(/https?:\/\/[^"'<> \r\n]+/)?.[0];
          if (link) return link;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Confirmation email did not arrive in local Mailpit.");
}

test("students claim their account, get recurring email reminders, and confirm through Mailpit", async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
  if (!teacherPassword) throw new Error("E2E_TEACHER_PASSWORD is required.");

  await signIn(page, "e2eteacher", teacherPassword);
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 15_000 });
  await page.goto("/teacher/students");
  const suffix = randomInt(10_000_000, 99_999_999).toString();
  const csv = (await readFile("tests/fixtures/students-fixture.csv", "utf8"))
    .split(/\r?\n/)
    .map((line, index) => {
      if (index === 0 || !line) return line;
      const [name] = line.split(",");
      const rollNumber = `99000${index}${suffix}`;
      return `${name} ${suffix},${rollNumber},UNI-${rollNumber}`;
    })
    .join("\n");
  const studentUsername = `teststudentalpha990001${suffix}`;
  await page.locator('input[name="csv"]').setInputFiles({
    name: "students-fixture.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await expect(page.getByText("3 created, 0 skipped, 0 failed.")).toBeVisible();
  await expect(page.getByText(studentUsername, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Download credentials/ })).toHaveCount(0);

  const email = `student-${randomUUID()}@example.net`;
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await signIn(studentPage, studentUsername, studentUsername);
  await expect(studentPage).toHaveURL("/");
  await expect(studentPage.getByRole("dialog", { name: "Set up your account" })).toBeVisible();
  await studentPage.getByLabel("Email address").fill(email);
  await studentPage.getByLabel("New password", { exact: true }).fill(newPassword);
  await studentPage.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await studentPage.getByRole("button", { name: "Continue" }).click();
  await expect(studentPage).toHaveURL(/\/student\?emailReminder=1$/);
  await expect(studentPage.getByRole("dialog", { name: "Confirm your email" })).toBeVisible();

  await studentPage.getByRole("button", { name: "Continue" }).click();
  await expect(studentPage.getByRole("dialog")).toHaveCount(0);
  await studentPage.getByRole("button", { name: "Sign out" }).click();
  await expect(studentPage).toHaveURL("/login");
  await signIn(studentPage, studentUsername, newPassword);
  await expect(studentPage).toHaveURL(/\/student\?emailReminder=1$/);
  await expect(studentPage.getByRole("dialog", { name: "Confirm your email" })).toBeVisible();

  const link = await confirmationLink(request, email);
  await studentPage.goto(link);
  await expect(studentPage).toHaveURL(/\/student$/);
  await expect(studentPage.getByRole("dialog")).toHaveCount(0);

  await studentPage.goto("/teacher/students");
  await expect(studentPage).toHaveURL("/");

  const oldPasswordContext = await browser.newContext();
  const oldPasswordPage = await oldPasswordContext.newPage();
  await signIn(oldPasswordPage, studentUsername, studentUsername);
  await expect(oldPasswordPage.getByText(genericLoginError, { exact: true })).toBeVisible();

  await studentContext.close();
  await oldPasswordContext.close();
});

test("wrong username and wrong password return the same generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("not-a-real-user");
  await page.getByLabel("Password").fill("Invalid-password-8");
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(genericLoginError, { exact: true })).toBeVisible();

  await expect(page.locator('input[name="captchaToken"]')).toHaveValue("");
  await page.getByLabel("Username").fill("e2eteacher");
  await page.getByLabel("Password").fill("Wrong-password-8");
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(genericLoginError, { exact: true })).toBeVisible();
});
