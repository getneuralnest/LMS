import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createIsolatedClass, createLocalAdminClient } from "./helpers";

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

async function localDateTimeValue(page: Page, offsetMs: number): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date(Date.now() + offset);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }, offsetMs);
}

test("teacher creates assignments, students submit files and links, and teacher grades work", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
  if (!teacherPassword) throw new Error("E2E_TEACHER_PASSWORD is required.");
  const suffix = randomInt(10_000_000, 99_999_999).toString();
  const classId = await createIsolatedClass(`Assignments E2E ${suffix}`);
  const admin = createLocalAdminClient();
  const fullName = `Submission Student ${suffix}`;
  const username = `submissionstudent${suffix}`;
  const studentPassword = `Student-${randomUUID()}-8!Aa`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@students.example.com`,
    password: studentPassword,
    email_confirm: true,
    app_metadata: { must_change_password: false },
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) throw new Error("Could not create the E2E submission student.");

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    username,
    roll_no: `SUB${suffix}`,
  });
  if (profileError) throw new Error("Could not create the E2E student profile.");
  const { error: membershipError } = await admin.from("class_members").insert({
    class_id: classId,
    user_id: created.user.id,
    role: "student",
    roll_no: `SUB${suffix}`,
    uni_roll_no: `UNI-SUB${suffix}`,
  });
  if (membershipError) throw new Error("Could not add the E2E student to the test class.");

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  try {
    await signIn(page, "e2eteacher", teacherPassword);
    await expect(page).toHaveURL(/\/teacher$/, { timeout: 15_000 });
    await page.goto(`/teacher/assignments?class_id=${classId}`);
    await expect(page.getByRole("heading", { name: "Assignments", exact: true })).toBeVisible();
    const createForm = page
      .getByRole("button", { name: "Create assignment" })
      .locator("xpath=ancestor::form");
    const fileTitle = `Hard file assignment ${suffix}`;
    const linkTitle = `Soft link assignment ${suffix}`;
    await createForm.getByLabel("Title").fill(fileTitle);
    await createForm
      .getByLabel("Due date and time")
      .fill(await localDateTimeValue(page, 60 * 60_000));
    await createForm.getByLabel("Accepted submission").selectOption("file");
    await createForm.getByLabel("Deadline mode").selectOption("hard");
    await page.getByRole("button", { name: "Create assignment" }).click();
    await expect(page.getByText("Assignment created.", { exact: true })).toBeVisible();

    await createForm.getByLabel("Title").fill(linkTitle);
    await createForm
      .getByLabel("Due date and time")
      .fill(await localDateTimeValue(page, -60 * 60_000));
    await createForm.getByLabel("Accepted submission").selectOption("link");
    await createForm.getByLabel("Deadline mode").selectOption("soft");
    await page.getByRole("button", { name: "Create assignment" }).click();
    await expect(page.getByText("Assignment created.", { exact: true }).last()).toBeVisible();

    await signIn(studentPage, username, studentPassword);
    await expect(studentPage).toHaveURL("/student", { timeout: 15_000 });
    const fileAssignment = studentPage
      .locator("article")
      .filter({ has: studentPage.getByRole("heading", { name: fileTitle }) });
    const linkAssignment = studentPage
      .locator("article")
      .filter({ has: studentPage.getByRole("heading", { name: linkTitle }) });
    await expect(fileAssignment).toBeVisible();
    await expect(linkAssignment).toBeVisible();

    await fileAssignment.locator('input[name="file"]').setInputFiles({
      name: "submission.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nE2E submission\n"),
    });
    await fileAssignment.getByRole("button", { name: "Submit work" }).click();
    await expect(fileAssignment.getByText("Submission saved.", { exact: true })).toBeVisible();

    await expect(linkAssignment.getByText("Overdue", { exact: true })).toBeVisible();
    await linkAssignment.getByLabel("Link").fill("https://example.test/submission");
    await linkAssignment.getByRole("button", { name: "Submit work" }).click();
    await expect(linkAssignment.getByText("Submission saved.", { exact: true })).toBeVisible();
    await expect(linkAssignment.getByText("Submitted late.", { exact: true })).toBeVisible();

    await page.goto(`/teacher/assignments?class_id=${classId}`);
    await expect(page.getByRole("link", { name: "Open submitted file" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open submitted link" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    for (const [marks, feedback] of [
      ["90", "Good work."],
      ["95", "Clear and complete."],
    ]) {
      const gradeForm = page.getByRole("form", { name: `Grade ${fullName}` }).nth(
        marks === "90" ? 0 : 1,
      );
      await gradeForm.getByLabel(/Marks/).fill(marks);
      await gradeForm.getByLabel("Feedback").fill(feedback);
      await gradeForm.getByRole("button", { name: "Save grade" }).click();
      await expect(gradeForm.getByText("Grade saved.", { exact: true })).toBeVisible();
    }

    await studentPage.reload();
    await expect(studentPage.getByText("Marks: 90", { exact: true })).toBeVisible();
    await expect(studentPage.getByText("Marks: 95", { exact: true })).toBeVisible();
    await expect(fileAssignment.getByRole("link", { name: "Open submitted file" }))
      .toHaveAttribute("rel", "noopener noreferrer");
  } finally {
    await studentContext.close();
    const { data: submissions } = await admin
      .from("submissions")
      .select("file_path")
      .eq("student_id", created.user.id);
    const paths = submissions?.flatMap((submission) => submission.file_path ? [submission.file_path] : []);
    if (paths?.length) {
      const { error: storageError } = await admin.storage
        .from("submissions")
        .remove(paths);
      if (storageError) throw new Error("Could not remove the E2E submission files.");
    }
    const { error: classCleanupError } = await admin
      .from("classes")
      .delete()
      .eq("id", classId);
    if (classCleanupError) throw new Error("Could not remove the E2E class.");
    const { error: userCleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    if (userCleanupError) throw new Error("Could not remove the E2E student account.");
  }
});
