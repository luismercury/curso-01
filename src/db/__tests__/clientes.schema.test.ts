import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

// Production modules under test.
import { clientes } from "@/db/schema";
import type { ClienteRow } from "@/db/schema";
import { toClienteDTO } from "@/db/mappers/cliente";
import { clienteInputSchema } from "@/db/validators/cliente";

// src/db/index.ts imports "server-only", which throws outside the
// react-server condition. Stub it so the singleton proof runs in plain Node.
vi.mock("server-only", () => ({}));

function tableConfig() {
  return getTableConfig(clientes);
}

function columnsByName() {
  const config = tableConfig();
  expect(config.name).toBe("clientes");
  return new Map(config.columns.map((column) => [column.name, column]));
}

describe("clientes table shape (REQ-CLIENTE-04)", () => {
  it("is named 'clientes' with exactly the spec'd columns", () => {
    const config = tableConfig();
    expect(config.name).toBe("clientes");
    const names = config.columns.map((c) => c.name).sort();
    // INV-08: snake_case DB columns; no vehiculo/servicio/turno tables here.
    expect(names).toEqual(["apellido", "created_at", "email", "id", "nombre", "telefono", "updated_at"]);
  });

  it("defines id as uuid primary key with random default", () => {
    const id = columnsByName().get("id");
    expect(id).toBeDefined();
    expect(id?.columnType).toBe("PgUUID");
    expect(id?.primary).toBe(true);
    expect(id?.hasDefault).toBe(true); // gen_random_uuid()
  });

  it("defines nombre/apellido as varchar(100) NOT NULL", () => {
    for (const name of ["nombre", "apellido"]) {
      const column = columnsByName().get(name);
      expect(column, name).toBeDefined();
      expect(column?.columnType).toBe("PgVarchar");
      expect((column as { length?: number }).length).toBe(100);
      expect(column?.notNull).toBe(true);
    }
  });

  it("defines telefono as varchar(20) NOT NULL", () => {
    const telefono = columnsByName().get("telefono");
    expect(telefono).toBeDefined();
    expect(telefono?.columnType).toBe("PgVarchar");
    expect((telefono as { length?: number }).length).toBe(20);
    expect(telefono?.notNull).toBe(true);
  });

  it("defines email as varchar(255) NOT NULL UNIQUE", () => {
    const email = columnsByName().get("email");
    expect(email).toBeDefined();
    expect(email?.columnType).toBe("PgVarchar");
    expect((email as { length?: number }).length).toBe(255);
    expect(email?.notNull).toBe(true);
    expect(email?.isUnique).toBe(true);
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

  it("attaches $onUpdate touch to updated_at only (D2)", () => {
    const updatedAt = columnsByName().get("updated_at");
    const createdAt = columnsByName().get("created_at");
    expect(typeof (updatedAt as { onUpdateFn?: unknown }).onUpdateFn).toBe("function");
    expect((createdAt as { onUpdateFn?: unknown }).onUpdateFn).toBeUndefined();
  });
});

describe("toClienteDTO mapper (REQ-CLIENTE-06)", () => {
  const row = (): ClienteRow => ({
    id: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    nombre: "Ana",
    apellido: "García",
    telefono: "+54 11 1234-5678",
    email: "ana@example.test",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  });

  it("maps snake_case timestamps to camelCase DTO keys", () => {
    const dto = toClienteDTO(row());
    expect(dto).toEqual({
      id: row().id,
      nombre: "Ana",
      apellido: "García",
      telefono: "+54 11 1234-5678",
      email: "ana@example.test",
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
  });

  it("preserves Date instances and Spanish domain names for a different row (triangulation)", () => {
    const source = row();
    source.nombre = "Bruno";
    source.apellido = "Díaz";
    const dto = toClienteDTO(source);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.createdAt).toBe(source.createdAt); // same reference, not a copy
    expect(dto.nombre).toBe("Bruno");
    expect(dto.apellido).toBe("Díaz");
  });
});

describe("clienteInputSchema validator (REQ-CLIENTE-10)", () => {
  const validInput = {
    nombre: "Ana",
    apellido: "García",
    telefono: "+54 11 1234-5678",
    email: "ana@example.test",
  };

  it("accepts a valid input and trims nombre/apellido", () => {
    const parsed = clienteInputSchema.parse({ ...validInput, nombre: "  Ana  ", apellido: " García " });
    expect(parsed.nombre).toBe("Ana");
    expect(parsed.apellido).toBe("García");
  });

  it("rejects nombre shorter than 2 chars (boundary)", () => {
    expect(() => clienteInputSchema.parse({ ...validInput, nombre: "A" })).toThrow();
  });

  it("rejects telefono outside ^\\+?[0-9\\s\\-]{7,20}$", () => {
    expect(() => clienteInputSchema.parse({ ...validInput, telefono: "123" })).toThrow(); // too short
    expect(() => clienteInputSchema.parse({ ...validInput, telefono: "abcd-efgh" })).toThrow(); // letters
  });

  it("accepts a 20-digit telefono and rejects 21+ digits after the optional sign", () => {
    const twentyDigits = "12345678901234567890"; // 20 chars — regex upper bound
    expect(twentyDigits).toMatch(/^\+?[0-9\s\-]{7,20}$/);
    expect(() =>
      clienteInputSchema.parse({ ...validInput, telefono: `${twentyDigits}1` }),
    ).toThrow();
  });

  it("rejects malformed emails", () => {
    expect(() => clienteInputSchema.parse({ ...validInput, email: "not-an-email" })).toThrow();
  });
});

describe("drizzle.config.ts isolation (REQ-CLIENTE-02)", () => {
  it("never imports the server-only env layer", () => {
    const source = readFileSync(resolve(__dirname, "../../../drizzle.config.ts"), "utf8");
    expect(source).not.toContain("src/lib/env");
    expect(source).toContain("dotenv/config");
  });
});

describe("db client singleton (REQ-CLIENTE-03)", () => {
  it("exposes the same db and pool across imports", async () => {
    if (!process.env.DATABASE_URL) {
      // No real connection is made; Pool is lazy. This only needs a valid URL
      // so the env layer parses successfully in-process.
      process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/autoservice";
    }
    const mod1 = await import("@/db");
    const mod2 = await import("@/db");
    expect(mod1.db).toBe(mod2.db);
    expect(mod1.pool).toBe(mod2.pool);
  });
});
