import { describe, expect, it } from "vitest";
import { confirmedIdSchema, parseConfirmedId } from "./confirmedId";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("confirmedId", () => {
  it.each([
    ["accepts UUID", UUID, true],
    ["rejects non-UUID", "not-a-uuid", false],
    ["rejects empty", "", false],
    ["rejects XSS", "<script>alert(1)</script>", false],
  ])("%s", (_l, input, ok) => {
    expect(confirmedIdSchema.safeParse(input).success).toBe(ok);
  });

  it("returns canonical id on success", () => {
    expect(parseConfirmedId(UUID)).toBe(UUID);
  });

  it("returns null on invalid / undefined / null", () => {
    expect(parseConfirmedId("garbage")).toBeNull();
    expect(parseConfirmedId(undefined)).toBeNull();
    expect(parseConfirmedId(null)).toBeNull();
  });

  it("never throws", () => {
    expect(() => parseConfirmedId(42 as never)).not.toThrow();
  });
});
