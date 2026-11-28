import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputDirectory = process.env.STORAGE_BACKUP_DIR;

if (!supabaseUrl || !serviceRoleKey || !outputDirectory) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STORAGE_BACKUP_DIR.",
  );
}

const baseUrl = new URL(supabaseUrl);
const root = path.resolve(outputDirectory);
const pageSize = 500;
let fileCount = 0;
let byteCount = 0;

async function request(pathname, init) {
  const response = await fetch(new URL(pathname, baseUrl), {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Storage backup request failed with HTTP ${response.status}.`);
  }
  return response;
}

async function listFolder(prefix) {
  for (let offset = 0; ; offset += pageSize) {
    const response = await request("/storage/v1/object/list/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    const entries = await response.json();

    for (const entry of entries) {
      if (entry.id === null) {
        await listFolder(`${prefix}${entry.name}/`);
        continue;
      }

      const objectPath = `${prefix}${entry.name}`;
      const segments = objectPath.split("/");
      if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
        throw new Error("Storage returned an invalid object path.");
      }
      const destination = path.resolve(root, ...segments);
      if (!destination.startsWith(`${root}${path.sep}`)) {
        throw new Error("Storage object path escapes the backup directory.");
      }

      const encodedPath = segments.map(encodeURIComponent).join("/");
      const download = await request(
        `/storage/v1/object/authenticated/submissions/${encodedPath}`,
      );
      const contents = Buffer.from(await download.arrayBuffer());
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, contents, { flag: "wx" });
      fileCount += 1;
      byteCount += contents.byteLength;
    }

    if (entries.length < pageSize) return;
  }
}

await mkdir(root, { recursive: true });
await listFolder("");
console.log(`Storage backup downloaded ${fileCount} file(s), ${byteCount} bytes.`);
