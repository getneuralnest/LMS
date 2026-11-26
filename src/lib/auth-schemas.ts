import { z } from "zod";

export const loginFormSchema = z
  .object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
    captchaToken: z.string().min(1),
  })
  .strict();

export const passwordChangeFormSchema = z
  .object({
    currentPassword: z.string().min(8),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    captchaToken: z.string().min(1),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.password !== value.currentPassword, {
    message: "New password must differ from the temporary password.",
    path: ["password"],
  });

export const classRoleChangeSchema = z
  .object({
    classId: z.string().uuid(),
    studentId: z.string().uuid(),
  })
  .strict();
