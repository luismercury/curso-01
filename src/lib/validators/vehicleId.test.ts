/**
 * Unit tests for `src/lib/validators/vehicleId.ts` — T-043 PR1.
 *
 * Covers:
 *   - `vehicleIdSchema.safeParse` accepts canonical UUIDs, rejects
 *     garbage, rejects empty string, never throws (defense in depth).
 *   - `isOwner` true when `customerId === userId`, false otherwise.
 *   - Pure / client-safe — the module has no `server-only` import.
 */
import { describe, expect, it } from "vitest";
import { isOwner, vehicleIdSchema } from "./vehicleId";

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "660e8400-e29b-41d4-a716-446655440001";

function v(id: string, customerId: string) {
  return { id, customerId };
}

describe("vehicleIdSchema — UUID guard", () => {
  it("accepts a canonical UUID", () => {
    expect(vehicleIdSchema.safeParse(UUID_A).success).toBe(true);
  });

  it("accepts different valid UUIDs independently", () => {
    expect(vehicleIdSchema.safeParse(UUID_B).success).toBe(true);
    expect(vehicleIdSchema.safeParse(UUID_A).success).toBe(true);
  });

  it("rejects a non-UUID string (GWT Tampered / foreign vehicle)", () => {
    expect(vehicleIdSchema.safeParse("garbage").success).toBe(false);
    expect(vehicleIdSchema.safeParse("123").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(vehicleIdSchema.safeParse("").success).toBe(false);
  });

  it("rejects a UUID missing dashes", () => {
    expect(
      vehicleIdSchema.safeParse("550e8400e29b41d4a716446655440000").success,
    ).toBe(false);
  });

  it("safeParse never throws — even with weird inputs", () => {
    expect(() =>
      vehicleIdSchema.safeParse(null as unknown as string),
    ).not.toThrow();
    expect(() =>
      vehicleIdSchema.safeParse(undefined as unknown as string),
    ).not.toThrow();
    expect(() =>
      vehicleIdSchema.safeParse(42 as unknown as string),
    ).not.toThrow();
    // The numeric input fails the schema but never throws.
    expect(vehicleIdSchema.safeParse(42 as unknown as string).success).toBe(
      false,
    );
  });
});

describe("isOwner — ownership guard (INV-03)", () => {
  it("returns true when customerId === userId", () => {
    expect(isOwner(v(UUID_A, UUID_A), UUID_A)).toBe(true);
  });

  it("returns false when customerId !== userId (foreign vehicle)", () => {
    expect(isOwner(v(UUID_A, UUID_B), UUID_A)).toBe(false);
  });

  it("returns false on empty customerId (defensive)", () => {
    expect(isOwner(v(UUID_A, ""), UUID_A)).toBe(false);
  });

  it("returns false on empty userId (defensive)", () => {
    expect(isOwner(v(UUID_A, UUID_A), "")).toBe(false);
  });

  it("returns true across many owners when matches", () => {
    expect(isOwner(v(UUID_A, UUID_B), UUID_B)).toBe(true);
  });
});
