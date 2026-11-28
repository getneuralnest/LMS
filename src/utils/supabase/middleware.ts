import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnvironment } from "../../lib/supabase-env";

export const createClient = async (
  request: NextRequest,
  requestHeaders: Headers = request.headers,
) => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnvironment();
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          const updatedRequestHeaders = new Headers(request.headers);
          for (const headerName of ["content-security-policy", "x-nonce"]) {
            const headerValue = requestHeaders.get(headerName);
            if (headerValue) updatedRequestHeaders.set(headerName, headerValue);
          }
          supabaseResponse = NextResponse.next({
            request: { headers: updatedRequestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.app_metadata.must_change_password === true) {
    supabaseResponse.headers.set("x-class-portal-user", "must-change");
  }
  if (user) {
    const { data: sessionCurrent, error: sessionError } = await supabase.rpc(
      "is_session_current",
    );
    if (sessionError) throw new Error("Could not verify the current account session.");
    if (!sessionCurrent) {
      await supabase.auth.signOut();
      supabaseResponse.headers.set("x-class-portal-active", "false");
    }
  }
  return supabaseResponse;
};

