import "dotenv/config";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { SEED_SERVICIOS, seedServicios } from "@/db/seeds/servicios";
import { servicios } from "@/db/schema";
import { servicioInputSchema } from "@/db/validators/servicio";

/**
 * Integration tier: requires DATABASE_URL pointing at PG16 with `pnpm db:migrate` applied.
 * Skips gracefully without a database.
 * Uses direct Pool + drizzle, never imports server-only @/db or @/lib/env.
 */
const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

beforeAll(() => {
  if (!DATABASE_URL) return;
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzle(pool);
});

afterEach(async () => {
  if (!pool) return;
  await pool.query(
    `DELETE FROM servicios WHERE nombre IN ('Cambio de aceite','Revisión general','Alineación y balanceo')`,
  );
});

afterAll(async () => {
  await pool?.end();
});

describe("seedServicios idempotency (T-018)", () => {
  const d = it.skipIf(!DATABASE_URL);

  d("SEED_SERVICIOS has exactly 3 canonical rows with correct durations and activo=true", () => {
    expect(SEED_SERVICIOS).toHaveLength(3);
    expect(SEED_SERVICIOS.map((r) => r.nombre)).toEqual([
      "Cambio de aceite",
      "Revisión general",
      "Alineación y balanceo",
    ]);
    expect(SEED_SERVICIOS.map((r) => r.duracionMinutos).sort((a, b) => a - b)).toEqual([60, 90, 120]);
    expect(SEED_SERVICIOS.every((r) => r.activo === true)).toBe(true);
    for (const row of SEED_SERVICIOS) {
      expect(row.duracionMinutos % 5).toBe(0);
      expect(row.duracionMinutos).toBeGreaterThan(0);
      expect(row.descripcion.length).toBeLessThanOrEqual(500);
    }
  });

  d("seed rows pass servicioInputSchema validator (60/90/120 within 30..120 %5==0)", () => {
    for (const row of SEED_SERVICIOS) {
      expect(() => servicioInputSchema.parse(row)).not.toThrow();
    }
  });

  d("first run inserts 3, second run inserts 0 (idempotent)", async () => {
    const r1 = await seedServicios(db);
    expect(r1.inserted).toBe(3);
    expect(r1.skipped).toBe(0);

    const r2 = await seedServicios(db);
    expect(r2.inserted).toBe(0);
    expect(r2.skipped).toBe(3);

    const rows = await db.select().from(servicios);
    // filter to seeded nombres only to avoid interference from other test data
    const seeded = rows.filter((r: { nombre: string }) =>
      ["Cambio de aceite", "Revisión general", "Alineación y balanceo"].includes(r.nombre),
    );
    expect(seeded).toHaveLength(3);
  });

  d("seeded rows satisfy activo=true and duracionMinutos in {60,90,120} (INV-05/INV-08)", async () => {
    await seedServicios(db);
    const rows = await db.select().from(servicios);
    const seeded = rows.filter((r: { nombre: string }) =>
      ["Cambio de aceite", "Revisión general", "Alineación y balanceo"].includes(r.nombre),
    );
    expect(seeded.every((r: { activo: boolean }) => r.activo === true)).toBe(true);
    expect(seeded.map((r: { duracionMinutos: number }) => r.duracionMinutos).sort((a: number, b: number) => a - b)).toEqual([
      60, 90, 120,
    ]);
  });

  d("UNIQUE violation on second run does not throw (DO NOTHING)", async () => {
    await seedServicios(db);
    await expect(seedServicios(db)).resolves.toEqual({
      inserted: 0,
      skipped: 3,
    });
  });

  d("existing row descripcion unchanged on re-run (DO NOTHING, not DO UPDATE)", async () => {
    const first = await seedServicios(db);
    expect(first.inserted).toBe(3);
    // mutate one seeded row's descripcion
    await pool!.query(`UPDATE servicios SET descripcion='mutated' WHERE nombre='Cambio de aceite'`);
    const second = await seedServicios(db);
    expect(second.inserted).toBe(0);
    const rows = await db.select().from(servicios);
    const mutated = rows.find((r: { nombre: string }) => r.nombre === "Cambio de aceite");
    expect(mutated.descripcion).toBe("mutated");
  });
});
