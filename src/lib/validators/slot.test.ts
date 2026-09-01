/**
 * Vitest tests for `src/lib/validators/slot.ts` — T-042 unit layer.
 *
 * INV-05 (step-30) + INV-06 (BA wall-clock 24h) shape contract:
 *   - Accept canonical step-30 strings across the full 24h day.
 *   - Reject malformed / wrong-step / out-of-range / empty / undefined input
 *     without throwing (Zod `safeParse` contract; UI must never crash on a
 *     tampered `?slot=`).
 */
import { describe, expect, it } from "vitest";
import { slotSchema } from "./slot";

describe("slotSchema — T-042 INV-05 step-30 HH:mm guard", () => {
  describe("accepts canonical 30-minute-step HH:mm across the full day", () => {
    it.each([
      ["00:00", "midnight"],
      ["09:00", "morning sharp"],
      ["09:30", "morning half"],
      ["12:00", "noon"],
      ["12:30", "noon half"],
      ["17:30", "evening half"],
      ["23:30", "last slot of the day"],
    ])("parses %s (%s)", (value) => {
      const result = slotSchema.safeParse(value);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(value);
    });
  });

  describe("rejects malformed / wrong-step / out-of-range input without throwing", () => {
    it.each([
      ["9:00", "single-digit hour"],
      ["09:60", "minute overflow"],
      ["25:00", "hour overflow"],
      ["24:00", "hour boundary exclusive of midnight next day"],
      ["09:15", "wrong step (15 min)"],
      ["09:45", "wrong step (45 min)"],
      ["09-30", "wrong separator"],
      ["09 :30", "whitespace inside"],
      ["", "empty string"],
    ])("rejects %s (%s)", (value) => {
      const result = slotSchema.safeParse(value);
      expect(result.success).toBe(false);
    });

    it("rejects undefined without throwing", () => {
      const result = slotSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it("rejects null without throwing", () => {
      const result = slotSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it("rejects numeric input without throwing", () => {
      const result = slotSchema.safeParse(900);
      expect(result.success).toBe(false);
    });
  });

  describe("does not mutate or coerce the input", () => {
    it("returns the exact accepted string verbatim", () => {
      const result = slotSchema.safeParse("09:30");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("09:30");
        expect(result.data).not.toBe("9:30");
      }
    });
  });
});
