import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/db/validators/auth";

describe("auth validators Zod normalize min8 (RED 1.4)", () => {
  it("registerSchema trims+lowercases email, defaults CLIENTE, min8 passes", () => {
    const parsed = registerSchema.parse({
      email: "  Foo@Example.COM ",
      password: "12345678",
    });
    expect(parsed.email).toBe("foo@example.com");
    expect(parsed.role).toBe("CLIENTE");
  });

  it("registerSchema accepts ADMINISTRADOR and rejects short/invalid (triangulation)", () => {
    expect(
      registerSchema.parse({
        email: "a@b.com",
        password: "12345678",
        role: "ADMINISTRADOR",
      }).role,
    ).toBe("ADMINISTRADOR");
    expect(() => registerSchema.parse({ email: "a@b.com", password: "short" })).toThrow();
    expect(() => registerSchema.parse({ email: "not-email", password: "12345678" })).toThrow();
    expect(() => registerSchema.parse({ email: "a@b.com", password: "12345678", role: "SUPERADMIN" as unknown as string })).toThrow();
  });

  it("loginSchema normalizes email and requires password", () => {
    const parsed = loginSchema.parse({ email: " Foo@Example.COM ", password: "secret123" });
    expect(parsed.email).toBe("foo@example.com");
    expect(() => loginSchema.parse({ email: "a@b.com", password: "" })).toThrow();
  });
});
