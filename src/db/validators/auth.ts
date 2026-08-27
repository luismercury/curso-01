import { z } from "zod";
import { userRoleSchema } from "@/lib/auth/roles";

const normalizedEmail = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .pipe(z.string().email());

export const registerSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(8).max(72),
  role: userRoleSchema.optional().default("CLIENTE"),
});

export const loginSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
