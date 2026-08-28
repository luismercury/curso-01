import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { workshopConfigSchema } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import {
  calculateEndAndValidate,
  calculateEndDateTime,
  durationSchema,
  findContainingInterval,
  parseIsoToUtc,
} from "@/services/availability/duration";

function makeConfig(overrides?: {
  timezone?: string;
  slotStepMinutes?: number;
  operatingHours?: Record<number, { start: string; end: string }[]>;
}) {
  return workshopConfigSchema.parse({
    slotStepMinutes: overrides?.slotStepMinutes,
    timezone: overrides?.timezone,
    operatingHours: overrides?.operatingHours,
  });
}

const DEFAULT_CONFIG = makeConfig();

// Helper to build UTC Date from BA wall time 2026-09-07 (Monday)
function baDate(hhmm: string): Date {
  const iso = `2026-09-07T${hhmm}:00-03:00`;
  return new Date(iso);
}

describe("duration — calculateEndDateTime pure UTC", () => {
  it("adds duration correctly in UTC", () => {
    const start = new Date("2026-09-07T12:00:00.000Z"); // 09:00 BA
    expect(calculateEndDateTime(start, 30).toISOString()).toBe(
      "2026-09-07T12:30:00.000Z",
    );
    expect(calculateEndDateTime(start, 60).toISOString()).toBe(
      "2026-09-07T13:00:00.000Z",
    );
    expect(calculateEndDateTime(start, 90).toISOString()).toBe(
      "2026-09-07T13:30:00.000Z",
    );
  });
});

describe("duration — durationSchema bounds", () => {
  const valid = [30, 60, 90, 120] as const;
  it.each(valid)("valid duration %i passes", (dur) => {
    expect(() => durationSchema.parse(dur)).not.toThrow();
  });

  const invalid: unknown[] = [7, 25, 29, 121, 65.5, 0, NaN, Infinity, "60", null, undefined];
  it.each(invalid)("invalid duration %p throws", (dur) => {
    expect(() => durationSchema.parse(dur as number)).toThrow();
  });

  it("duration not divisible by 5 rejects", () => {
    expect(() => durationSchema.parse(31)).toThrow();
    expect(() => durationSchema.parse(65.5)).toThrow();
  });
});

