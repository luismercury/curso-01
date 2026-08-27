import "dotenv/config";
import { randomUUID } from "node:crypto";
import { describe, expect, it, afterAll } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Db } from "@/db";
import { createCustomer } from "@/services/customerService";
import {
  createVehicle,
  getVehicleById,
  listVehiclesByCustomer,
} from "@/services/vehicleService";
import {
  createServicio,
  listServicios,
} from "@/db/repositories/servicios";
import { vehiculos } from "@/db/schema";
import {
  assertCanCreateAppointment,
  InvalidServiceError,
} from "@/services/appointmentGuard";
import { ForbiddenError } from "@/lib/auth/requireAuth";
import type { VehiculoDTO } from "@/db/mappers/vehiculo";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db = pool ? (drizzle(pool) satisfies Db) : null;

function getDb(): Db {
  if (!db) throw new Error("Integration database unavailable — DATABASE_URL must be set");
  return db;
}

function uniqueEmail(): string {
  return `t015-${randomUUID()}@example.test`;
}
function uniquePlate(): string {
  return `T${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}
function uniqueNombre(): string {
  return `Svc ${randomUUID().slice(0, 8)}`;
}

describe("t015 customer-vehicle lifecycle (integration)", () => {
  const d = it.skipIf(!databaseUrl);

  const createdClienteIds: string[] = [];
  const createdVehiculoIds: string[] = [];
  const createdServicioIds: string[] = [];

  let clienteAId = "";
  let clienteAEmail = "";
  let clienteBId = "";
  let clienteBEmail = "";
  let vehicleA!: VehiculoDTO;

  afterAll(async () => {
    if (!pool) return;
    if (createdVehiculoIds.length) {
      await pool.query(`DELETE FROM vehiculos WHERE id = ANY($1::uuid[])`, [createdVehiculoIds]);
    }
    if (createdServicioIds.length) {
      await pool.query(`DELETE FROM servicios WHERE id = ANY($1::uuid[])`, [createdServicioIds]);
    }
    if (createdClienteIds.length) {
      await pool.query(`DELETE FROM clientes WHERE id = ANY($1::uuid[])`, [createdClienteIds]);
      await pool.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [
        [clienteAEmail, clienteBEmail].filter(Boolean),
      ]);
    }
    await pool.end();
  });

  d("1 create customer — DTO with 5 fields, no password leak", async () => {
    const dto = await createCustomer(getDb(), {
      nombre: "Ana",
      apellido: "Garcia",
      telefono: "+54 11 1234-5678",
      email: uniqueEmail(),
      password: "Secret12345",
    });
    clienteAId = dto.id;
    clienteAEmail = dto.email;
    createdClienteIds.push(dto.id);
    expect(dto).toHaveProperty("id");
    expect(dto).not.toHaveProperty("password");
    expect(dto).not.toHaveProperty("passwordHash");
    expect(dto.email).toBe(dto.email.toLowerCase());
  });

  d("2 create vehicle — DTO English keys, no marca/patente leak, plate normalized", async () => {
    if (!clienteAId) throw new Error("clienteA not seeded");
    const plate = uniquePlate();
    const dto = await createVehicle(getDb(), {
      customerId: clienteAId,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      plate: ` ${plate.toLowerCase()} `,
    });
    vehicleA = dto;
    createdVehiculoIds.push(dto.id);
    expect(dto.brand).toBe("Toyota");
    expect(dto.plate).toBe(plate);
    expect(dto.plate).toBe(dto.plate.toUpperCase());
    expect(dto.customerId).toBe(clienteAId);
    expect(dto).toHaveProperty("brand");
    expect(dto).toHaveProperty("plate");
    expect(dto).toHaveProperty("customerId");
    expect(dto).not.toHaveProperty("marca");
    expect(dto).not.toHaveProperty("patente");
    expect(dto).not.toHaveProperty("clienteId");
  });

  d("3 associate vehicle to customer — FK and list contains vehicle", async () => {
    const list = await listVehiclesByCustomer(getDb(), clienteAId);
    expect(list.map((v) => v.id)).toContain(vehicleA.id);
    expect(list.find((v) => v.id === vehicleA.id)?.customerId).toBe(clienteAId);
  });

  d("4 list vehicles returns English keys, DTO leak guards, UTC stored as TIMESTAMPTZ", async () => {
    const plate = uniquePlate();
    const [row] = await getDb()
      .insert(vehiculos)
      .values({
        clienteId: clienteAId,
        marca: "Renault",
        modelo: "Kangoo",
        anio: 2019,
        patente: plate,
        createdAt: new Date("2026-08-25T10:00:00-03:00"),
      })
      .returning();
    createdVehiculoIds.push(row!.id);
    expect(row!.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");

    const list = await listVehiclesByCustomer(getDb(), clienteAId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const v of list) {
      expect(v).toHaveProperty("brand");
      expect(v).toHaveProperty("plate");
      expect(v).toHaveProperty("customerId");
      expect(v).not.toHaveProperty("marca");
      expect(v).not.toHaveProperty("patente");
      expect(v).not.toHaveProperty("clienteId");
      expect(v.createdAt).toBeInstanceOf(Date);
    }
  });

  d("5 non-existent vehicle returns null", async () => {
    const miss = await getVehicleById(getDb(), randomUUID());
    expect(miss).toBeNull();
  });

  d("6 H-13 vehiculo ajeno → FORBIDDEN 403 via guard", async () => {
    const dtoB = await createCustomer(getDb(), {
      nombre: "Bruno",
      apellido: "Lopez",
      telefono: "+54 11 9999-8888",
      email: uniqueEmail(),
      password: "Secret12345",
    });
    clienteBId = dtoB.id;
    clienteBEmail = dtoB.email;
    createdClienteIds.push(dtoB.id);

    const servicioActivo = await createServicio(getDb(), {
      name: uniqueNombre(),
      durationMinutes: 60,
      active: true,
    });
    createdServicioIds.push(servicioActivo.id);

    const authUserB = { id: clienteBId, email: clienteBEmail, role: "CLIENTE" as const };
    expect(() => assertCanCreateAppointment(vehicleA, servicioActivo, authUserB)).toThrow(ForbiddenError);
    try {
      assertCanCreateAppointment(vehicleA, servicioActivo, authUserB);
    } catch (e) {
      expect((e as ForbiddenError).code).toBe("FORBIDDEN");
      expect((e as ForbiddenError).status).toBe(403);
    }

    const authAdmin = { id: randomUUID(), email: "admin@test.test", role: "ADMINISTRADOR" as const };
    expect(() => assertCanCreateAppointment(vehicleA, servicioActivo, authAdmin)).not.toThrow();
  });

  d("7 H-13 servicio inactivo → 400 INVALID_SERVICE via guard + activeOnly filtering", async () => {
    const inactivo = await createServicio(getDb(), {
      name: uniqueNombre(),
      durationMinutes: 60,
      active: false,
    });
    createdServicioIds.push(inactivo.id);

    const activo = await createServicio(getDb(), {
      name: uniqueNombre(),
      durationMinutes: 30,
      active: true,
    });
    createdServicioIds.push(activo.id);

    const authOwner = { id: clienteAId, email: clienteAEmail, role: "CLIENTE" as const };
    expect(() => assertCanCreateAppointment(vehicleA, inactivo, authOwner)).toThrow(InvalidServiceError);
    try {
      assertCanCreateAppointment(vehicleA, inactivo, authOwner);
    } catch (e) {
      expect((e as InvalidServiceError).code).toBe("INVALID_SERVICE");
    }

    const onlyActive = await listServicios(getDb(), { activeOnly: true });
    expect(onlyActive.map((s) => s.id)).not.toContain(inactivo.id);
    expect(onlyActive.map((s) => s.id)).toContain(activo.id);
    const all = await listServicios(getDb(), { activeOnly: false });
    expect(all.map((s) => s.id)).toContain(inactivo.id);
    expect(all.map((s) => s.id)).toContain(activo.id);
  });

  if (!databaseUrl) {
    it.skip("skipped: DATABASE_URL not set — integration tests require PG16 + pnpm db:migrate", () => {});
  }
});
