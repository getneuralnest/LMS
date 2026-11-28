import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function parseEnvFile(source) {
  return Object.fromEntries(
    source.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) return [];
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      return [[match[1], value]];
    }),
  );
}

function jwtIssuer(value) {
  const parts = value?.split(".");
  if (parts?.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).iss ?? null;
  } catch {
    return null;
  }
}

const fileEnvironment = existsSync(".env.local")
  ? parseEnvFile(await readFile(".env.local", "utf8"))
  : {};
const environment = { ...fileEnvironment, ...process.env };
const url = environment.NEXT_PUBLIC_SUPABASE_URL;

if (url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  const isLocalUrl = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const authKeys = [
    environment.SUPABASE_SERVICE_ROLE_KEY,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].filter(Boolean);

  if (!isLocalUrl && authKeys.some((key) => jwtIssuer(key) === "supabase-demo")) {
    throw new Error(
      "Hosted Supabase URL is configured with local Supabase keys. Check .env.local.",
    );
  }
}

console.log("Supabase environment check passed.");
