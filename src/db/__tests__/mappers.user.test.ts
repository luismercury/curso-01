import { describe, expect, it } from "vitest";
import { toUserDTO } from "@/db/mappers/user";

describe("user mapper hides hash (RED 1.3)", () => {
  it("maps row to DTO without passwordHash", () => {
    const row = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "foo@example.com",
      passwordHash: "$2a$10$hashedvalueexamplehashedvalueexampl",
      role: "CLIENTE" as const,
      createdAt: new Date("2026-08-27T12:00:00Z"),
      updatedAt: new Date("2026-08-27T12:00:00Z"),
    };
    const dto = toUserDTO(row);
    expect(dto.id).toBe(row.id);
    expect(dto.email).toBe(row.email);
    expect(dto.role).toBe("CLIENTE");
    expect(dto.createdAt).toEqual(row.createdAt);
    expect(dto.updatedAt).toEqual(row.updatedAt);
    expect((dto as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("preserves ADMINISTRADOR role and does not leak hash (triangulation)", () => {
    const row = {
      id: "00000000-0000-0000-0000-000000000002",
      email: "admin@example.com",
      passwordHash: "$2a$10$anotherhashexamplevalue12345678",
      role: "ADMINISTRADOR" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const dto = toUserDTO(row);
    expect(dto.role).toBe("ADMINISTRADOR");
    expect(JSON.stringify(dto)).not.toMatch(/passwordHash/);
  });
});
