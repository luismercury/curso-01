import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";

// Module-scope singletons: ESM guarantees reference equality for every
// importer (REQ-CLIENTE-03). The kit CLI must NOT import this module —
// it uses dotenv directly in drizzle.config.ts.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool);
export type Db = typeof db;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbOrTx = Db | Tx;
export { pool };
