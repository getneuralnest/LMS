import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createIsolatedClass } from "./helpers";

async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("", {
    timeout: 45_000,
  });
}

function localDateTimeValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

test("teacher records attendance and the session locks after its end time", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
  if (!teacherPassword) throw new Error("E2E_TEACHER_PASSWORD is required.");

  await page.goto("/login");
  await page.getByLabel("Username").fill("e2eteacher");
  await page.getByLabel("Password").fill(teacherPassword);
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toContainText(
    "Attendance",
  );

  const suffix = randomInt(10_000_000, 99_999_999).toString();
  const classId = await createIsolatedClass(`Attendance E2E ${suffix}`);
  await page.goto(`/teacher/students?class_id=${classId}`);
  const studentNames = ["Test Student Alpha", "Test Student Beta", "Test Student Gamma"]
    .map((name) => `${name} ${suffix}`);
  const csv = (await readFile("tests/fixtures/students-fixture.csv", "utf8"))
    .split(/\r?\n/)
    .map((line, index) => {
      if (index === 0 || !line) return line;
      const rollNumber = `99000${index}${suffix}`;
      return `${studentNames[index - 1]},${rollNumber},UNI-${rollNumber}`;
    })
    .join("\n");
  await page.locator('input[name="csv"]').setInputFiles({
    name: "students-fixture.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await expect(page.getByText("3 created, 0 skipped, 0 failed.")).toBeVisible();

  await page.goto(`/teacher/attendance?class_id=${classId}`);
  await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create attendance session" })).toHaveCount(0);
  const createSessionLink = page.getByRole("link", { name: "Create session" });
  await createSessionLink.click();
  await expect(page).toHaveURL(/new_session=1/);
  await page.getByLabel("Subject").fill("E2E attendance");
  await page.getByLabel("Late fine").fill("5");
  const now = new Date();
  const endAt = new Date(now);
  endAt.setMinutes(endAt.getMinutes() + 1, 0, 0);
  await page.getByLabel("Starts at").fill(
    localDateTimeValue(new Date(now.getTime() - 5 * 60_000)),
  );
  await page.getByLabel("Ends at").fill(localDateTimeValue(endAt));
  await page.getByRole("button", { name: "Create session" }).click();

  await expect(page).toHaveURL(/\/teacher\/attendance\?.*session_id=/);
  await expect(page.getByRole("heading", { name: "Create attendance session" })).toHaveCount(0);
  const alphaPresent = page.getByRole("button", {
    name: `Mark ${studentNames[0]} Present`,
  });
  const betaLate = page.getByRole("button", {
    name: `Mark ${studentNames[1]} Late`,
  });
  const gammaPresent = page.getByRole("button", {
    name: `Mark ${studentNames[2]} Present`,
  });
  const gammaAbsent = page.getByRole("button", {
    name: `Mark ${studentNames[2]} Absent`,
  });
  await expect(alphaPresent).toBeVisible();
  await expect(betaLate).toBeVisible();
  await expect(gammaPresent).toBeVisible();
  await expect(page.getByRole("button", { name: "Save attendance" })).toBeDisabled();
  await alphaPresent.click();
  await betaLate.click();
  await expect(alphaPresent).toHaveAttribute("aria-pressed", "true");
  await expect(betaLate).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Save attendance" })).toBeEnabled();
  const saveButton = page.getByRole("button", { name: "Save attendance" });
  await saveButton.click();
  await expect(page.getByText("Attendance saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(alphaPresent).toHaveAttribute("aria-pressed", "true");
  await expect(betaLate).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Late fine: 5.00")).toBeVisible();

  await expect
    .poll(
      async () => {
        await page.reload();
        return gammaAbsent.getAttribute("aria-pressed");
      },
      { timeout: 130_000, intervals: [5_000] },
    )
    .toBe("true");
  await expect(alphaPresent).toBeDisabled();
  await expect(betaLate).toBeDisabled();
  await expect(gammaPresent).toBeDisabled();
  await expect(page.getByText("This session has ended. Attendance is locked.")).toBeVisible();
});

test("attendance table stays responsive while marking 58 students", async ({ page }) => {
  test.setTimeout(180_000);
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;
  if (!teacherPassword) throw new Error("E2E_TEACHER_PASSWORD is required.");
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  const statusRequests: string[] = [];
  const rowRenderEvents: string[] = [];
  let collectRowRenderEvents = false;
  let collectStatusRequests = false;
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
    if (
      collectRowRenderEvents &&
      message.text().startsWith("AttendanceStudentRow ")
    ) {
      rowRenderEvents.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("request", (request) => {
    if (
      collectStatusRequests &&
      request.url().includes("/teacher/attendance") &&
      request.method() !== "GET"
    ) {
      statusRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/login");
  await page.getByLabel("Username").fill("e2eteacher");
  await page.getByLabel("Password").fill(teacherPassword);
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/teacher$/, { timeout: 15_000 });

  const suffix = randomInt(1_000_000, 9_999_999).toString();
  const performanceClassId = await createIsolatedClass(
    `Attendance performance ${suffix}`,
  );

  const fixtureHeader = (await readFile("tests/fixtures/students-fixture.csv", "utf8"))
    .split(/\r?\n/, 1)[0];
  if (fixtureHeader !== "name,roll_no,uni_roll_no") {
    throw new Error("Student CSV fixture header changed unexpectedly.");
  }
  const studentNames = Array.from({ length: 58 }, (_, index) =>
    `Perf Student ${suffix} ${String(index + 1).padStart(2, "0")}`,
  );
  const csv = [
    fixtureHeader,
    ...studentNames.map((name, index) => {
      const rollNo = `88${suffix}${String(index + 1).padStart(2, "0")}`;
      return `${name},${rollNo},UNI-${rollNo}`;
    }),
  ].join("\n");
  await page.goto(`/teacher/students?class_id=${performanceClassId}`);
  await page.locator('input[name="csv"]').setInputFiles({
    name: "attendance-performance-fixture.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await expect(page.getByText("58 created, 0 skipped, 0 failed.")).toBeVisible({
    timeout: 60_000,
  });

  await page.goto(`/teacher/attendance?class_id=${performanceClassId}`);
  await page.getByRole("link", { name: "Create session" }).click();
  await page.getByLabel("Subject").fill("Attendance performance");
  await page.getByLabel("Late fine").fill("0");
  const now = new Date();
  await page.getByLabel("Starts at").fill(
    localDateTimeValue(new Date(now.getTime() - 5 * 60_000)),
  );
  await page.getByLabel("Ends at").fill(
    localDateTimeValue(new Date(now.getTime() + 5 * 60_000)),
  );
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page).toHaveURL(/\/teacher\/attendance\?.*session_id=/);

  await expect(page.getByRole("button", { name: `Mark ${studentNames[0]} Present` }))
    .toBeVisible();
  await page.evaluate(() => {
    const diagnosticsWindow = window as Window & {
      __attendanceDiagnostics?: {
        tableCommits: number;
        stateActions: string[];
        effects: string[];
        commits: Array<{ phase: string; actualDuration: number; cause: string }>;
        lastAction: string;
      };
    };
    diagnosticsWindow.__attendanceDiagnostics = {
      tableCommits: 0,
      stateActions: [],
      effects: [],
      commits: [],
      lastAction: "test-start",
    };
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest("[data-attendance-status]")) {
          return;
        }
        (window as Window & { __attendanceClickStartedAt?: number })
          .__attendanceClickStartedAt = performance.now();
      },
      true,
    );
  });

  collectRowRenderEvents = true;
  collectStatusRequests = true;
  const timings: Array<{
    name: string;
    milliseconds: number;
    playwrightMilliseconds: number;
  }> = [];
  for (const name of studentNames.slice(0, 10)) {
    const status = page.getByRole("button", { name: `Mark ${name} Present` });
    const playwrightStart = performance.now();
    await status.click();
    await expect(status).toHaveAttribute("aria-pressed", "true");
    const playwrightMilliseconds = performance.now() - playwrightStart;
    const milliseconds = await page.evaluate(() => {
      const startedAt = (window as Window & { __attendanceClickStartedAt?: number })
        .__attendanceClickStartedAt;
      return startedAt === undefined ? Number.POSITIVE_INFINITY : performance.now() - startedAt;
    });
    timings.push({ name, milliseconds, playwrightMilliseconds });
    console.log(
      `Attendance UI update: ${milliseconds.toFixed(1)} ms; Playwright round-trip: ` +
        `${playwrightMilliseconds.toFixed(1)} ms (${name})`,
    );
  }

  const diagnostics = await page.evaluate(() => {
    const diagnosticsWindow = window as Window & {
      __attendanceDiagnostics?: {
        tableCommits: number;
        stateActions: string[];
        effects: string[];
        commits: Array<{ phase: string; actualDuration: number; cause: string }>;
        lastAction: string;
      };
    };
    return diagnosticsWindow.__attendanceDiagnostics;
  });
  if (!diagnostics) throw new Error("Attendance render diagnostics were not recorded.");
  collectRowRenderEvents = false;
  collectStatusRequests = false;
  const rowRenderTotal = rowRenderEvents.length;
  console.log("Attendance Profiler:", {
    tableCommits: diagnostics.tableCommits,
    rowRenderTotal,
    stateActions: diagnostics.stateActions,
    effects: diagnostics.effects,
    commits: diagnostics.commits,
  });
  console.log("Attendance browser errors:", browserErrors);
  console.log("Attendance failed responses:", failedResponses);
  console.log("Attendance status requests:", statusRequests);
  expect(browserErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(statusRequests).toEqual([]);
  expect(diagnostics.tableCommits).toBeLessThanOrEqual(12);
  expect(rowRenderTotal).toBeLessThanOrEqual(40);
  if (process.env.ATTENDANCE_PERF_TARGET !== "production") {
    expect(diagnostics.tableCommits).toBeGreaterThanOrEqual(10);
  }
  expect(diagnostics.stateActions).toHaveLength(10);
  expect(diagnostics.effects.filter((effect) => effect === "warn about unsaved attendance"))
    .toHaveLength(1);
  const productionThreshold = process.env.ATTENDANCE_PERF_TARGET === "production" ? 100 : 200;
  expect(timings.every((timing) => timing.milliseconds < productionThreshold)).toBe(true);

  const laterStudentPresent = page.getByRole("button", {
    name: `Mark ${studentNames[10]} Present`,
  });
  const laterStudentLate = page.getByRole("button", {
    name: `Mark ${studentNames[10]} Late`,
  });
  await laterStudentLate.click();
  await expect(laterStudentLate).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("11 marked, 47 unmarked")).toBeVisible();

  const attendanceUrl = page.url();
  let leaveDialogMessage = "";
  page.once("dialog", async (dialog) => {
    leaveDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home" })
    .click();
  expect(leaveDialogMessage).toContain("unsaved attendance changes");
  await expect(page).toHaveURL(attendanceUrl);
  await expect(laterStudentPresent).toHaveAttribute("aria-pressed", "false");
});
