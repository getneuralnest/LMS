import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sourceDirectory = process.env.STORAGE_RESTORE_DIR;

if (!supabaseUrl || !serviceRoleKey || !sourceDirectory) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STORAGE_RESTORE_DIR.",
  );
}

const baseUrl = new URL(supabaseUrl);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname);
if (!isLocal && !process.argv.includes("--confirm-production")) {
  throw new Error("Restoring to a hosted project requires --confirm-production.");
}

const root = path.resolve(sourceDirectory);
const contentTypes = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);
let fileCount = 0;
let byteCount = 0;

async function upload(relativePath) {
  const segments = relativePath.split(path.sep);
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Restore directory contains an invalid object path.");
  }
  const objectPath = segments.join("/");
  const encodedPath = segments.map(encodeURIComponent).join("/");
  const contents = await readFile(path.resolve(root, ...segments));
  const response = await fetch(
    new URL(`/storage/v1/object/submissions/${encodedPath}`, baseUrl),
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": contentTypes.get(path.extname(objectPath).toLowerCase())
          ?? "application/octet-stream",
        "x-upsert": "true",
      },
      body: contents,
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Storage restore upload failed with HTTP ${response.status}.`);
  }

  fileCount += 1;
  byteCount += contents.byteLength;
}

async function walk(directory, relativeDirectory = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await walk(path.join(directory, entry.name), relativePath);
    } else if (entry.isFile()) {
      await upload(relativePath);
    } else {
      throw new Error("Restore directory contains an unsupported file type.");
    }
  }
}

await walk(root);
console.log(`Storage restore uploaded ${fileCount} file(s), ${byteCount} bytes.`);
