import "dotenv/config";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import {
  createCliente,
  findClienteById,
} from "@/db/repositories/clientes";
import type { ClienteDTO } from "@/db/mappers/cliente";
import {
  createVehiculo,
  findVehiculoByPatente,
  findVehiculoById,
  findVehiculosByClienteId,
  VehiculoClienteNotFoundError,
  VehiculoPatenteTakenError,
} from "@/db/repositories/vehiculos";
import { vehiculos } from "@/db/schema";

/**
 * Integration tier (REQ-VEH-05): requires DATABASE_URL pointing at the
 * compose PG16 with `pnpm db:migrate` applied. Skips with a clear message
 * otherwise; never fails without a database.
 *
 * RSK-08: reads process.env.DATABASE_URL directly — never imports the
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

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deterministic uniqueness per run — parallel-safe, crash-tolerant. */
function uniquePlate(): string {
  return `T${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

async function seedCliente(nombre: string): Promise<ClienteDTO> {
  return createCliente(getDb(), {
    nombre,
    apellido: "García",
    telefono: "+54 11 1234-5678",
    email: `${nombre.toLowerCase()}-${randomUUID()}@example.test`,
  });
}

describe("vehiculos repository (integration)", () => {
  const d = it.skipIf(!databaseUrl);

  // Track created rows so teardown respects FK RESTRICT order:
  // vehiculos rows must be deleted before their clientes.
  const createdVehiculoIds: string[] = [];
  const createdClienteIds: string[] = [];

  async function trackVehiculo(plate: string) {
    const dto = await createVehiculo(getDb(), {
      customerId: cliente.id,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      plate,
    });
    createdVehiculoIds.push(dto.id);
    return dto;
  }

  let cliente!: ClienteDTO;
  let otherCliente!: ClienteDTO;

  d("seeds two clientes for FK scenarios", async () => {
    cliente = await seedCliente("Ana");
    otherCliente = await seedCliente("Bruno");
    createdClienteIds.push(cliente.id, otherCliente.id);
    expect(cliente.id).toMatch(uuidV4);
    expect(otherCliente.id).toMatch(uuidV4);
  });

  d("round-trips a normalized plate through insert/select (REQ-VEH-03)", async () => {
    const plate = uniquePlate(); // 7 chars, e.g. TAB12CD
    // Raw input is lowercase, spaced and hyphenated — still exactly 7
    // significant characters after normalization.
    const rawInput = ` ${plate.toLowerCase().replace(/^./, "$&-")} `;
    const created = await trackVehiculo(rawInput);
    const found = await findVehiculoById(getDb(), created.id);

    expect(found).not.toBeNull();
    // Raw input was lowercase/hyphenated/spaced; persisted value is uppercase
    // with separators stripped — normalization happened BEFORE the INSERT.
    expect(found!.plate).toBe(plate);
    expect(found!.plate).toBe(found!.plate.toUpperCase());
    expect(found!.customerId).toBe(cliente.id);
    expect(found!.brand).toBe("Toyota");
    expect(found!.model).toBe("Corolla");
    expect(found!.year).toBe(2020);
    expect(found!.createdAt).toBeInstanceOf(Date);
    expect(found!.updatedAt).toBeInstanceOf(Date);

    const byPlate = await findVehiculoByPatente(
      getDb(),
      ` ${plate.toLowerCase()}`,
    ); // finder normalizes its argument too
    expect(byPlate?.id).toBe(created.id);

    const byCustomer = await findVehiculosByClienteId(getDb(), cliente.id);
    expect(byCustomer.map((v) => v.id)).toContain(created.id);
  });

  d("throws VehiculoPatenteTakenError on global duplicate plate across clients", async () => {
    const plate = uniquePlate();
    await trackVehiculo(plate);

    // Different owner, same physical plate (raw form differs only by case/
    // spacing) → global UNIQUE violation mapped to a typed domain error.
    const outcome = await createVehiculo(getDb(), {
      customerId: otherCliente.id,
      brand: "Ford",
      model: "Ranger",
      year: 2024,
      plate: ` ${plate.toLowerCase()}`,
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(VehiculoPatenteTakenError);
    // The typed domain error wraps the original pg error on cause.
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

  d("throws VehiculoClienteNotFoundError on unknown customerId (FK RESTRICT)", async () => {
    const unknownCustomerId = randomUUID();

    const outcome = await createVehiculo(getDb(), {
      customerId: unknownCustomerId,
      brand: "Toyota",
      model: "Hilux",
      year: 2023,
      plate: uniquePlate(),
    }).then(
      () => null,
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(VehiculoClienteNotFoundError);
    let current: unknown = outcome;
    let pgCode: string | undefined;
    while (typeof current === "object" && current !== null && !pgCode) {
      pgCode = (current as { code?: string }).code;
      if (!pgCode) {
        current = (current as { cause?: unknown }).cause;
      }
    }
    expect(pgCode).toBe("23503");
  });

  d("stores TIMESTAMPTZ in UTC (-03:00 offset converted on write)", async () => {
    const plate = uniquePlate();
    const [row] = await getDb()
      .insert(vehiculos)
      .values({
        clienteId: cliente.id,
        marca: "Renault",
        modelo: "Kangoo",
        anio: 2019,
        patente: plate,
        createdAt: new Date("2026-08-25T10:00:00-03:00"),
      })
      .returning();
    createdVehiculoIds.push(row!.id);

    expect(row!.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");
  });

  d("information_schema: column types, NOT NULL, UNIQUE, FK RESTRICT, index", async () => {
    const result = await pool!.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'vehiculos'
        ORDER BY ordinal_position`,
    );

    expect(result.rows).toHaveLength(8);
    const columns = Object.fromEntries(
      result.rows.map((row) => [row.column_name, row]),
    );
    const column = (name: string) => {
      expect(columns[name], name).toBeDefined();
      return columns[name]!;
    };

    expect(column("id").data_type).toBe("uuid");
    expect(column("cliente_id").data_type).toBe("uuid");
    expect(column("marca").data_type).toBe("character varying");
    expect(column("modelo").data_type).toBe("character varying");
    expect(column("anio").data_type).toBe("integer");
    expect(column("patente").data_type).toBe("character varying");
    expect(column("created_at").data_type).toBe("timestamp with time zone");
    expect(column("updated_at").data_type).toBe("timestamp with time zone");

    for (const row of result.rows) {
      expect(row.is_nullable, row.column_name).toBe("NO");
    }

    // Global UNIQUE on patente.
    const unique = await pool!.query<{ constraint_type: string }>(
      `SELECT constraint_type FROM information_schema.table_constraints
        WHERE table_name = 'vehiculos' AND constraint_type = 'UNIQUE'`,
    );
    expect(unique.rows.length).toBeGreaterThanOrEqual(1);

    // FK RESTRICT on delete.
    const fk = await pool!.query<{ on_delete_action: string }>(
      `SELECT confdeltype::text AS on_delete_action
         FROM pg_constraint
        WHERE conrelid = 'vehiculos'::regclass AND contype = 'f'`,
    );
    expect(fk.rows).toHaveLength(1);
    // 'r' = RESTRICT in pg_constraint.confdeltype encoding.
    expect(fk.rows[0]!.on_delete_action).toBe("r");

    // Explicit index backing the FK column.
    const index = await pool!.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'vehiculos' AND indexname = 'idx_vehiculo_cliente_id'`,
    );
    expect(index.rows).toHaveLength(1);
  });

  d("$onUpdate bumps updated_at past created_at on write", async () => {
    const created = await trackVehiculo(uniquePlate());
    // Ensure wall-clock separation between INSERT and the second write.
    await new Promise((resolve) => setTimeout(resolve, 10));

    await getDb()
      .update(vehiculos)
      .set({ modelo: "Corolla Cross" })
      .where(eq(vehiculos.id, created.id));

    const found = await findVehiculoById(getDb(), created.id);
    expect(found?.model).toBe("Corolla Cross");
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
