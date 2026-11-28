import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "../../../utils/supabase/admin";
import { createClient } from "../../../utils/supabase/server";

const allowedTypes = new Set(["signup", "email_change", "recovery"]);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const tokenHash = search.get("token_hash");
  const type = search.get("type");
  if (!tokenHash || !type || !allowedTypes.has(type)) {
    return NextResponse.redirect(new URL("/login?confirmation=invalid", request.url));
  }
  const otpType =
    type === "signup" ? "signup" : type === "email_change" ? "email_change" : "recovery";

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,
  });
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?confirmation=invalid", request.url));
  }

  if (type === "email_change") {
    const admin = createAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ email_confirmed_at: new Date().toISOString() })
      .eq("id", data.user.id);
    if (profileError) throw new Error("Email confirmed, but account status could not be saved.");
  }

  const target = type === "recovery" ? "/reset-password" : "/student";
  return NextResponse.redirect(new URL(target, request.url));
}
