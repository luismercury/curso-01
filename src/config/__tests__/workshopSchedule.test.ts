import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { workshopConfigSchema } from "@/config/workshopConfig";
import {
  DEFAULT_OPERATING_INTERVALS,
  ValidationError,
  getOperatingIntervalsForDate,
  validateIntervals,
} from "@/config/workshopSchedule";

// Helper to build config via schema parse to ensure timezone defaults correctly
function makeConfig(operatingHours?: Record<number, { start: string; end: string }[]>) {
  return workshopConfigSchema.parse(
    operatingHours ? { operatingHours } : {},
  );
}

describe("workshopSchedule — getOperatingIntervalsForDate fallback/override", () => {
  it("Monday default fallback returns DEFAULT_OPERATING_INTERVALS", () => {
    const config = makeConfig();
    // 2026-09-07 is Monday; noon in BA = 15:00Z
    const mondayNoonBA = new Date("2026-09-07T15:00:00.000Z");
    const intervals = getOperatingIntervalsForDate(mondayNoonBA, config);
    expect(intervals).toEqual([...DEFAULT_OPERATING_INTERVALS]);
  });

  it("Saturday returns closed [] without override", () => {
    const config = makeConfig();
    // 2026-09-12 is Saturday; 10:00 BA = 13:00Z
    const saturdayBA = new Date("2026-09-12T13:00:00.000Z");
    const intervals = getOperatingIntervalsForDate(saturdayBA, config);
    expect(intervals).toEqual([]);
  });

  it("Sunday returns closed [] without override", () => {
    const config = makeConfig();
    // 2026-09-13 is Sunday; 10:00 BA = 13:00Z
    const sundayBA = new Date("2026-09-13T13:00:00.000Z");
    const intervals = getOperatingIntervalsForDate(sundayBA, config);
    expect(intervals).toEqual([]);
  });

  it("custom override takes precedence over fallback (Monday)", () => {
    const config = makeConfig({ 1: [{ start: "10:00", end: "16:00" }] });
    const mondayNoonBA = new Date("2026-09-07T15:00:00.000Z");
    const intervals = getOperatingIntervalsForDate(mondayNoonBA, config);
    expect(intervals).toEqual([{ start: "10:00", end: "16:00" }]);
    expect(intervals).not.toEqual([...DEFAULT_OPERATING_INTERVALS]);
  });

  it("override can open Saturday which is normally closed", () => {
    const config = makeConfig({ 6: [{ start: "09:00", end: "12:00" }] });
    const saturdayBA = new Date("2026-09-12T13:00:00.000Z");
    expect(getOperatingIntervalsForDate(saturdayBA, config)).toEqual([
      { start: "09:00", end: "12:00" },
    ]);
  });

  it("all weekdays 1-5 return DEFAULT when no override, 0 and 6 closed", () => {
    const config = makeConfig();
    // Monday 2026-09-07 through Sunday 2026-09-13
    const expectations: Record<number, boolean> = {
      1: true, // Mon open
      2: true, // Tue
      3: true, // Wed
      4: true, // Thu
      5: true, // Fri
      6: false, // Sat closed
      0: false, // Sun closed
    };
    const dates: Record<number, string> = {
      1: "2026-09-07T15:00:00.000Z",
      2: "2026-09-08T15:00:00.000Z",
      3: "2026-09-09T15:00:00.000Z",
      4: "2026-09-10T15:00:00.000Z",
      5: "2026-09-11T15:00:00.000Z",
      6: "2026-09-12T15:00:00.000Z",
      0: "2026-09-13T15:00:00.000Z",
    };
    for (const dow of [0, 1, 2, 3, 4, 5, 6] as const) {
      const intervals = getOperatingIntervalsForDate(new Date(dates[dow]!), config);
      if (expectations[dow]) {
        expect(intervals, `dow ${dow} should be open`).toEqual([...DEFAULT_OPERATING_INTERVALS]);
      } else {
        expect(intervals, `dow ${dow} should be closed`).toEqual([]);
      }
    }
  });
});

