import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const captchaToken = "XXXX.DUMMY.TOKEN.XXXX";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function randomPassword(): string {
  return `Test-${randomBytes(24).toString("base64url")}!A7`;
}

test("create-students rejects a student and a teacher outside the target class", async ({
  request,
}) => {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const teacherPassword = requiredEnv("E2E_TEACHER_PASSWORD");
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const usersResponse = await request.get(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers: adminHeaders },
  );
  expect(usersResponse.ok()).toBe(true);
  const users = (await usersResponse.json()).users as { id: string; email: string }[];
  const teacher = users.find((user) => user.email === "e2eteacher@students.example.com");
  if (!teacher) throw new Error("The E2E teacher account was not seeded.");

  const membershipsResponse = await request.get(
    `${supabaseUrl}/rest/v1/class_members?select=class_id&user_id=eq.${teacher.id}&role=eq.teacher&limit=1`,
    { headers: adminHeaders },
  );
  expect(membershipsResponse.ok()).toBe(true);
  const memberships = await membershipsResponse.json() as { class_id: string }[];
  const targetClassId = memberships[0]?.class_id;
  if (!targetClassId) throw new Error("The E2E teacher has no class.");

  const createdUsers: string[] = [];
  const createdClasses: string[] = [];
  async function createAuthUser(fullName: string) {
    const email = `security-${randomUUID()}@students.example.com`;
    const password = randomPassword();
    const response = await request.post(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      data: {
        email,
        password,
        email_confirm: true,
        app_metadata: { must_change_password: false },
        user_metadata: { full_name: fullName },
      },
    });
    expect(response.ok()).toBe(true);
    const user = await response.json() as { id: string };
    createdUsers.push(user.id);
    return { id: user.id, email, password };
  }

  async function accessToken(email: string, password: string) {
    const response = await request.post(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: publishableKey },
        data: {
          email,
          password,
          gotrue_meta_security: { captcha_token: captchaToken },
        },
      },
    );
    expect(response.status()).toBe(200);
    return (await response.json()).access_token as string;
  }

  async function expectForbidden(classId: string, token: string) {
    const response = await request.post(
      `${supabaseUrl}/functions/v1/create-students`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${token}`,
        },
        data: {
          class_id: classId,
          csv: "name,roll_no,uni_roll_no\nTest Student,991234,UNI-991234",
        },
      },
    );
    expect(response.status()).toBe(403);
  }

  try {
    const student = await createAuthUser("Security Test Student");
    const membershipResponse = await request.post(
      `${supabaseUrl}/rest/v1/class_members`,
      {
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: {
          class_id: targetClassId,
          user_id: student.id,
          role: "student",
        },
      },
    );
    expect(membershipResponse.ok()).toBe(true);
    await expectForbidden(
      targetClassId,
      await accessToken(student.email, student.password),
    );

    const otherClassOwner = await createAuthUser("Other Class Teacher");
    const otherClassResponse = await request.post(
      `${supabaseUrl}/rest/v1/classes`,
      {
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: {
          name: `Other Class ${randomUUID()}`,
          created_by: otherClassOwner.id,
        },
      },
    );
    expect(otherClassResponse.ok()).toBe(true);
    const [otherClass] = await otherClassResponse.json() as { id: string }[];
    createdClasses.push(otherClass.id);
    await expectForbidden(
      otherClass.id,
      await accessToken("e2eteacher@students.example.com", teacherPassword),
    );
  } finally {
    for (const classId of createdClasses) {
      const response = await request.delete(
        `${supabaseUrl}/rest/v1/classes?id=eq.${classId}`,
        { headers: adminHeaders },
      );
      expect(response.ok()).toBe(true);
    }
    for (const userId of createdUsers) {
      const response = await request.delete(
        `${supabaseUrl}/auth/v1/admin/users/${userId}`,
        { headers: adminHeaders },
      );
      expect(response.ok()).toBe(true);
    }
  }
});
