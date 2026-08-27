import "dotenv/config";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Db } from "@/db";
import { turnos } from "@/db/schema";
import type { TurnoRow } from "@/db/schema";
import { toTurnoDTO } from "@/db/mappers/turno";
import {
  createTurno,
  findTurnoById,
  findTurnosByClienteId,
  TurnoForeignKeyError,
} from "@/db/repositories/turnos";
import { createCliente } from "@/db/repositories/clientes";
import { createVehiculo } from "@/db/repositories/vehiculos";
import { createServicio } from "@/db/repositories/servicios";

/**
 * Integration tier (R1,R2,R3,R6): requires DATABASE_URL pointing at compose PG16
 * with `pnpm db:migrate` applied. Skips when unset; uses direct Pool/drizzle
 * (never imports server-only env layer).
 */
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const db = pool ? (drizzle(pool) satisfies Db) : null;

function getDb(): Db {
  if (!db) {
    throw new Error("Integration database unavailable — DATABASE_URL must be set");
  }
  return db;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error("Integration database pool unavailable");
  }
  return pool;
}

function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

describe("turnos repository (integration)", () => {
  const d = it.skipIf(!databaseUrl);

  const createdTurnoIds: string[] = [];
  const createdVehiculoIds: string[] = [];
  const createdClienteIds: string[] = [];
  const createdServicioIds: string[] = [];

  async function seedPrerequisites(): Promise<{
    clienteId: string;
    vehiculoId: string;
    servicioId: string;
    servicioDuration: number;
  }> {
    const cliente = await createCliente(getDb(), {
      nombre: "Test",
      apellido: `User ${uniqueSuffix()}`,
      telefono: `+54 11 ${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      email: `test-${uniqueSuffix()}@example.test`,
    });
    createdClienteIds.push(cliente.id);

    const servicio = await createServicio(getDb(), {
      name: `Servicio ${uniqueSuffix()}`,
      durationMinutes: 60,
    });
    createdServicioIds.push(servicio.id);

    const vehiculo = await createVehiculo(getDb(), {
      customerId: cliente.id,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      plate: `${uniqueSuffix().slice(0, 3).toUpperCase()}${Math.floor(100 + Math.random() * 900).toString()}`,
    });
    createdVehiculoIds.push(vehiculo.id);

    return {
      clienteId: cliente.id,
      vehiculoId: vehiculo.id,
      servicioId: servicio.id,
      servicioDuration: servicio.durationMinutes,
    };
  }

  d("direct read without server-only import proves no server-only leakage (R6)", async () => {
    const result = await getPool().query("select 1 as ok");
    expect(result.rows[0]).toEqual({ ok: 1 });
  });

  d("snapshot: createTurno computes fechaHoraFin from servicio.durationMinutes (R3)", async () => {
    const { clienteId, vehiculoId, servicioId, servicioDuration } =
      await seedPrerequisites();
    const start = new Date("2026-05-10T09:00:00-03:00");
    const created = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: vehiculoId,
      serviceId: servicioId,
      startDateTime: start,
      status: "PENDIENTE",
    });
    createdTurnoIds.push(created.id);

    // DTO snapshot
    expect(created.customerId).toBe(clienteId);
    expect(created.vehicleId).toBe(vehiculoId);
    expect(created.serviceId).toBe(servicioId);
    expect(created.status).toBe("PENDIENTE");
    // end = start + duration (60min)
    const expectedEnd = new Date(start.getTime() + servicioDuration * 60_000);
    expect(created.endDateTime.getTime()).toBe(expectedEnd.getTime());
    expect(created.startDateTime.getTime()).toBe(start.getTime());

    // DB re-read confirms UTC storage
    const reRead = await findTurnoById(getDb(), created.id);
    expect(reRead).not.toBeNull();
    expect(reRead!.startDateTime.toISOString()).toBe(start.toISOString());
    // start was -03:00, stored as UTC Z, re-read equals original instant
    expect(reRead!.endDateTime.getTime()).toBe(expectedEnd.getTime());
    // DTO mapping check
    expect(reRead).not.toHaveProperty("cliente_id");
    expect(reRead).toHaveProperty("customerId");
  });

  d("stores TIMESTAMPTZ in UTC (-03:00 offset converted on write) (R1,R6)", async () => {
    const { clienteId, vehiculoId, servicioId } = await seedPrerequisites();
    const start = new Date("2026-05-10T14:00:00-03:00"); // 17:00Z
    const created = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: vehiculoId,
      serviceId: servicioId,
      startDateTime: start,
      status: "CONFIRMADO",
    });
    createdTurnoIds.push(created.id);
    expect(created.startDateTime.toISOString()).toBe("2026-05-10T17:00:00.000Z");

    // raw query to verify DB stores with timezone
    const raw = await getPool().query<{ fecha_hora_inicio: Date }>(
      "SELECT fecha_hora_inicio FROM turnos WHERE id = $1",
      [created.id],
    );
    expect(raw.rows[0]!.fecha_hora_inicio.toISOString()).toBe(
      "2026-05-10T17:00:00.000Z",
    );
  });

  d("FK RESTRICT enforced — delete parent cliente rejected with 23503 (R2)", async () => {
    const { clienteId, vehiculoId, servicioId } = await seedPrerequisites();
    const created = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: vehiculoId,
      serviceId: servicioId,
      startDateTime: new Date("2026-05-11T09:00:00-03:00"),
      status: "PENDIENTE",
    });
    createdTurnoIds.push(created.id);

    const outcome = await getPool()
      .query("DELETE FROM clientes WHERE id = $1", [clienteId])
      .then(
        () => null,
        (error: unknown) => error,
      );
    // should fail with FK violation
    expect(outcome).not.toBeNull();
    // hasPgCode chain should contain 23503
    let current: unknown = outcome;
    let code: string | undefined;
    while (typeof current === "object" && current !== null && !code) {
      code = (current as { code?: string }).code;
      if (!code) {
        current = (current as { cause?: unknown }).cause;
      }
    }
    expect(code).toBe("23503");
  });

  d("unknown FK (random UUID) rejected with 23503 via hasPgCode (R2)", async () => {
    const { clienteId, servicioId } = await seedPrerequisites();
    // Use random vehiculoId that does not exist, but cliente/servicio valid
    const fakeVehiculoId = randomUUID();
    const outcome = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: fakeVehiculoId,
      serviceId: servicioId,
      startDateTime: new Date("2026-05-12T09:00:00-03:00"),
      status: "PENDIENTE",
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(outcome).toBeInstanceOf(TurnoForeignKeyError);
    let current: unknown = outcome;
    let code: string | undefined;
    while (typeof current === "object" && current !== null && !code) {
      code = (current as { code?: string }).code;
      if (!code) {
        current = (current as { cause?: unknown }).cause;
      }
    }
    expect(code).toBe("23503");
  });

  d("indexes present and btree (R2,R6)", async () => {
    const result = await getPool().query<{
      indexname: string;
      indexdef: string;
    }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'turnos' ORDER BY indexname",
    );
    const names = result.rows
      .map((r) => r.indexname)
      .filter((n) => n.startsWith("idx_turno_"))
      .sort();
    expect(names).toEqual([
      "idx_turno_cliente_id",
      "idx_turno_fecha_hora_inicio",
      "idx_turno_servicio_id",
      "idx_turno_vehiculo_id",
    ]);
    for (const row of result.rows) {
      if (row.indexname.startsWith("idx_turno_")) {
        expect(row.indexdef).toMatch(/btree/i);
      }
    }
  });

  d("information_schema column types and NOT NULL (R1,R2)", async () => {
    const result = await getPool().query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'turnos' ORDER BY ordinal_position",
    );
    expect(result.rows.length).toBe(9);
    const cols = Object.fromEntries(
      result.rows.map((r) => [r.column_name, r]),
    );
    const col = (name: string) => {
      expect(cols[name], name).toBeDefined();
      return cols[name]!;
    };
    expect(col("id").data_type).toBe("uuid");
    expect(col("cliente_id").data_type).toBe("uuid");
    expect(col("vehiculo_id").data_type).toBe("uuid");
    expect(col("servicio_id").data_type).toBe("uuid");
    expect(col("fecha_hora_inicio").data_type).toBe(
      "timestamp with time zone",
    );
    expect(col("fecha_hora_fin").data_type).toBe("timestamp with time zone");
    expect(col("estado").data_type).toBe("character varying");
    expect(col("created_at").data_type).toBe("timestamp with time zone");
    expect(col("updated_at").data_type).toBe("timestamp with time zone");
    for (const name of [
      "id",
      "cliente_id",
      "vehiculo_id",
      "servicio_id",
      "fecha_hora_inicio",
      "fecha_hora_fin",
      "estado",
      "created_at",
      "updated_at",
    ]) {
      expect(col(name).is_nullable).toBe("NO");
    }
  });

  d("DTO mapping via findTurnoById and findTurnosByClienteId (R5)", async () => {
    const { clienteId, vehiculoId, servicioId } = await seedPrerequisites();
    const start = new Date("2026-05-13T09:00:00-03:00");
    const created = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: vehiculoId,
      serviceId: servicioId,
      startDateTime: start,
      status: "RECHAZADO",
    });
    createdTurnoIds.push(created.id);

    const byId = await findTurnoById(getDb(), created.id);
    expect(byId).not.toBeNull();
    expect(byId!.id).toBe(created.id);
    expect(byId!.status).toBe("RECHAZADO");

    const byCliente = await findTurnosByClienteId(getDb(), clienteId);
    expect(byCliente.map((t) => t.id)).toContain(created.id);
    // ensure mapper doesn't leak
    for (const dto of byCliente) {
      expect(dto).not.toHaveProperty("cliente_id");
      expect(dto).not.toHaveProperty("estado");
      expect(dto).toHaveProperty("customerId");
      expect(dto).toHaveProperty("status");
    }
  });

  d("estado validation via repo — invalid status rejected by Zod", async () => {
    const { clienteId, vehiculoId, servicioId } = await seedPrerequisites();
    const outcome = await createTurno(getDb(), {
      customerId: clienteId,
      vehicleId: vehiculoId,
      serviceId: servicioId,
      startDateTime: new Date("2026-05-14T09:00:00-03:00"),
      status: "COMPLETADO" as unknown as "PENDIENTE",
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(outcome).not.toBeNull();
    // ZodError
    expect((outcome as { name?: string }).name).toBe("ZodError");
  });

  d("migration is sequential idx 4 with btree_gist/EXCLUDE/CHECK (R6,R7 t009)", async () => {
    const journal = JSON.parse(
      readFileSync(resolve("drizzle/meta/_journal.json"), "utf8"),
    );
    expect(journal.entries).toHaveLength(5);
    const entry = journal.entries.find(
      (e: { idx: number }) => e.idx === 4,
    );
    expect(entry).toBeDefined();
    expect(entry.tag).toMatch(/^0004_/);
    const sqlFiles = readdirSync("drizzle").filter((f) => f.endsWith(".sql"));
    const fileForIdx4 = sqlFiles.find((f) => f.startsWith("0004_"));
    expect(fileForIdx4).toBeDefined();
    const sql = readFileSync(resolve("drizzle", fileForIdx4!), "utf8");
    expect(sql).toMatch(/turnos/);
    expect(sql).toMatch(/btree_gist/i);
    expect(sql).toMatch(/EXCLUDE.*gist/i);
    expect(sql).toMatch(/CHECK.*estado/i);
    expect(sql).toMatch(/CHECK.*fecha_hora/i);
    expect(sql).toMatch(/no_overlap_per_capacity/);
    expect(sql).toMatch(/tstzrange/);
  });

  if (!databaseUrl) {
    it.skip(
      "skipped: DATABASE_URL is not set — copy .env.example to .env, run docker compose up -d and pnpm db:migrate",
      () => {},
    );
  }
});
