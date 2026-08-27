import { describe, expect, it } from "vitest";
import type { VehiculoRow } from "@/db/schema";
import { toVehiculoDTO } from "@/db/mappers/vehiculo";

function vehiculoRow(): VehiculoRow {
  return {
    id: "1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    clienteId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    marca: "Toyota",
    modelo: "Corolla",
    anio: 2020,
    patente: "ABC123",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toVehiculoDTO mapper (INV-08)", () => {
  it("maps marca→brand, modelo→model, anio→year, patente→plate, clienteId→customerId", () => {
    const dto = toVehiculoDTO(vehiculoRow());
    expect(dto).toEqual({
      id: vehiculoRow().id,
      customerId: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      plate: "ABC123",
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(typeof dto.year).toBe("number");
  });

  it("triangulates with different values and preserves Date references", () => {
    const row = vehiculoRow();
    row.marca = "Ford";
    row.modelo = "Fiesta";
    row.anio = 2015;
    row.patente = "XYZ789";
    const dto = toVehiculoDTO(row);
    expect(dto.brand).toBe("Ford");
    expect(dto.model).toBe("Fiesta");
    expect(dto.year).toBe(2015);
    expect(dto.plate).toBe("XYZ789");
    expect(dto.createdAt).toBe(row.createdAt);
    expect(dto.createdAt).toBeInstanceOf(Date);
  });

  it("exposes no Spanish or snake_case leak", () => {
    const dto = toVehiculoDTO(vehiculoRow());
    const keys = Object.keys(dto);
    expect(keys).not.toContain("marca");
    expect(keys).not.toContain("modelo");
    expect(keys).not.toContain("anio");
    expect(keys).not.toContain("patente");
    expect(keys).not.toContain("cliente_id");
    expect(keys).not.toContain("created_at");
    expect(keys.every((k) => !/_[a-z]/.test(k))).toBe(true);
  });
});
