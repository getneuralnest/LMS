import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const genericLoginError =
  "Unable to sign in. Check your username and password and try again.";
const newPassword = "New-Student-Password-8!";

async function waitForCaptcha(page: import("@playwright/test").Page) {
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("", {
    timeout: 45_000,
  });
}

async function signIn(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function uploadStudentsAndDownloadCredentials(
  page: import("@playwright/test").Page,
): Promise<{ username: string; tempPassword: string }> {
  await page.goto("/teacher/students");
  const csv = await readFile("tests/fixtures/students-fixture.csv");
  await page.locator('input[name="csv"]').setInputFiles({
    name: "students-fixture.csv",
    mimeType: "text/csv",
    buffer: csv,
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await expect(page.getByText("4 created, 0 skipped, 0 failed.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download credentials CSV" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Credentials download did not produce a file.");
  }

  const [headerLine, credentialLine] = (await readFile(downloadPath, "utf8"))
    .trim()
    .split(/\r?\n/);
  const header = headerLine.split(",");
  const values = credentialLine.split(",");
  const credentials = Object.fromEntries(header.map((key, index) => [key, values[index]]));

  expect(credentials.username).toBe("mumair24");
  expect(credentials.temp_password).toBeTruthy();
  return {
    username: credentials.username,
    tempPassword: credentials.temp_password,
  };
}

test("teacher imports students and a student is forced to change the temporary password", async ({
  browser,
  page,
}) => {
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
  if (!teacherPassword) {
    throw new Error("E2E_TEACHER_PASSWORD is required.");
  }

  await signIn(page, "teacher", teacherPassword);
  await expect(page).toHaveURL("/");
  const credentials = await uploadStudentsAndDownloadCredentials(page);

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await signIn(studentPage, credentials.username, credentials.tempPassword);
  await expect(studentPage).toHaveURL(/\/change-password$/);

  await studentPage.goto("/teacher/students");
  await expect(studentPage).toHaveURL(/\/change-password$/);

  await studentPage.getByLabel("Temporary password").fill(credentials.tempPassword);
  await studentPage.getByLabel("New password").fill(newPassword);
  await studentPage.getByLabel("Confirm new password").fill(newPassword);
  await waitForCaptcha(studentPage);
  await studentPage.getByRole("button", { name: "Update password" }).click();
  await expect(studentPage).toHaveURL("/");

  await studentPage.goto("/teacher/students");
  await expect(studentPage).toHaveURL("/");

  const oldPasswordContext = await browser.newContext();
  const oldPasswordPage = await oldPasswordContext.newPage();
  await signIn(oldPasswordPage, credentials.username, credentials.tempPassword);
  await expect(oldPasswordPage.getByRole("alert")).toHaveText(genericLoginError);

  const newPasswordContext = await browser.newContext();
  const newPasswordPage = await newPasswordContext.newPage();
  await signIn(newPasswordPage, credentials.username, newPassword);
  await expect(newPasswordPage).toHaveURL("/");

  await studentContext.close();
  await oldPasswordContext.close();
  await newPasswordContext.close();
});

test("wrong username and wrong password return the same generic message", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("not-a-real-user");
  await page.getByLabel("Password").fill("Invalid-password-8");
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText(genericLoginError);

  await expect(page.locator('input[name="captchaToken"]')).toHaveValue("");
  await page.getByLabel("Username").fill("teacher");
  await page.getByLabel("Password").fill("Wrong-password-8");
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText(genericLoginError);
});
