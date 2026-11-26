import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnvironment } from "../../lib/supabase-env";
import { getSupabaseServerEnvironment } from "../../lib/server-env";

export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnvironment();
  const { SUPABASE_SERVICE_ROLE_KEY } = getSupabaseServerEnvironment();

  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
