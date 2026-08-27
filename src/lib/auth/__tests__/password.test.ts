import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers — bcryptjs 10 rounds hash≠plain (RED 1.1)", () => {
  it("hashPassword produces hash different from plain and verifies", async () => {
    const plain = "s3cureP@ss99";
    const hashed = await hashPassword(plain);
    expect(hashed).not.toBe(plain);
    expect(hashed).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword(plain, hashed)).toBe(true);
  });

  it("verifyPassword rejects wrong password (triangulation)", async () => {
    const hashed = await hashPassword("correct-horse-123");
    expect(await verifyPassword("wrong-password", hashed)).toBe(false);
    expect(await verifyPassword("", hashed)).toBe(false);
  });
});
