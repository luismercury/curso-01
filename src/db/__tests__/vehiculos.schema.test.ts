import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

// Production modules under test.
import { vehiculos } from "@/db/schema";
import type { VehiculoRow } from "@/db/schema";
import { normalizePatente, vehiculoInputSchema } from "@/db/validators/vehiculo";
import { toVehiculoDTO } from "@/db/mappers/vehiculo";

function tableConfig() {
  return getTableConfig(vehiculos);
}

function columnsByName() {
  const config = tableConfig();
  expect(config.name).toBe("vehiculos");
  return new Map(config.columns.map((column) => [column.name, column]));
}

describe("vehiculos table shape (REQ-VEH-01)", () => {
  it("is named 'vehiculos' with exactly the spec'd columns", () => {
    const config = tableConfig();
    expect(config.name).toBe("vehiculos");
    const names = config.columns.map((c) => c.name).sort();
    // INV-08: snake_case DB columns; column `anio` (domain `año`).
    expect(names).toEqual([
      "anio",
      "cliente_id",
      "created_at",
      "id",
      "marca",
      "modelo",
      "patente",
      "updated_at",
    ]);
  });

  it("defines id as uuid primary key with random default", () => {
    const id = columnsByName().get("id");
    expect(id).toBeDefined();
    expect(id?.columnType).toBe("PgUUID");
    expect(id?.primary).toBe(true);
    expect(id?.hasDefault).toBe(true); // gen_random_uuid()
  });

  it("defines cliente_id as uuid NOT NULL FK to clientes.id RESTRICT (D2)", () => {
    const clienteId = columnsByName().get("cliente_id");
    expect(clienteId).toBeDefined();
    expect(clienteId?.columnType).toBe("PgUUID");
    expect(clienteId?.notNull).toBe(true);

    const foreignKeys = tableConfig().foreignKeys;
    expect(foreignKeys).toHaveLength(1);
    const fk = foreignKeys[0]!;
    expect(fk.onDelete).toBe("restrict");
    // The FK references the clientes table's id column.
    const reference = fk.reference();
    expect(getTableConfig(reference.foreignTable).name).toBe("clientes");
    expect(reference.foreignColumns.map((column) => column.name)).toEqual([
      "id",
    ]);
  });

  it("defines marca/modelo as varchar(100) NOT NULL", () => {
    for (const name of ["marca", "modelo"]) {
      const column = columnsByName().get(name);
      expect(column, name).toBeDefined();
      expect(column?.columnType).toBe("PgVarchar");
      expect((column as { length?: number }).length).toBe(100);
      expect(column?.notNull).toBe(true);
    }
  });

  it("defines anio as integer NOT NULL", () => {
    const anio = columnsByName().get("anio");
    expect(anio).toBeDefined();
    expect(anio?.columnType).toBe("PgInteger");
    expect(anio?.notNull).toBe(true);
  });

  it("defines patente as varchar(7) NOT NULL UNIQUE (global)", () => {
    const patente = columnsByName().get("patente");
    expect(patente).toBeDefined();
    expect(patente?.columnType).toBe("PgVarchar");
    expect((patente as { length?: number }).length).toBe(7);
    expect(patente?.notNull).toBe(true);
    expect(patente?.isUnique).toBe(true);
  });

  it("defines created_at/updated_at as TIMESTAMPTZ NOT NULL with defaults (INV-06)", () => {
    for (const name of ["created_at", "updated_at"]) {
      const column = columnsByName().get(name);
      expect(column, name).toBeDefined();
      expect(column?.columnType).toBe("PgTimestamp");
      expect((column as { withTimezone?: boolean }).withTimezone).toBe(true);
      expect(column?.notNull).toBe(true);
      expect(column?.hasDefault).toBe(true); // now()
    }
  });

  it("attaches $onUpdate touch to updated_at only", () => {
    const updatedAt = columnsByName().get("updated_at");
    const createdAt = columnsByName().get("created_at");
    expect(typeof (updatedAt as { onUpdateFn?: unknown }).onUpdateFn).toBe(
      "function",
    );
    expect((createdAt as { onUpdateFn?: unknown }).onUpdateFn).toBeUndefined();
  });

  it("declares the explicit idx_vehiculo_cliente_id index (D2)", () => {
    const indexes = tableConfig().indexes;
    const indexNames = indexes.map(
      (index) => (index.config as { name?: string }).name,
    );
    expect(indexNames).toContain("idx_vehiculo_cliente_id");
  });
});

