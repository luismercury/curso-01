/**
 * ADDED coverage (spec scenario: "DTO contains camelCase only — snake leak negative").
 * Mirrors `tests/integration/dto-leak.test.ts` (vehicles).
 */
import { describe, expect, it } from "vitest";
import { toServicioDTO, type ServicioDTO } from "@/db/mappers/servicio";
import type { ServicioRow } from "@/db/schema";

const SNAKE_KEYS = ["created_at", "updated_at"] as const;
const SPANISH_KEYS = ["nombre", "descripcion", "duracionMinutos", "activo"] as const;

function row(): ServicioRow {
  return {
    id: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    nombre: "Cambio Aceite",
    descripcion: "Standard oil and filter change",
    duracionMinutos: 30,
    activo: true,
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toServicioDTO — DTO contains camelCase only (INV-08)", () => {
  const dto: ServicioDTO = toServicioDTO(row());

  it("has exactly the 7 documented camelCase keys", () => {
    expect(Object.keys(dto).sort()).toEqual(
      ["active", "createdAt", "description", "durationMinutes", "id", "name", "updatedAt"].sort(),
    );
  });

  it.each([...SNAKE_KEYS, ...SPANISH_KEYS])(
    "does NOT contain '%s' (snake or Spanish)",
    (forbidden) => {
      const serialized = JSON.stringify(dto);
      expect(dto).not.toHaveProperty(forbidden);
      expect(serialized, `JSON must not contain ${forbidden}`).not.toContain(forbidden);
    },
  );

  it("serialized output contains the camelCase English keys", () => {
    const serialized = JSON.stringify(dto);
    expect(serialized).toContain("name");
    expect(serialized).toContain("description");
    expect(serialized).toContain("durationMinutes");
    expect(serialized).toContain("active");
    expect(serialized).toContain("createdAt");
    expect(serialized).toContain("updatedAt");
  });

  it("Date objects preserved at mapper boundary; toISOString matches input", () => {
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.createdAt.toISOString()).toBe("2026-08-25T13:00:00.000Z");
  });

  it("description:null preserved (not coerced)", () => {
    expect(toServicioDTO({ ...row(), descripcion: null }).description).toBeNull();
  });

  it("active:false preserved (not coerced)", () => {
    expect(toServicioDTO({ ...row(), activo: false }).active).toBe(false);
  });
});