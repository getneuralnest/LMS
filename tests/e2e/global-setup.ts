import { spawnSync } from "node:child_process";

export default function globalSetup() {
  const result = spawnSync(
    process.execPath,
    ["scripts/seed-admin.mjs", "--e2e"],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error("Could not seed the throwaway E2E teacher account.");
  }
}
