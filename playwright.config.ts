import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (match) {
      process.env[match[1]] ??= match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_BASE_URL !== undefined,
    timeout: 120_000,
    env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3001" },
  },
});
