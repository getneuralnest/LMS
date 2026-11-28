import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabasePublicEnvironment } from "./lib/supabase-env";
import { createClient } from "./utils/supabase/middleware";

function contentSecurityPolicy(nonce: string): string {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnvironment();
  const supabaseUrl = new URL(NEXT_PUBLIC_SUPABASE_URL);
  const realtimeProtocol = supabaseUrl.protocol === "https:" ? "wss:" : "ws:";
  const isProduction = process.env.NODE_ENV === "production";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    `connect-src 'self' ${supabaseUrl.origin} ${realtimeProtocol}//${supabaseUrl.host} https://challenges.cloudflare.com`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = await createClient(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  const { pathname } = request.nextUrl;
  const isAllowedDuringClaim =
    pathname === "/" ||
    pathname === "/auth/confirm" ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/");
  const user = response.headers.get("x-class-portal-user");
  const active = response.headers.get("x-class-portal-active");

  if (active === "false" && pathname !== "/login" && !pathname.startsWith("/auth/")) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }
  if (user === "must-change" && !isAllowedDuringClaim) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

