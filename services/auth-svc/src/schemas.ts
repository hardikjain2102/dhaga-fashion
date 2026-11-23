import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);

// bcrypt only uses the first 72 bytes, so longer passwords are refused instead of silently truncated.
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => Buffer.byteLength(p) <= 72, "Password must be at most 72 bytes");

// .strict() rejects unknown fields, so a client cannot slip in extra properties such as "role: admin".
export const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email,
    password: newPassword,
    role: z.enum(["customer", "seller"]),
  })
  .strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) }).strict();

export const statusSchema = z.object({ status: z.enum(["approved", "suspended"]) }).strict();

export const idSchema = z.string().uuid();
