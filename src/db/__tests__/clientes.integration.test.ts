import "dotenv/config";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { Db } from "@/db";
import {
  ClienteEmailTakenError,
  createCliente,
  findClienteByEmail,
  findClienteById,
} from "@/db/repositories/clientes";
import { clientes } from "@/db/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Integration tier (REQ-CLIENTE-08): requires DATABASE_URL pointing at the
 * compose PG16 with `pnpm db:migrate` applied. Skips with a clear message
 * otherwise; never fails without a database.
 *
 * The suite builds its own pool instead of importing "@/db" at runtime so a
 * placeholder AUTH_SECRET in .env cannot block integration runs — repos take
 * `db` injectable by design.
 */
const databaseUrl = process.env.DATABASE_URL;

// Handles exist only when the DB is available; every test below is gated on
// DATABASE_URL via it.skipIf, so they are always assigned before use.
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

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueEmail(): string {
  // Design D6: deterministic uniqueness per run — parallel-safe, survives
  // crashed runs leaving rows behind.
  return `test-${randomUUID()}@example.test`;
}

describe("clientes repository (integration)", () => {
  const d = it.skipIf(!databaseUrl);

  const inputFor = () => ({
    nombre: "Ana",
    apellido: "García",
    telefono: "+54 11 1234-5678",
    email: uniqueEmail(),
  });

  d("INSERT returns generated uuid and Date timestamps", async () => {
    const dto = await createCliente(getDb(), inputFor());
    expect(dto.id).toMatch(uuidV4);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
  });

  d("findClienteById round-trips a DTO with camelCase keys", async () => {
    const created = await createCliente(getDb(), inputFor());
    const found = await findClienteById(getDb(), created.id);

    expect(found).not.toBeNull();
    expect(found).toHaveProperty("createdAt");
    expect(found).not.toHaveProperty("created_at");
    expect(found?.nombre).toBe("Ana");
    expect(found?.email).toBe(created.email);
  });

  d("findClienteByEmail retrieves by unique email; miss returns null", async () => {
    const created = await createCliente(getDb(), inputFor());
    const found = await findClienteByEmail(getDb(), created.email);
    expect(found?.id).toBe(created.id);

    const miss = await findClienteByEmail(getDb(), uniqueEmail());
    expect(miss).toBeNull();
  });

  d("duplicate email INSERT throws ClienteEmailTakenError backed by code 23505", async () => {
    const input = inputFor();
    await createCliente(getDb(), input);

    let pgCode: string | undefined;
    try {
      await getDb().insert(clientes).values(input);
    } catch (error) {
      // Drizzle-orm wraps driver errors; the pg code lives on `cause`.
      const cause = (error as { cause?: { code?: string } }).cause;
      pgCode = (error as { code?: string }).code ?? cause?.code;
    }
    expect(pgCode).toBe("23505");

    await expect(createCliente(getDb(), input)).rejects.toThrow(
      ClienteEmailTakenError,
    );
  });

  d("stores TIMESTAMPTZ in UTC (-03:00 offset converted on write)", async () => {
    // Fresh email: the explicit-offset row below must not collide.
    const input = inputFor();

    // Raw insert with an explicit America/Argentina/Buenos_Aires offset.
    const [row] = await getDb()
      .insert(clientes)
      .values({ ...input, createdAt: new Date("2026-08-25T10:00:00-03:00") })
      .returning();

    expect(row).toBeDefined();
    expect(row!.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");
  });

  d("information_schema: timestamptz types and NOT NULL on every column", async () => {
    const result = await pool!.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'clientes'
        ORDER BY ordinal_position`,
    );

    expect(result.rows).toHaveLength(7);
    const columns = Object.fromEntries(
      result.rows.map((row) => [row.column_name, row]),
    );
    const column = (name: string) => {
      expect(columns[name], name).toBeDefined();
      return columns[name]!;
    };

    expect(column("id").data_type).toBe("uuid");
    expect(column("nombre").data_type).toBe("character varying");
    expect(column("apellido").data_type).toBe("character varying");
    expect(column("telefono").data_type).toBe("character varying");
    expect(column("email").data_type).toBe("character varying");
    expect(column("created_at").data_type).toBe("timestamp with time zone");
    expect(column("updated_at").data_type).toBe("timestamp with time zone");

    for (const row of result.rows) {
      expect(row.is_nullable, row.column_name).toBe("NO");
    }
  });

  d("$onUpdate bumps updated_at past created_at on UPDATE", async () => {
    const created = await createCliente(getDb(), inputFor());
    // Ensure wall-clock separation between INSERT and UPDATE.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await getDb()
      .update(clientes)
      .set({ nombre: "Ana María" })
      .where(eq(clientes.id, created.id));

    const found = await findClienteById(getDb(), created.id);
    expect(found?.nombre).toBe("Ana María");
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
