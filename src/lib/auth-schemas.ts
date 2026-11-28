import { z } from "zod";

export const loginFormSchema = z
  .object({
    username: z.string().trim().min(1).max(256),
    password: z.string().min(1).max(1024),
    captchaToken: z.string().min(1).max(8192),
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

export const accountClaimSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(1024),
    confirmPassword: z.string().min(8).max(1024),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const accountEmailSchema = z
  .object({ email: z.string().trim().email().max(254) })
  .strict();

export const forgotPasswordSchema = z
  .object({
    username: z.string().trim().min(1).max(256),
    captchaToken: z.string().min(1).max(8192),
  })
  .strict();

export const teacherAccountSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9._-]{3,64}$/,
        "Username must be 3-64 characters and use only letters, numbers, periods, underscores, or hyphens.",
      ),
    password: z.string().max(1024).optional(),
    classId: z.string().uuid(),
  })
  .strict()
  .refine((value) => !value.password || value.password.length >= 12, {
    message: "Password must contain at least 12 characters.",
    path: ["password"],
  });

export const teacherResetSchema = z
  .object({
    classId: z.string().uuid(),
    teacherId: z.string().uuid(),
  })
  .strict();

export const studentResetSchema = z
  .object({ classId: z.string().uuid(), studentId: z.string().uuid() })
  .strict();
