import { describe, expect, it } from "vitest";
import type { ClienteRow } from "@/db/schema";
import { toClienteDTO } from "@/db/mappers/cliente";

function clienteRow(): ClienteRow {
  return {
    id: "0f0a1b2c-3d4e-5f60-8a9b-c0d1e2f3a4b5",
    nombre: "Ana",
    apellido: "García",
    telefono: "+54 11 1234-5678",
    email: "ana@example.test",
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
  };
}

describe("toClienteDTO mapper (INV-08)", () => {
  it("maps identity with camelCase timestamps as Date", () => {
    const dto = toClienteDTO(clienteRow());
    expect(dto).toEqual({
      id: clienteRow().id,
      nombre: "Ana",
      apellido: "García",
      telefono: "+54 11 1234-5678",
      email: "ana@example.test",
      createdAt: new Date("2026-08-25T13:00:00.000Z"),
      updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    });
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.updatedAt).toBeInstanceOf(Date);
  });

  it("preserves Date references and Spanish domain names for different row (triangulation)", () => {
    const row = clienteRow();
    row.nombre = "Bruno";
    row.apellido = "Díaz";
    const dto = toClienteDTO(row);
    expect(dto.createdAt).toBe(row.createdAt);
    expect(dto.updatedAt).toBe(row.updatedAt);
    expect(dto.nombre).toBe("Bruno");
    expect(dto.apellido).toBe("Díaz");
  });

  it("exposes no snake_case leak", () => {
    const dto = toClienteDTO(clienteRow());
    const keys = Object.keys(dto);
    expect(keys).not.toContain("created_at");
    expect(keys).not.toContain("updated_at");
    expect(keys.every((k) => !/_[a-z]/.test(k))).toBe(true);
  });
});
