import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

// RED: these modules do NOT exist yet before GREEN — tests must fail
import { turnos } from "@/db/schema";
import type { TurnoRow } from "@/db/schema";
import { turnoInputSchema } from "@/db/validators/turno";
import { toTurnoDTO } from "@/db/mappers/turno";

function tableConfig() {
  return getTableConfig(turnos);
}

function columnsByName() {
  const config = tableConfig();
  expect(config.name).toBe("turnos");
  return new Map(config.columns.map((column) => [column.name, column]));
}

describe("turnos table shape (R1)", () => {
  it("is named 'turnos' with exactly the spec'd columns", () => {
    const config = tableConfig();
    expect(config.name).toBe("turnos");
    const names = config.columns.map((c) => c.name).sort();
    expect(names).toEqual([
      "cliente_id",
      "created_at",
      "estado",
      "fecha_hora_fin",
      "fecha_hora_inicio",
      "id",
      "servicio_id",
      "updated_at",
      "vehiculo_id",
    ]);
  });

  it("defines id as uuid primary key with random default", () => {
    const id = columnsByName().get("id");
    expect(id).toBeDefined();
    expect(id?.columnType).toBe("PgUUID");
    expect(id?.primary).toBe(true);
    expect(id?.hasDefault).toBe(true);
  });

  it("defines FK columns as uuid NOT NULL (cliente_id, vehiculo_id, servicio_id)", () => {
    for (const name of ["cliente_id", "vehiculo_id", "servicio_id"]) {
      const col = columnsByName().get(name);
      expect(col, name).toBeDefined();
      expect(col?.columnType).toBe("PgUUID");
      expect(col?.notNull).toBe(true);
    }
  });

  it("defines fecha_hora_inicio/fin as TIMESTAMPTZ NOT NULL with withTimezone:true (INV-06)", () => {
    for (const name of ["fecha_hora_inicio", "fecha_hora_fin"]) {
      const col = columnsByName().get(name);
      expect(col, name).toBeDefined();
      expect(col?.columnType).toBe("PgTimestamp");
      expect((col as { withTimezone?: boolean }).withTimezone).toBe(true);
      expect(col?.notNull).toBe(true);
    }
  });

  it("defines estado as varchar(20) NOT NULL", () => {
    const estado = columnsByName().get("estado");
    expect(estado).toBeDefined();
    expect(estado?.columnType).toBe("PgVarchar");
    expect((estado as { length?: number }).length).toBe(20);
    expect(estado?.notNull).toBe(true);
  });

  it("defines created_at/updated_at as TIMESTAMPTZ NOT NULL with defaults (INV-06)", () => {
    for (const name of ["created_at", "updated_at"]) {
      const col = columnsByName().get(name);
      expect(col, name).toBeDefined();
      expect(col?.columnType).toBe("PgTimestamp");
      expect((col as { withTimezone?: boolean }).withTimezone).toBe(true);
      expect(col?.notNull).toBe(true);
      expect(col?.hasDefault).toBe(true);
    }
  });

  it("attaches $onUpdate touch to updated_at only", () => {
    const updatedAt = columnsByName().get("updated_at");
    const createdAt = columnsByName().get("created_at");
    expect(typeof (updatedAt as { onUpdateFn?: unknown }).onUpdateFn).toBe(
      "function",
    );
    expect((createdAt as { onUpdateFn?: unknown }).onUpdateFn).toBeUndefined();
    // fecha columns must NOT have onUpdate
    expect(
      (columnsByName().get("fecha_hora_inicio") as { onUpdateFn?: unknown })
        .onUpdateFn,
    ).toBeUndefined();
    expect(
      (columnsByName().get("fecha_hora_fin") as { onUpdateFn?: unknown })
        .onUpdateFn,
    ).toBeUndefined();
  });

  it("defines 4 btree indexes (idx_turno_*)", () => {
    const schemaSource = readFileSync(
      resolve(__dirname, "../schema.ts"),
      "utf8",
    );
    expect(schemaSource).toMatch(/idx_turno_cliente_id/);
    expect(schemaSource).toMatch(/idx_turno_vehiculo_id/);
    expect(schemaSource).toMatch(/idx_turno_servicio_id/);
    expect(schemaSource).toMatch(/idx_turno_fecha_hora_inicio/);
    // btree is default method — verify migration uses btree
    expect(schemaSource).toMatch(/index\(/);
  });
});

describe("toTurnoDTO mapper (R5 INV-08)", () => {
  const row = (): TurnoRow => ({
    id: "11111111-1111-4111-8111-111111111111",
    clienteId: "22222222-2222-4222-8222-222222222222",
    vehiculoId: "33333333-3333-4333-8333-333333333333",
    servicioId: "44444444-4444-4444-8444-444444444444",
    fechaHoraInicio: new Date("2026-05-10T12:00:00.000Z"),
    fechaHoraFin: new Date("2026-05-10T13:00:00.000Z"),
    estado: "PENDIENTE",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T13:00:00.000Z"),
  });

  it("maps DB Spanish/snake_case to English DTO with no leakage", () => {
    const dto = toTurnoDTO(row());
    expect(dto).toEqual({
      id: row().id,
      customerId: row().clienteId,
      vehicleId: row().vehiculoId,
      serviceId: row().servicioId,
      startDateTime: row().fechaHoraInicio,
      endDateTime: row().fechaHoraFin,
      status: row().estado,
      createdAt: row().createdAt,
      updatedAt: row().updatedAt,
    });
    // no snake_case / Spanish leakage
    expect(dto).not.toHaveProperty("cliente_id");
    expect(dto).not.toHaveProperty("clienteId");
    expect(dto).not.toHaveProperty("vehiculo_id");
    expect(dto).not.toHaveProperty("servicio_id");
    expect(dto).not.toHaveProperty("fecha_hora_inicio");
    expect(dto).not.toHaveProperty("fecha_hora_fin");
    expect(dto).not.toHaveProperty("estado");
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
    // english keys present
    expect(dto).toHaveProperty("customerId");
    expect(dto).toHaveProperty("vehicleId");
    expect(dto).toHaveProperty("serviceId");
    expect(dto).toHaveProperty("startDateTime");
    expect(dto).toHaveProperty("endDateTime");
    expect(dto).toHaveProperty("status");
  });

  it("preserves values for different estado and times (triangulation)", () => {
    const source = row();
    source.estado = "CONFIRMADO";
    source.fechaHoraInicio = new Date("2026-05-11T14:00:00.000Z");
    source.fechaHoraFin = new Date("2026-05-11T15:30:00.000Z");
    const dto = toTurnoDTO(source);
    expect(dto.status).toBe("CONFIRMADO");
    expect(dto.startDateTime).toBe(source.fechaHoraInicio);
    expect(dto.endDateTime).toBe(source.fechaHoraFin);
    expect(dto.customerId).toBe(source.clienteId);
  });
});

describe("turnoInputSchema validator (R3,R4)", () => {
  const validBase = () => ({
    clienteId: "22222222-2222-4222-8222-222222222222",
    vehiculoId: "33333333-3333-4333-8333-333333333333",
    servicioId: "44444444-4444-4444-8444-444444444444",
    fechaHoraInicio: new Date("2026-05-10T09:00:00-03:00"),
    fechaHoraFin: new Date("2026-05-10T10:00:00-03:00"),
    estado: "PENDIENTE" as const,
  });

  it("accepts valid estado values PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO", () => {
    for (const estado of [
      "PENDIENTE",
      "CONFIRMADO",
      "RECHAZADO",
      "CANCELADO",
    ] as const) {
      const parsed = turnoInputSchema.parse({ ...validBase(), estado });
      expect(parsed.estado).toBe(estado);
    }
  });

  it("rejects invalid estado COMPLETADO/lowercase/trailing space", () => {
    for (const estado of ["COMPLETADO", "pendiente", "CONFIRMADO "] as const) {
      expect(
        () => turnoInputSchema.parse({ ...validBase(), estado }),
        estado,
      ).toThrow();
    }
  });

  it("rejects non-uuid FKs", () => {
    expect(() =>
      turnoInputSchema.parse({ ...validBase(), clienteId: "not-uuid" }),
    ).toThrow();
    expect(() =>
      turnoInputSchema.parse({ ...validBase(), vehiculoId: "123" }),
    ).toThrow();
    expect(() =>
      turnoInputSchema.parse({ ...validBase(), servicioId: "" }),
    ).toThrow();
  });

  it("rejects inverted interval fechaHoraFin <= fechaHoraInicio", () => {
    const start = new Date("2026-05-10T10:00:00.000Z");
    expect(() =>
      turnoInputSchema.parse({
        ...validBase(),
        fechaHoraInicio: start,
        fechaHoraFin: start,
      }),
    ).toThrow();
    expect(() =>
      turnoInputSchema.parse({
        ...validBase(),
        fechaHoraInicio: start,
        fechaHoraFin: new Date("2026-05-10T09:00:00.000Z"),
      }),
    ).toThrow();
  });

  it("accepts valid interval where end > start", () => {
    const parsed = turnoInputSchema.parse(validBase());
    expect(parsed.fechaHoraFin.getTime()).toBeGreaterThan(
      parsed.fechaHoraInicio.getTime(),
    );
  });
});

describe("t008 negative scope guards (R7)", () => {
  it("schema has no CHECK/EXCLUDE/btree_gist/canTransition/WorkshopConfig", () => {
    const schemaSource = readFileSync(
      resolve(__dirname, "../schema.ts"),
      "utf8",
    );
    expect(schemaSource).not.toMatch(/CHECK.*estado/i);
    expect(schemaSource).not.toMatch(/CHECK.*fecha_hora/i);
    expect(schemaSource).not.toMatch(/EXCLUDE.*gist/i);
    expect(schemaSource).not.toMatch(/btree_gist/i);
    expect(schemaSource).not.toMatch(/canTransition/);
    expect(schemaSource).not.toMatch(/WorkshopConfig/);
  });

  it("validator uses z.enum strict and refine interval (no DB CHECK)", () => {
    const validatorSource = readFileSync(
      resolve(__dirname, "../validators/turno.ts"),
      "utf8",
    );
    expect(validatorSource).toMatch(/z\.enum/);
    expect(validatorSource).toMatch(/PENDIENTE/);
    expect(validatorSource).toMatch(/refine/);
    expect(validatorSource).not.toMatch(/pgEnum/);
  });

  it("ships no HTTP route under src/app/api for turnos and no services layer", () => {
    const apiDir = resolve(__dirname, "../../app/api");
    let entries: string[] = [];
    try {
      entries = readdirSync(apiDir, { recursive: true }).map(String);
    } catch {
      // no api directory
    }
    const turnoRoutes = entries.filter((entry) =>
      entry.replaceAll("\\", "/").includes("turnos"),
    );
    expect(turnoRoutes).toEqual([]);
    const servicesDir = resolve(__dirname, "../services");
    expect(existsSync(servicesDir)).toBe(false);
  });

  it("migration and journal checks deferred to integration, but schema file not leaked", () => {
    const schemaSource = readFileSync(
      resolve(__dirname, "../schema.ts"),
      "utf8",
    );
    // single-barrel must export turnos
    expect(schemaSource).toMatch(/export const turnos/);
    expect(schemaSource).not.toMatch(/api\/turnos/);
  });
});
