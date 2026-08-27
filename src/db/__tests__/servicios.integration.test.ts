import "dotenv/config";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import {
  createServicio,
  findServicioById,
  findServicioByNombre,
  listServicios,
  ServicioNombreTakenError,
} from "@/db/repositories/servicios";
import { servicios } from "@/db/schema";

/**
 * Integration tier (REQ-SRV-05): requires DATABASE_URL pointing at the
 * compose PG16 with `pnpm db:migrate` applied. Skips with a clear message
 * otherwise; never fails without a database.
 *
 * Reads process.env.DATABASE_URL directly — never imports the
 * server-only env layer. The suite builds its own pool so repos stay
 * injectable and a placeholder AUTH_SECRET cannot block runs.
 */
const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db = pool ? (drizzle(pool) satisfies Db) : null;

function getDb(): Db {
  if (!db) {
    throw new Error(
      "Integration database unavailable — DATABASE_URL must be set",
    );
  }
  return db;
}

function uniqueNombre(): string {
  return `Servicio ${randomUUID().slice(0, 8)}`;
}

describe("servicios repository (integration)", () => {
  const d = it.skipIf(!databaseUrl);

  const createdIds: string[] = [];

  d("insert/select round-trip (REQ-SRV-03)", async () => {
    const nombre = uniqueNombre();
    const created = await createServicio(getDb(), {
      name: nombre,
      description: "desc",
      durationMinutes: 60,
    });
    createdIds.push(created.id);

    expect(created.name).toBe(nombre);
    expect(created.durationMinutes).toBe(60);
    expect(created.active).toBe(true);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const byId = await findServicioById(getDb(), created.id);
    expect(byId?.id).toBe(created.id);
    expect(byId?.name).toBe(nombre);

    const byNombre = await findServicioByNombre(getDb(), nombre);
    expect(byNombre?.id).toBe(created.id);
  });

  d("activo defaults to true when omitted (REQ-SRV-01)", async () => {
    const nombre = uniqueNombre();
    const [row] = await getDb()
      .insert(servicios)
      .values({
        nombre,
        duracionMinutos: 30,
      })
      .returning();
    createdIds.push(row!.id);
    expect(row!.activo).toBe(true);

    // Also via repository without active field
    const nombre2 = uniqueNombre();
    const dto = await createServicio(getDb(), {
      name: nombre2,
      durationMinutes: 45,
    });
    createdIds.push(dto.id);
    expect(dto.active).toBe(true);
  });

  d("duplicate nombre UNIQUE violation maps to ServicioNombreTakenError (23505)", async () => {
    const nombre = uniqueNombre();
    const first = await createServicio(getDb(), {
      name: nombre,
      durationMinutes: 90,
    });
    createdIds.push(first.id);

    const outcome = await createServicio(getDb(), {
      name: nombre,
      description: "different",
      durationMinutes: 60,
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(ServicioNombreTakenError);
    let current: unknown = outcome;
    let pgCode: string | undefined;
    while (typeof current === "object" && current !== null && !pgCode) {
      pgCode = (current as { code?: string }).code;
      if (!pgCode) {
        current = (current as { cause?: unknown }).cause;
      }
    }
    expect(pgCode).toBe("23505");
  });

  d("listServicios filtering by activo (REQ-SRV-03)", async () => {
    const activeNombre = uniqueNombre();
    const inactiveNombre = uniqueNombre();
    const active = await createServicio(getDb(), {
      name: activeNombre,
      durationMinutes: 30,
      active: true,
    });
    const inactive = await createServicio(getDb(), {
      name: inactiveNombre,
      durationMinutes: 60,
      active: false,
    });
    createdIds.push(active.id, inactive.id);

    const onlyActive = await listServicios(getDb(), { activeOnly: true });
    const all = await listServicios(getDb(), { activeOnly: false });

    expect(onlyActive.map((s) => s.id)).toContain(active.id);
    expect(onlyActive.map((s) => s.id)).not.toContain(inactive.id);
    expect(all.map((s) => s.id)).toContain(active.id);
    expect(all.map((s) => s.id)).toContain(inactive.id);

    // Default should be activeOnly true
    const defaultList = await listServicios(getDb());
    expect(defaultList.map((s) => s.id)).toContain(active.id);
    expect(defaultList.map((s) => s.id)).not.toContain(inactive.id);
  });

  d("stores TIMESTAMPTZ in UTC (-03:00 offset converted on write)", async () => {
    const nombre = uniqueNombre();
    const [row] = await getDb()
      .insert(servicios)
      .values({
        nombre,
        duracionMinutos: 60,
        createdAt: new Date("2026-08-25T10:00:00-03:00"),
      })
      .returning();
    createdIds.push(row!.id);
    expect(row!.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");
  });

  d("information_schema: column types, NOT NULL, UNIQUE, activo default", async () => {
    const result = await pool!.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'servicios'
        ORDER BY ordinal_position`,
    );

    expect(result.rows.length).toBeGreaterThanOrEqual(7);
    const columns = Object.fromEntries(
      result.rows.map((row) => [row.column_name, row]),
    );
    const col = (name: string) => {
      expect(columns[name], name).toBeDefined();
      return columns[name]!;
    };

    expect(col("id").data_type).toBe("uuid");
    expect(col("nombre").data_type).toBe("character varying");
    expect(col("descripcion").data_type).toBe("character varying");
    expect(col("duracion_minutos").data_type).toBe("integer");
    expect(col("activo").data_type).toBe("boolean");
    expect(col("created_at").data_type).toBe("timestamp with time zone");
    expect(col("updated_at").data_type).toBe("timestamp with time zone");

    expect(col("id").is_nullable).toBe("NO");
    expect(col("nombre").is_nullable).toBe("NO");
    expect(col("descripcion").is_nullable).toBe("YES");
    expect(col("duracion_minutos").is_nullable).toBe("NO");
    expect(col("activo").is_nullable).toBe("NO");
    expect(col("activo").column_default).toMatch(/true/i);

    const unique = await pool!.query<{ constraint_type: string }>(
      `SELECT constraint_type FROM information_schema.table_constraints
        WHERE table_name = 'servicios' AND constraint_type = 'UNIQUE'`,
    );
    expect(unique.rows.length).toBeGreaterThanOrEqual(1);

    const checks = await pool!.query<{ check_clause: string }>(
      `SELECT check_clause FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%servicios%'`,
    );
    // t009: servicios now has CHECKs, verify duracion constraint present
    const all = checks.rows.map((r) => r.check_clause).join(" ");
    expect(all).toMatch(/duracion_minutos/);
    expect(all).toMatch(/length/);
  });

  d("$onUpdate bumps updated_at past created_at on write", async () => {
    const nombre = uniqueNombre();
    const created = await createServicio(getDb(), {
      name: nombre,
      durationMinutes: 60,
    });
    createdIds.push(created.id);
    await new Promise((resolve) => setTimeout(resolve, 10));

    await getDb()
      .update(servicios)
      .set({ descripcion: "updated" })
      .where(eq(servicios.id, created.id));

    const found = await findServicioById(getDb(), created.id);
    expect(found?.description).toBe("updated");
    expect(found!.updatedAt.getTime()).toBeGreaterThan(
      found!.createdAt.getTime(),
    );
  });

  if (!databaseUrl) {
    it.skip(
      "skipped: DATABASE_URL is not set — copy .env.example to .env, run docker compose up -d and pnpm db:migrate",
      () => {},
    );
  }
});