describe("workshopSchedule — BA timezone midnight edge", () => {
  it("2026-09-10T02:00:00Z is Wednesday in BA (dow 3), not Thursday", () => {
    // UTC 02:00Z on Thu 2026-09-10 is still Wed 23:00 in BA (-03:00)
    const utcInstant = new Date("2026-09-10T02:00:00.000Z");
    const config = makeConfig({
      3: [{ start: "08:00", end: "09:00" }], // Wednesday
      4: [{ start: "14:00", end: "15:00" }], // Thursday
    });
    const intervals = getOperatingIntervalsForDate(utcInstant, config);
    // Must resolve to Wednesday's override, proving Intl BA dow was used, not host getDay()
    expect(intervals).toEqual([{ start: "08:00", end: "09:00" }]);
    expect(intervals).not.toEqual([{ start: "14:00", end: "15:00" }]);

    // Contrast: host UTC dow would be Thursday (4)
    expect(utcInstant.getUTCDay()).toBe(4);
  });

  it("midnight boundary 00:30Z is previous day in BA", () => {
    // 2026-09-07T00:30:00Z = 2026-09-06T21:30-03:00 Sunday in BA
    const utcInstant = new Date("2026-09-07T00:30:00.000Z");
    const config = makeConfig({
      0: [{ start: "09:00", end: "11:00" }], // Sunday open override
      1: [{ start: "10:00", end: "16:00" }], // Monday
    });
    const intervals = getOperatingIntervalsForDate(utcInstant, config);
    expect(intervals).toEqual([{ start: "09:00", end: "11:00" }]);
  });
});

describe("workshopSchedule — validateIntervals", () => {
  it("accepts adjacent non-overlapping DEFAULT intervals", () => {
    expect(() => validateIntervals([...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[])).not.toThrow();
  });

  it("accepts adjacent touching edges 12:00-14:00 boundary", () => {
    expect(() =>
      validateIntervals([
        { start: "09:00", end: "12:00" },
        { start: "12:00", end: "14:00" },
      ]),
    ).not.toThrow();
  });

  it("rejects start >= end", () => {
    expect(() => validateIntervals([{ start: "12:00", end: "09:00" }])).toThrow(ValidationError);
    expect(() => validateIntervals([{ start: "12:00", end: "09:00" }])).toThrow(/start must be before end/);
    try {
      validateIntervals([{ start: "12:00", end: "12:00" }]);
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects overlapping intervals", () => {
    expect(() =>
      validateIntervals([
        { start: "09:00", end: "12:00" },
        { start: "11:30", end: "14:00" },
      ]),
    ).toThrow(ValidationError);
    expect(() =>
      validateIntervals([
        { start: "09:00", end: "12:00" },
        { start: "11:30", end: "14:00" },
      ]),
    ).toThrow(/overlapping/);
  });

  it("rejects unsorted intervals", () => {
    expect(() =>
      validateIntervals([
        { start: "14:00", end: "18:00" },
        { start: "09:00", end: "12:00" },
      ]),
    ).toThrow(ValidationError);
  });

  it("throws VALIDATION_ERROR code on violation", () => {
    try {
      validateIntervals([{ start: "18:00", end: "14:00" }]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("workshopSchedule — weeklyScheduleSchema via workshopConfig", () => {
  it("accepts numeric keys 0-6", () => {
    const parsed = workshopConfigSchema.parse({ operatingHours: { 0: [{ start: "09:00", end: "12:00" }] } });
    expect(parsed.operatingHours?.[0]).toEqual([{ start: "09:00", end: "12:00" }]);
  });

  it("coerces string numeric key \"1\" to number 1", () => {
    const parsed = workshopConfigSchema.parse({ operatingHours: { "1": [{ start: "09:00", end: "12:00" }] } as unknown as Record<string, unknown> });
    expect(parsed.operatingHours?.[1]).toEqual([{ start: "09:00", end: "12:00" }]);
  });

  it("rejects out-of-range key 7 via schema", () => {
    expect(() => workshopConfigSchema.parse({ operatingHours: { 7: [{ start: "09:00", end: "12:00" }] } as unknown as Record<string, unknown> })).toThrow();
  });

  it("rejects string day name monday via schema", () => {
    expect(() => workshopConfigSchema.parse({ operatingHours: { monday: [{ start: "09:00", end: "12:00" }] } as unknown as Record<string, unknown> })).toThrow();
  });

  it("rejects invalid interval start>=end via schema superRefine", () => {
    expect(() =>
      workshopConfigSchema.parse({ operatingHours: { 1: [{ start: "12:00", end: "09:00" }] } }),
    ).toThrow();
  });

  it("rejects overlapping intervals via schema", () => {
    expect(() =>
      workshopConfigSchema.parse({
        operatingHours: { 1: [{ start: "09:00", end: "12:00" }, { start: "11:30", end: "14:00" }] },
      }),
    ).toThrow();
  });
});
