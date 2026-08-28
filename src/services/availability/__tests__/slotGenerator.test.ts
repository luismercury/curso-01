import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { workshopConfigSchema } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import {
  baWallTimeToUtcDate,
  formatSlotsAsHHmm,
  generateSlotsForDate,
} from "@/services/availability/slotGenerator";

function makeConfig(overrides?: {
  slotStepMinutes?: number;
  timezone?: string;
  operatingHours?: Record<number, { start: string; end: string }[]>;
}) {
  return workshopConfigSchema.parse({
    slotStepMinutes: overrides?.slotStepMinutes,
    timezone: overrides?.timezone,
    operatingHours: overrides?.operatingHours,
  });
}

const DEFAULT_CONFIG = makeConfig();
const MONDAY_2026_09_07 = new Date("2026-09-07T15:00:00.000Z"); // Monday noon BA
const SATURDAY_2026_09_12 = new Date("2026-09-12T15:00:00.000Z"); // Saturday

describe("slotGenerator — table-driven duration 60/90/120", () => {
  it("60 min Monday yields 12 slots 09:00..11:00 + 14:00..17:00", () => {
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    const hhmm = formatSlotsAsHHmm(slots, DEFAULT_CONFIG.timezone);
    expect(hhmm).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
    ]);
    expect(slots).toHaveLength(12);
  });

  it("90 min Monday: last morning 10:30 and last afternoon 16:30", () => {
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 90,
      config: DEFAULT_CONFIG,
    });
    const hhmm = formatSlotsAsHHmm(slots, DEFAULT_CONFIG.timezone);
    // Morning: 09:00..10:30 (4 slots), afternoon 14:00..16:30 (6 slots) =10
    expect(hhmm).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
    ]);
    expect(hhmm).toContain("10:30");
    expect(hhmm).not.toContain("11:00");
    expect(hhmm).not.toContain("11:30");
    expect(hhmm).toContain("16:30");
    expect(hhmm).not.toContain("17:00");
  });

  it("120 min Monday: last morning 10:00 and last afternoon 16:00", () => {
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 120,
      config: DEFAULT_CONFIG,
    });
    const hhmm = formatSlotsAsHHmm(slots, DEFAULT_CONFIG.timezone);
    expect(hhmm).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
    ]);
    expect(hhmm).toContain("10:00");
    expect(hhmm).not.toContain("10:30");
    expect(hhmm).toContain("16:00");
    expect(hhmm).not.toContain("16:30");
  });

  it("30 min Monday boundary yields max slots", () => {
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 30,
      config: DEFAULT_CONFIG,
    });
    const hhmm = formatSlotsAsHHmm(slots, DEFAULT_CONFIG.timezone);
    // 09:00-12:00 step 30 with 30min => 6 slots (09:00..11:30), 14:00-18:00 => 8 slots =>14
    expect(slots).toHaveLength(14);
    expect(hhmm).toContain("11:30");
    expect(hhmm).toContain("17:30");
  });
});

