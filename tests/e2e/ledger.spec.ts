import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("", {
    timeout: 45_000,
  });
}

test("class representative adds a collection to the class ledger", async ({ page }) => {
  const password = process.env.E2E_TEACHER_PASSWORD;
  if (!password) throw new Error("E2E_TEACHER_PASSWORD is required.");

  await page.goto("/login");
  await page.getByLabel("Username").fill("e2ecr");
  await page.getByLabel("Password").fill(password);
  await waitForCaptcha(page);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/student$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Manage CR ledger" }).click();
  await expect(page).toHaveURL(/\/teacher\/ledger/);
  await expect(page.getByRole("heading", { name: "CR ledger" })).toBeVisible();

  const amount = "13.27";
  const note = `E2E CR collection ${randomUUID()}`;
  const collectionTotal = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Class totals" }) })
    .locator("div.rounded-lg")
    .first()
    .locator("p")
    .nth(1);
  const initialTotal = Number(await collectionTotal.textContent());

  await page.getByLabel("Type").selectOption("collection");
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Student (required for fine payments)").selectOption("");
  await page.getByLabel("Note").fill(note);
  await page.getByRole("button", { name: "Add entry" }).click();

  await expect(page.getByRole("status")).toHaveText("Ledger entry added.");
  await expect(
    page.getByRole("row").filter({ hasText: note }),
  ).toBeVisible();
  await expect(collectionTotal).toHaveText((initialTotal + Number(amount)).toFixed(2));
});
