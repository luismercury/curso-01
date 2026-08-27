import { describe, expect, it } from "vitest";
import type { ServicioRow } from "@/db/schema";
import { toServicioDTO } from "@/db/mappers/servicio";

function servicioRow(): ServicioRow {
  return {
    id: "2b2c3d4e-5f60-8a9b-c0d1-e2f3a4b5c6d7",
    nombre: "Alineacion",
    descripcion: "desc",
    duracionMinutos: 90,
    activo: true,
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toServicioDTO mapper (INV-08)", () => {
  it("maps nombre→name, descripcion→description, duracionMinutos→durationMinutes, activo→active", () => {
    const dto = toServicioDTO(servicioRow());
    expect(dto).toEqual({
      id: servicioRow().id,
      name: "Alineacion",
      description: "desc",
      durationMinutes: 90,
      active: true,
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(typeof dto.durationMinutes).toBe("number");
    expect(typeof dto.active).toBe("boolean");
  });

  it("triangulates with null description and different duration/active", () => {
    const row = servicioRow();
    row.nombre = "Cambio de aceite";
    row.descripcion = null;
    row.duracionMinutos = 60;
    row.activo = false;
    const dto = toServicioDTO(row);
    expect(dto.name).toBe("Cambio de aceite");
    expect(dto.description).toBeNull();
    expect(dto.durationMinutes).toBe(60);
    expect(dto.active).toBe(false);
    expect(dto.createdAt).toBe(row.createdAt);
  });

  it("exposes no Spanish or snake_case leak and timestamps are Date", () => {
    const dto = toServicioDTO(servicioRow());
    const keys = Object.keys(dto);
    expect(keys).not.toContain("nombre");
    expect(keys).not.toContain("descripcion");
    expect(keys).not.toContain("duracion_minutos");
    expect(keys).not.toContain("activo");
    expect(keys).not.toContain("created_at");
    expect(keys.every((k) => !/_[a-z]/.test(k))).toBe(true);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
  });
});