describe("slotGenerator — inclusive boundary and edges", () => {
  it("inclusive edge 11:00+60=12:00 valid, 11:30+90 excluded", () => {
    const slots60 = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    const hhmm60 = formatSlotsAsHHmm(slots60, DEFAULT_CONFIG.timezone);
    expect(hhmm60).toContain("11:00");

    const slots90 = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 90,
      config: DEFAULT_CONFIG,
    });
    const hhmm90 = formatSlotsAsHHmm(slots90, DEFAULT_CONFIG.timezone);
    expect(hhmm90).not.toContain("11:00");
    expect(hhmm90).not.toContain("11:30");
  });

  it("closed Saturday without override returns []", () => {
    const slots = generateSlotsForDate({
      date: SATURDAY_2026_09_12,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    expect(slots).toEqual([]);
  });

  it("midnight BA boundary 00:30Z is previous day in BA", () => {
    // 2026-09-07T00:30:00Z = 2026-09-06T21:30 BA Sunday (closed)
    const midnight = new Date("2026-09-07T00:30:00.000Z");
    const slots = generateSlotsForDate({
      date: midnight,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    expect(slots).toEqual([]);

    // 2026-09-10T00:30:00Z = Tue 21:30 BA Monday? Actually 2026-09-10 is Thursday? Let's use known Monday override
    const configWithSunday = makeConfig({
      operatingHours: {
        0: [{ start: "09:00", end: "11:00" }],
        1: [{ start: "10:00", end: "16:00" }],
      },
    });
    const sundayMidnight = new Date("2026-09-07T00:30:00.000Z"); // BA Sunday 2026-09-06 21:30
    const sundaySlots = generateSlotsForDate({
      date: sundayMidnight,
      durationMinutes: 60,
      config: configWithSunday,
    });
    const hhmm = formatSlotsAsHHmm(sundaySlots, configWithSunday.timezone);
    // Sunday override 09:00-11:00 with 60min step30 => 09:00,09:30,10:00
    expect(hhmm).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("step parametrization 15 vs 30: 15 yields superset of 30", () => {
    const config15 = makeConfig({ slotStepMinutes: 15 });
    const config30 = makeConfig({ slotStepMinutes: 30 });
    const slots15 = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: config15,
    });
    const slots30 = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: config30,
    });
    const hhmm15 = formatSlotsAsHHmm(slots15, config15.timezone);
    const hhmm30 = formatSlotsAsHHmm(slots30, config30.timezone);
    for (const h of hhmm30) {
      expect(hhmm15).toContain(h);
    }
    expect(hhmm15.length).toBeGreaterThan(hhmm30.length);
  });

  it("UTC conversion 09:00 BA = 12:00Z", () => {
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    const first = slots[0];
    expect(first).toBeDefined();
    expect(first?.start.toISOString()).toBe("2026-09-07T12:00:00.000Z");
    expect(first?.end.toISOString()).toBe("2026-09-07T13:00:00.000Z");
  });

  it("DST regression with America/New_York not hardcoded", () => {
    // Use NY timezone: Monday 09:00 NY = 13:00Z (DST UTC-4 in September)
    const nyConfig = makeConfig({ timezone: "America/New_York" });
    const slots = generateSlotsForDate({
      date: MONDAY_2026_09_07,
      durationMinutes: 60,
      config: nyConfig,
    });
    const first = slots[0];
    expect(first?.start.toISOString()).toBe("2026-09-07T13:00:00.000Z");
    // BA would be 12:00Z, NY is different → proves not hardcoded
    expect(first?.start.toISOString()).not.toBe("2026-09-07T12:00:00.000Z");
  });

  it("baWallTimeToUtcDate directly 09:00 BA → 12:00Z", () => {
    const d = baWallTimeToUtcDate("2026-09-07", "09:00", "America/Argentina/Buenos_Aires");
    expect(d.toISOString()).toBe("2026-09-07T12:00:00.000Z");
  });

  it("formatSlotsAsHHmm maps 12:00Z to 09:00 BA", () => {
    const slot = {
      start: new Date("2026-09-07T12:00:00.000Z"),
      end: new Date("2026-09-07T13:00:00.000Z"),
    };
    expect(formatSlotsAsHHmm([slot], "America/Argentina/Buenos_Aires")).toEqual(["09:00"]);
  });
});

describe("slotGenerator — duration validation", () => {
  const valid = [30, 60, 90, 120] as const;
  it.each(valid)("valid duration %i does not throw", (dur) => {
    expect(() =>
      generateSlotsForDate({ date: MONDAY_2026_09_07, durationMinutes: dur, config: DEFAULT_CONFIG }),
    ).not.toThrow();
  });

  const invalid: unknown[] = [25, 29, 121, 65.5, 0, "60", NaN, Infinity, null, undefined];
  it.each(invalid)("invalid duration %p throws ValidationError", (dur) => {
    expect(() =>
      generateSlotsForDate({
        date: MONDAY_2026_09_07,
        durationMinutes: dur as number,
        config: DEFAULT_CONFIG,
      }),
    ).toThrow(ValidationError);
    try {
      generateSlotsForDate({
        date: MONDAY_2026_09_07,
        durationMinutes: dur as number,
        config: DEFAULT_CONFIG,
      });
    } catch (err) {
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("invalid throws with no slots returned", () => {
    expect(() =>
      generateSlotsForDate({ date: MONDAY_2026_09_07, durationMinutes: 25, config: DEFAULT_CONFIG }),
    ).toThrow();
  });
});

describe("slotGenerator — purity invariants", () => {
  it("does not import requireAuth and imports server-only", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/slotGenerator.ts", "utf8");
    expect(content).not.toMatch(/requireAuth/);
    expect(content).toMatch(/import\s+["']server-only["']/);
    expect(content).not.toMatch(/from\s+["']@\/db/);
  });

  it("no hardcoded 30 or 09:00 outside DEFAULT (uses config.slotStepMinutes)", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/slotGenerator.ts", "utf8");
    expect(content).toMatch(/config\.slotStepMinutes/);
    // Should not contain hardcoded interval strings except via imports
    expect(content).not.toMatch(/DEFAULT_OPERATING_INTERVALS/);
  });
});
