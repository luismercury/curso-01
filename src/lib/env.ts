import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine(
      (v) => {
        try {
          return new URL(v).protocol.startsWith("postgres");
        } catch {
          return false;
        }
      },
      { error: "DATABASE_URL must be a valid postgresql:// URL" },
    ),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.url().default("http://localhost:3000"),
});

// Treat "" as unset so defaults apply and required fields reject cleanly.
const rawEnv: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment variables:\n${details}`);
  throw new Error(
    "Invalid environment configuration — fix the variables listed above.",
  );
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