describe("duration — parseIsoToUtc", () => {
  it("parses ISO with offset to UTC", () => {
    const d = parseIsoToUtc("2026-09-10T09:00:00-03:00");
    expect(d.toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  const invalidIsos = ["not-a-date", "", "   ", "invalid"];
  it.each(invalidIsos)("invalid ISO %p throws ValidationError 400", (iso) => {
    expect(() => parseIsoToUtc(iso as string)).toThrow(ValidationError);
    try {
      parseIsoToUtc(iso as string);
    } catch (err) {
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("NaN Date via parseIsoToUtc throws", () => {
    expect(() => parseIsoToUtc("not-a-date")).toThrow(ValidationError);
  });
});

describe("duration — findContainingInterval", () => {
  it("finds morning interval for 09:00 BA", () => {
    const start = baDate("09:00");
    const interval = findContainingInterval(start, DEFAULT_CONFIG);
    expect(interval).toEqual({ start: "09:00", end: "12:00" });
  });

  it("finds afternoon interval for 14:00 BA", () => {
    const start = baDate("14:00");
    const interval = findContainingInterval(start, DEFAULT_CONFIG);
    expect(interval).toEqual({ start: "14:00", end: "18:00" });
  });

  it("returns undefined for start outside intervals (08:59)", () => {
    const start = baDate("08:59");
    const interval = findContainingInterval(start, DEFAULT_CONFIG);
    expect(interval).toBeUndefined();
  });

  it("returns undefined for closed Saturday", () => {
    const saturday = new Date("2026-09-12T15:00:00.000Z"); // Saturday 12:00 BA
    const interval = findContainingInterval(saturday, DEFAULT_CONFIG);
    expect(interval).toBeUndefined();
  });

  it("start at 12:00 exactly is outside (interval end exclusive)", () => {
    const start = baDate("12:00");
    const interval = findContainingInterval(start, DEFAULT_CONFIG);
    expect(interval).toBeUndefined();
  });
});

describe("duration — calculateEndAndValidate inclusive closure", () => {
  it("09:00 + 90 valid -> 10:30 BA (13:30Z)", () => {
    const start = baDate("09:00");
    const result = calculateEndAndValidate({
      start,
      durationMinutes: 90,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(true);
    expect(result.end.toISOString()).toBe("2026-09-07T13:30:00.000Z");
    expect(result.intervalEnd?.toISOString()).toBe("2026-09-07T15:00:00.000Z"); // 12:00 BA =15:00Z
  });

  it("11:00 + 60 inclusive edge valid (end == 12:00)", () => {
    const start = baDate("11:00");
    const result = calculateEndAndValidate({
      start,
      durationMinutes: 60,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(true);
    expect(result.end.toISOString()).toBe("2026-09-07T15:00:00.000Z"); // 12:00 BA
  });

  it("11:30 + 90 exceeds closure invalid 400", () => {
    const start = baDate("11:30");
    const result = calculateEndAndValidate({
      start,
      durationMinutes: 90,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.end.toISOString()).toBe("2026-09-07T16:00:00.000Z"); // 13:00 BA
  });

  it("08:59 outside interval invalid 400", () => {
    const start = baDate("08:59");
    const result = calculateEndAndValidate({
      start,
      durationMinutes: 30,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("closed Saturday invalid 400", () => {
    const saturdayStart = new Date("2026-09-12T13:00:00.000Z"); // 10:00 BA Saturday
    const result = calculateEndAndValidate({
      start: saturdayStart,
      durationMinutes: 30,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it.each([30, 60, 90, 120])("valid duration %i does not throw and valid true", (dur) => {
    const start = baDate("09:00");
    const result = calculateEndAndValidate({
      start,
      durationMinutes: dur,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(true);
  });

  const invalidDurations: unknown[] = [25, 29, 121, 65.5, 0, NaN, Infinity, null];
  it.each(invalidDurations)("invalid duration %p throws ValidationError 400", (dur) => {
    const start = baDate("09:00");
    expect(() =>
      calculateEndAndValidate({
        start,
        durationMinutes: dur as number,
        config: DEFAULT_CONFIG,
      }),
    ).toThrow(ValidationError);
    try {
      calculateEndAndValidate({
        start,
        durationMinutes: dur as number,
        config: DEFAULT_CONFIG,
      });
    } catch (err) {
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("invalid ISO via parseIsoToUtc then validate rejects 400", () => {
    expect(() => parseIsoToUtc("not-a-date")).toThrow(ValidationError);
  });

  it("start invalid Date throws ValidationError", () => {
    const invalid = new Date("invalid");
    expect(() =>
      calculateEndAndValidate({
        start: invalid,
        durationMinutes: 60,
        config: DEFAULT_CONFIG,
      }),
    ).toThrow(ValidationError);
  });
});

describe("duration — DST via Intl not hardcoded offset", () => {
  it("same UTC instant resolves different intervalEnd via config.timezone", () => {
    // Monday 2026-09-07 13:00Z = 10:00 BA (UTC-3) = 09:00 NY (UTC-4 DST)
    const utc = new Date("2026-09-07T13:00:00.000Z");
    const baConfig = makeConfig({ timezone: "America/Argentina/Buenos_Aires" });
    const nyConfig = makeConfig({ timezone: "America/New_York" });

    const baResult = calculateEndAndValidate({
      start: utc,
      durationMinutes: 60,
      config: baConfig,
    });
    const nyResult = calculateEndAndValidate({
      start: utc,
      durationMinutes: 60,
      config: nyConfig,
    });

    expect(baResult.valid).toBe(true);
    expect(nyResult.valid).toBe(true);
    // BA 12:00 =15:00Z, NY 12:00=16:00Z — different intervalEnd proves not hardcoded -03:00
    expect(baResult.intervalEnd?.toISOString()).toBe("2026-09-07T15:00:00.000Z");
    expect(nyResult.intervalEnd?.toISOString()).toBe("2026-09-07T16:00:00.000Z");
    expect(baResult.intervalEnd?.toISOString()).not.toBe(
      nyResult.intervalEnd?.toISOString(),
    );
  });

  it("BA 09:00 =12:00Z vs NY 09:00=13:00Z different UTC", () => {
    const baConfig = makeConfig({ timezone: "America/Argentina/Buenos_Aires" });
    const nyConfig = makeConfig({ timezone: "America/New_York" });
    // Use wall-time 09:00 in each TZ
    const baStart = new Date("2026-09-07T12:00:00.000Z"); // 09:00 BA
    const nyStart = new Date("2026-09-07T13:00:00.000Z"); // 09:00 NY
    const baResult = calculateEndAndValidate({
      start: baStart,
      durationMinutes: 60,
      config: baConfig,
    });
    const nyResult = calculateEndAndValidate({
      start: nyStart,
      durationMinutes: 60,
      config: nyConfig,
    });
    expect(baResult.valid).toBe(true);
    expect(nyResult.valid).toBe(true);
    expect(baResult.end.toISOString()).toBe("2026-09-07T13:00:00.000Z");
    expect(nyResult.end.toISOString()).toBe("2026-09-07T14:00:00.000Z");
  });
});

describe("duration — table-driven boundaries 30/60/90/120 inclusive", () => {
  const cases: Array<{
    start: string;
    duration: number;
    valid: boolean;
    desc: string;
  }> = [
    { start: "09:00", duration: 30, valid: true, desc: "09:00+30 inside" },
    { start: "09:00", duration: 90, valid: true, desc: "09:00+90 inside" },
    { start: "11:00", duration: 60, valid: true, desc: "11:00+60 inclusive edge" },
    { start: "11:30", duration: 30, valid: true, desc: "11:30+30 inclusive edge" },
    { start: "11:30", duration: 60, valid: false, desc: "11:30+60 exceeds" },
    { start: "11:30", duration: 90, valid: false, desc: "11:30+90 exceeds" },
    { start: "10:30", duration: 90, valid: true, desc: "10:30+90 inclusive edge" },
    { start: "17:00", duration: 60, valid: true, desc: "17:00+60 inclusive edge pm" },
    { start: "17:30", duration: 60, valid: false, desc: "17:30+60 exceeds pm" },
  ];

  it.each(cases)("$desc: $start + $duration -> valid=$valid", ({ start, duration, valid }) => {
    const s = baDate(start);
    const result = calculateEndAndValidate({
      start: s,
      durationMinutes: duration,
      config: DEFAULT_CONFIG,
    });
    expect(result.valid).toBe(valid);
    if (!valid) expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});

describe("duration — purity and server-only", () => {
  it("imports server-only and does not import from @/db", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "src/services/availability/duration.ts",
      "utf8",
    );
    expect(content).toMatch(/import\s+["']server-only["']/);
    expect(content).not.toMatch(/from\s+["']@\/db/);
    expect(content).not.toMatch(/hardcoded.*-03:00/);
  });

  it("uses config.timezone via Intl, not hardcoded offset", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "src/services/availability/duration.ts",
      "utf8",
    );
    expect(content).toMatch(/config\.timezone/);
    expect(content).toMatch(/Intl\.DateTimeFormat/);
  });
});
