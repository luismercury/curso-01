// Drizzle Kit CLI config. It runs OUTSIDE the Next.js runtime, so it must
// load DATABASE_URL via dotenv directly. Do NOT import "@/lib/env" here:
// that module is server-only and would crash the kit CLI (REQ-CLIENTE-02).
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env before running drizzle-kit commands.",
  );
  process.exit(1);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
