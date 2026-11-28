const argument = process.argv.find((value) => value.startsWith("--url="));
const target = argument?.slice("--url=".length) ?? process.env.SMOKE_BASE_URL;

if (!target) {
  throw new Error("Pass --url=<https://portal.example> or set SMOKE_BASE_URL.");
}

const baseUrl = new URL(target);
if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("Smoke checks require HTTPS except for localhost.");
}

for (const pathname of ["/api/health", "/login"]) {
  const response = await fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Smoke check for ${pathname} failed with HTTP ${response.status}.`);
  }
  if (pathname === "/api/health") {
    const body = await response.json();
    if (body.status !== "ok") {
      throw new Error("Smoke check returned an unhealthy database status.");
    }
  }
}

console.log("Production smoke checks passed: /api/health and /login.");
