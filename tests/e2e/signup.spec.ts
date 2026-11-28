import { expect, test } from "@playwright/test";

test("Supabase email self-signup is disabled", async ({ request }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL and publishable key are required for e2e tests");
  }

  const response = await request.post(`${supabaseUrl}/auth/v1/signup`, {
    headers: { apikey: publishableKey },
    data: {
      email: `signup-disabled-${crypto.randomUUID()}@students.example.com`,
      password: "Signup-disabled-test-password-8",
      gotrue_meta_security: { captcha_token: "XXXX.DUMMY.TOKEN.XXXX" },
    },
  });

  expect(response.status()).toBe(422);
  expect(await response.text()).toMatch(/signup.*not.*allow|signup_disabled/i);
});
