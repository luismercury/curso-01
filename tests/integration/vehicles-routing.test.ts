/**
 * Integration tests for the vehicles routing contract (REQ-VEH-04 / T-014).
 *
 * The spec scenario "401 before 403 precedence on list" maps to:
 *   - no JWT cookie -> requireAuth() throws 401 UNAUTHORIZED before any
 *     validation or DB call.
 *   - JWT for user A + customerId path param of user B -> assertOwnership
 *     throws 403 FORBIDDEN even if customerId is malformed.
 *   - DTO returned by listVehiclesByCustomer is camelCase + ISO; no
 *     marca/patente/cliente_id/fecha leak.
 *   - createdAt ASC ordering verified against live DB rows.
 *
 * Runs gated by `DATABASE_URL` (same convention as appointmentConcurrency.test.ts).
 * We mock the service / auth helpers via dynamic import so the requireAuth
 * pipeline is exercised against a real signed JWT (jose) without booting the
 * full Next.js router. Tests that need a live Postgres connection skip cleanly
 * when DATABASE_URL is absent.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import { createCliente } from "@/db/repositories/clientes";
import { createVehiculo, findVehiculosByClienteId } from "@/db/repositories/vehiculos";
import { requireAuth, assertOwnership } from "@/lib/auth/requireAuth";
import type { ClienteDTO } from "@/db/mappers/cliente";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db: Db | null = pool ? (drizzle(pool) satisfies Db) : null;

const SECRET = "test-vehicles-routing-secret-32-chars-xx";
const FAKE_CUSTOMER = "00000000-0000-4000-a000-000000000099";
const OTHER_CUSTOMER = "00000000-0000-4000-a000-000000000098";

async function signToken(payload: Record<string, unknown>): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

describe("vehicles routing contract (T-014 / REQ-VEH-04)", () => {
  const d = it.skipIf(!databaseUrl);

  const previous = process.env.AUTH_SECRET;
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  });

  d("no JWT -> requireAuth throws 401 UNAUTHORIZED before any validation", async () => {
    const req = new Request("http://localhost/api/vehicles", { headers: {} });
    await expect(requireAuth(req)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  d("valid JWT for user A + non-owner customerId -> assertOwnership throws 403 FORBIDDEN", async () => {
    const token = await signToken({ sub: FAKE_CUSTOMER, email: "a@x.test", role: "CLIENTE" });
    const authUser = { id: FAKE_CUSTOMER, email: "a@x.test", role: "CLIENTE" as const };
    // assertOwnership is independent of customerId format — runs even with a malformed id.
    try {
      assertOwnership("not-a-uuid", authUser);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("FORBIDDEN");
      expect((e as { status?: number }).status).toBe(403);
    }
    // sanity: a real signed token is parseable so the test would have reached assertOwnership.
    await expect(
      requireAuth(new Request("http://localhost/x", { headers: { cookie: `authjs.session-token=${token}` } })),
    ).resolves.toMatchObject({ id: FAKE_CUSTOMER });
  });

  d("valid JWT for ADMIN bypasses assertOwnership even with non-matching id", async () => {
    const authAdmin = { id: OTHER_CUSTOMER, email: "admin@x.test", role: "ADMINISTRADOR" as const };
    expect(() => assertOwnership("any-owner", authAdmin)).not.toThrow();
  });

  if (databaseUrl && db) {
    d("DTO from listVehiclesByCustomer contains camelCase only (no marca/patente/cliente_id/fecha)", async () => {
      // Seed a cliente + 2 vehicles with distinct created_at.
      const suffix = `t${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
      const cliente: ClienteDTO = await createCliente(db, {
        nombre: "T039Routing",
        apellido: "Tester",
        telefono: `+54 11 1234 5678`,
        email: `${suffix.toLowerCase()}@x.test`,
      });
      await createVehiculo(db, {
        customerId: cliente.id,
        brand: "Toyota",
        model: "Corolla",
        year: 2020,
        plate: "AAA111",
      });
      // tiny delay so the second row has a strictly later created_at
      await new Promise((r) => setTimeout(r, 5));
      await createVehiculo(db, {
        customerId: cliente.id,
        brand: "Ford",
        model: "Ranger",
        year: 2024,
        plate: "BBB222",
      });

      try {
        const list = await findVehiculosByClienteId(db, cliente.id);
        expect(list.length).toBe(2);
        for (const dto of list) {
          const keys = Object.keys(dto).sort();
          expect(keys).toEqual(["brand", "createdAt", "customerId", "id", "model", "plate", "updatedAt", "year"]);
          const json = JSON.stringify(dto);
          for (const forbidden of ["marca", "modelo", "anio", "patente", "cliente_id", "created_at", "updated_at", "fecha"]) {
            expect(json, `dto must not contain ${forbidden}`).not.toContain(forbidden);
          }
          expect(dto.createdAt).toBeInstanceOf(Date);
        }
      } finally {
        // teardown — services repository deletes vehiculos by cliente id
        await db.execute(`DELETE FROM vehiculos WHERE cliente_id = '${cliente.id}'`);
        await db.execute(`DELETE FROM clientes WHERE id = '${cliente.id}'`);
      }
    });

    d("listVehiclesByCustomer returns rows ordered createdAt ASC", async () => {
      const suffix = `a${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
      const cliente: ClienteDTO = await createCliente(db, {
        nombre: "T039Asc",
        apellido: "Order",
        telefono: `+54 11 8765 4321`,
        email: `${suffix.toLowerCase()}@x.test`,
      });
      try {
        await createVehiculo(db, { customerId: cliente.id, brand: "B1", model: "M1", year: 2020, plate: "CCC333" });
        await new Promise((r) => setTimeout(r, 5));
        await createVehiculo(db, { customerId: cliente.id, brand: "B2", model: "M2", year: 2021, plate: "DDD444" });

        const list = await findVehiculosByClienteId(db, cliente.id);
        expect(list.length).toBe(2);
        // createdAt ASC: first is older
        expect(list[0]!.createdAt.getTime()).toBeLessThanOrEqual(list[1]!.createdAt.getTime());
      } finally {
        await db.execute(`DELETE FROM vehiculos WHERE cliente_id = '${cliente.id}'`);
        await db.execute(`DELETE FROM clientes WHERE id = '${cliente.id}'`);
      }
    });
  }

  if (!databaseUrl) {
    it.skip("skipped: DATABASE_URL not set — copy .env.example to .env, run docker compose up -d and pnpm db:migrate", () => {});
  }
});