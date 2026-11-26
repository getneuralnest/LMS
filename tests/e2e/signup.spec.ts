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
      email: `signup-disabled-${crypto.randomUUID()}@class.local`,
      password: "Signup-disabled-test-password-8",
      gotrue_meta_security: { captcha_token: "signup-disabled-test-token" },
    },
  });

  expect(response.status()).toBe(400);
  expect(await response.text()).toMatch(/signup.*not.*allow|signup_disabled/i);
});