describe("toVehiculoDTO mapper (REQ-VEH-04)", () => {
  const row = (): VehiculoRow => ({
    id: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    clienteId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    marca: "Toyota",
    modelo: "Corolla",
    anio: 2020,
    patente: "ABC123",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  });

  it("maps Spanish DB names to English DTO keys with no snake_case leakage", () => {
    const dto = toVehiculoDTO(row());
    expect(dto).toEqual({
      id: row().id,
      customerId: row().clienteId,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      plate: "ABC123",
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    // INV-08: no raw DB names leak to the API boundary.
    expect(dto).not.toHaveProperty("marca");
    expect(dto).not.toHaveProperty("modelo");
    expect(dto).not.toHaveProperty("anio");
    expect(dto).not.toHaveProperty("patente");
    expect(dto).not.toHaveProperty("cliente_id");
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
  });

  it("preserves values and Date references for a different row (triangulation)", () => {
    const source = row();
    source.marca = "Ford";
    source.modelo = "Ranger";
    source.anio = 2026;
    source.patente = "AB123CD";
    const dto = toVehiculoDTO(source);
    expect(dto.brand).toBe("Ford");
    expect(dto.model).toBe("Ranger");
    expect(dto.year).toBe(2026);
    expect(dto.plate).toBe("AB123CD");
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.createdAt).toBe(source.createdAt); // same reference, not a copy
  });
});

describe("normalizePatente (REQ-VEH-02 / D3)", () => {
  it("trims, uppercases and strips spaces/hyphens", () => {
    expect(normalizePatente(" abc-123 ")).toBe("ABC123");
    expect(normalizePatente("ab c123")).toBe("ABC123");
    expect(normalizePatente("abc123")).toBe("ABC123");
  });

  it("normalizes 7-character formats and leaves other characters intact", () => {
    expect(normalizePatente("ab 123 cd")).toBe("AB123CD");
    expect(normalizePatente("AB-1-2-3")).toBe("AB123");
    // Only spaces/hyphens are stripped; other characters pass through.
    expect(normalizePatente("ab@12")).toBe("AB@12");
  });
});

describe("vehiculoInputSchema validator (REQ-VEH-02)", () => {
  const currentYear = new Date().getFullYear();
  // Validator operates on Spanish domain keys (INV-08: English renaming is
  // the mapper/repo boundary's job, not the validator's).
  const validInput = () => ({
    clienteId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    marca: "Toyota",
    modelo: "Corolla",
    anio: 2020,
    patente: " abc-123 ",
  });

  it("accepts a valid input and normalizes patente via transform", () => {
    const parsed = vehiculoInputSchema.parse(validInput());
    expect(parsed.patente).toBe("ABC123");
    expect(parsed.marca).toBe("Toyota");
    expect(parsed.modelo).toBe("Corolla");
  });

  it("accepts anio at the bounds 1900 and currentYear+1 (D7)", () => {
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), anio: 1900 }),
    ).not.toThrow();
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), anio: currentYear + 1 }),
    ).not.toThrow();
  });

  it("rejects anio below 1900, above currentYear+1, or non-integer", () => {
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), anio: 1899 }),
    ).toThrow();
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), anio: currentYear + 2 }),
    ).toThrow();
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), anio: 1999.5 }),
    ).toThrow();
  });

  it("rejects invalid patente formats after normalization", () => {
    for (const patente of ["AB12", "ABCDEFGH", "AB@123", ""]) {
      expect(
        () => vehiculoInputSchema.parse({ ...validInput(), patente }),
        `patente "${patente}"`,
      ).toThrow();
    }
  });

  it("rejects marca/modelo shorter than 2 chars and bad uuids", () => {
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), marca: "T" }),
    ).toThrow();
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), modelo: "M" }),
    ).toThrow();
    expect(() =>
      vehiculoInputSchema.parse({ ...validInput(), clienteId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("vehiculos repository negative scope (REQ-VEH-03 / D5)", () => {
  it("exposes no ownership-transfer path — clienteId is immutable by absence", () => {
    const source = readFileSync(
      resolve(__dirname, "../repositories/vehiculos.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/update|transfer|setClienteId/i);
  });
});

describe("t006 negative scope guards (REQ-VEH-06)", () => {
  it("ships no HTTP route under src/app/api for vehicles", () => {
    const apiDir = resolve(__dirname, "../../app/api");
    let entries: string[] = [];
    try {
      entries = readdirSync(apiDir, { recursive: true }).map(String);
    } catch {
      // No api directory at all — also zero matches.
    }
    const vehicleRoutes = entries.filter((entry) =>
      entry.replaceAll("\\\\", "/").includes("vehicles"),
    );
    expect(vehicleRoutes).toEqual([]);
  });

  it("has no VehicleService anywhere in src/ (deferred to T-012)", () => {
    expect(existsSync(resolve(__dirname, "../services"))).toBe(false);
  });

  it("defines no soft-delete column in the schema (deletedAt)", () => {
    const source = readFileSync(resolve(__dirname, "../schema.ts"), "utf8");
    expect(source).not.toContain("deletedAt");
    expect(source).not.toContain("deleted_at");
  });
});
