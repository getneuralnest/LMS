import { createClient } from "@supabase/supabase-js";

export async function createIsolatedClass(name: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Local Supabase service-role configuration is required for this fixture.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: teacher, error: teacherError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", "e2eteacher")
    .single();
  if (teacherError) throw new Error("Could not find the E2E teacher for the test fixture.");
  const { data: testClass, error: classError } = await admin
    .from("classes")
    .insert({ name, created_by: teacher.id })
    .select("id")
    .single();
  if (classError) throw new Error("Could not create an isolated test class.");
  return testClass.id;
}

export function createLocalAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Local Supabase service-role configuration is required for this fixture.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
