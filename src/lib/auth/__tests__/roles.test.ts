import { describe, expect, it } from "vitest";
import { UserRole, isValidRole, userRoleSchema } from "@/lib/auth/roles";

describe("roles barrel + CHECK 23514 (RED 1.2)", () => {
  it("exports CLIENTE and ADMINISTRADOR const + type", () => {
    expect(UserRole.CLIENTE).toBe("CLIENTE");
    expect(UserRole.ADMINISTRADOR).toBe("ADMINISTRADOR");
    expect(Object.values(UserRole)).toEqual(
      expect.arrayContaining(["CLIENTE", "ADMINISTRADOR"]),
    );
  });

  it("Zod enum accepts valid roles and rejects SUPERADMIN (triangulation)", () => {
    expect(userRoleSchema.safeParse("CLIENTE").success).toBe(true);
    expect(userRoleSchema.safeParse("ADMINISTRADOR").success).toBe(true);
    expect(userRoleSchema.safeParse("SUPERADMIN").success).toBe(false);
    expect(userRoleSchema.safeParse("").success).toBe(false);
    expect(isValidRole("CLIENTE")).toBe(true);
    expect(isValidRole("SUPERADMIN")).toBe(false);
  });

  it("DB CHECK violation maps via file-content (23514) — barrel must document CHECK", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const schemaSrc = readFileSync(resolve("src/db/schema.ts"), "utf8");
    expect(schemaSrc).toMatch(/users_role_check|role.*CHECK.*CLIENTE.*ADMINISTRADOR/);
    const rolesSrc = readFileSync(resolve("src/lib/auth/roles.ts"), "utf8");
    expect(rolesSrc).toMatch(/CLIENTE/);
    expect(rolesSrc).toMatch(/ADMINISTRADOR/);
  });
});
