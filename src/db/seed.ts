import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedServicios } from "./seeds/servicios";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log("[seed] starting...");
  const result = await seedServicios(db);
  console.log(`[seed] inserted=${result.inserted} skipped=${result.skipped}`);
  await pool.end();
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[seed] fatal:", err);
  pool.end().finally(() => process.exit(1));
});
