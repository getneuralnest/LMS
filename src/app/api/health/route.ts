import { NextResponse } from "next/server";
import { createAdminClient } from "../../../utils/supabase/admin";

export async function GET() {
  const { error } = await createAdminClient()
    .from("classes")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Health check database query failed:", error.message);
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
