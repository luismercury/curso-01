/**
 * ADDED coverage (spec scenario: "DTO contains camelCase only — snake leak
 * negative"). The mapper unit test in src/db/__tests__/mappers.vehiculo.test.ts
 * covers the happy path; this suite locks down the negative contract at the
 * serialization and field-name levels so any future regression to Spanish /
 * snake_case keys fails CI.
 *
 * Pure node (no DB): we build a fully-populated VehiculoRow from a JSON sample
 * to keep the test deterministic and hermetic.
 */
import { describe, expect, it } from "vitest";
import { toVehiculoDTO, type VehiculoDTO } from "@/db/mappers/vehiculo";
import type { VehiculoRow } from "@/db/schema";

const SNAKE_KEYS = [
  "cliente_id",
  "created_at",
  "updated_at",
  "marca",
  "modelo",
  "anio",
  "patente",
] as const;

function row(): VehiculoRow {
  return {
    id: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    clienteId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    marca: "Peugeot",
    modelo: "207",
    anio: 2011,
    patente: "ABC123",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toVehiculoDTO — DTO contains camelCase only (INV-08)", () => {
  const dto: VehiculoDTO = toVehiculoDTO(row());

  it("has exactly the 8 documented camelCase keys", () => {
    expect(Object.keys(dto).sort()).toEqual(
      ["brand", "createdAt", "customerId", "id", "model", "plate", "updatedAt", "year"].sort(),
    );
  });

  it.each(SNAKE_KEYS)("does NOT contain snake_case key '%s'", (snake) => {
    expect(dto).not.toHaveProperty(snake);
  });

  it.each(["marca", "modelo", "anio", "patente"])("does NOT contain Spanish key '%s'", (spanish) => {
    expect(dto).not.toHaveProperty(spanish);
  });

  it("JSON.stringify never leaks snake or Spanish substrings", () => {
    const serialized = JSON.stringify(dto);
    for (const forbidden of ["marca", "modelo", "anio", "patente", "cliente_id", "created_at", "updated_at"]) {
      expect(serialized, `serialized output must not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(serialized).toContain("brand");
    expect(serialized).toContain("model");
    expect(serialized).toContain("year");
    expect(serialized).toContain("plate");
    expect(serialized).toContain("customerId");
    expect(serialized).toContain("createdAt");
    expect(serialized).toContain("updatedAt");
  });

  it("Date objects are preserved as Date instances, not strings", () => {
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");
  });
});