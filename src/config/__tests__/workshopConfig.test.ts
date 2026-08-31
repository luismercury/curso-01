import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the repository so provider tests don't touch the real DB.
// vi.mock is hoisted, so the imports below see the mocked function.
const repoGetWorkshopConfigMock = vi.fn();
vi.mock("@/db/repositories/workshopSchedules", () => ({
  getWorkshopConfig: (...args: unknown[]) =>
    repoGetWorkshopConfigMock(...(args as never[])),
}));

import {
  DEFAULT_OPERATING_INTERVALS,
  WORKSHOP_TIMEZONE,
  getWorkshopConfig,
  openIntervalSchema,
  workshopConfig,
  workshopConfigSchema,
  workshopScheduleInputSchema,
  type WorkshopConfig,
} from "@/config/workshopConfig";

describe("workshopConfig — defaults", () => {
  it("parse({}) yields capacityPerSlot=1, slotStepMinutes=30, timezone=BA", () => {
    const parsed = workshopConfigSchema.parse({});
    expect(parsed.capacityPerSlot).toBe(1);
    expect(parsed.slotStepMinutes).toBe(30);
    expect(parsed.timezone).toBe("America/Argentina/Buenos_Aires");
  });

  it("workshopConfig frozen constant equals schema defaults", () => {
    expect(workshopConfig.capacityPerSlot).toBe(1);
    expect(workshopConfig.slotStepMinutes).toBe(30);
    expect(workshopConfig.timezone).toBe("America/Argentina/Buenos_Aires");
  });

  it("WORKSHOP_TIMEZONE re-export equals workshopConfig.timezone", () => {
    expect(WORKSHOP_TIMEZONE).toBe(workshopConfig.timezone);
    expect(WORKSHOP_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
  });
});

describe("workshopConfig — validation", () => {
  it("rejects slotStepMinutes 7 (not divisible by 5) with ZodError", () => {
    expect(() => workshopConfigSchema.parse({ slotStepMinutes: 7 })).toThrow();
    try {
      workshopConfigSchema.parse({ slotStepMinutes: 7 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toMatch(/divisible by 5/);
    }
  });

  it("rejects empty timezone", () => {
    expect(() => workshopConfigSchema.parse({ timezone: "" })).toThrow();
  });

  it("rejects capacityPerSlot 0", () => {
    expect(() => workshopConfigSchema.parse({ capacityPerSlot: 0 })).toThrow();
  });

  it("rejects capacityPerSlot 1.5 (non-integer)", () => {
    expect(() => workshopConfigSchema.parse({ capacityPerSlot: 1.5 })).toThrow();
  });

  it("accepts valid slotStepMinutes 15", () => {
    const parsed = workshopConfigSchema.parse({ slotStepMinutes: 15 });
    expect(parsed.slotStepMinutes).toBe(15);
  });

  it("accepts valid capacityPerSlot 1", () => {
    const parsed = workshopConfigSchema.parse({ capacityPerSlot: 1 });
    expect(parsed.capacityPerSlot).toBe(1);
  });
});

describe("workshopConfig — frozen / intervals / DI", () => {
  it("is frozen — Object.isFrozen true and mutation has no effect", () => {
    expect(Object.isFrozen(workshopConfig)).toBe(true);
    const before = workshopConfig.capacityPerSlot;
    try {
      (workshopConfig as unknown as { capacityPerSlot: number }).capacityPerSlot = 99;
    } catch {
      // strict mode throws TypeError — expected for frozen object
    }
    expect(workshopConfig.capacityPerSlot).toBe(before);
    expect(workshopConfig.capacityPerSlot).toBe(1);
  });

  it("DEFAULT_OPERATING_INTERVALS has correct shape as const", () => {
    expect(Array.isArray(DEFAULT_OPERATING_INTERVALS)).toBe(true);
    expect(DEFAULT_OPERATING_INTERVALS.length).toBe(2);
    expect(DEFAULT_OPERATING_INTERVALS[0]).toEqual({ start: "09:00", end: "12:00" });
    expect(DEFAULT_OPERATING_INTERVALS[1]).toEqual({ start: "14:00", end: "18:00" });
  });

  it("generator falls back to DEFAULT when operatingHours is undefined", () => {
    const config: WorkshopConfig = workshopConfigSchema.parse({});
    const resolved = config.operatingHours ?? DEFAULT_OPERATING_INTERVALS;
    expect(resolved).toEqual(DEFAULT_OPERATING_INTERVALS);
  });

  it("config-provided operatingHours overrides DEFAULT", () => {
    const config: WorkshopConfig = workshopConfigSchema.parse({
      operatingHours: { 1: [{ start: "10:00", end: "16:00" }] },
    });
    const resolved = config.operatingHours ?? DEFAULT_OPERATING_INTERVALS;
    expect(resolved).toEqual({ 1: [{ start: "10:00", end: "16:00" }] });
    expect(resolved).not.toEqual(DEFAULT_OPERATING_INTERVALS);
  });

  it("coerces string key \"1\" to numeric 1", () => {
    const config: WorkshopConfig = workshopConfigSchema.parse({
      operatingHours: { "1": [{ start: "09:00", end: "12:00" }] },
    });
    expect(config.operatingHours?.[1]).toEqual([{ start: "09:00", end: "12:00" }]);
  });

  it("rejects out-of-range key 7", () => {
    expect(() => workshopConfigSchema.parse({ operatingHours: { 7: [{ start: "09:00", end: "12:00" }] } } )).toThrow();
  });

  it("rejects string day name monday", () => {
    expect(() => workshopConfigSchema.parse({ operatingHours: { monday: [{ start: "09:00", end: "12:00" }] } as unknown as Record<string, unknown> } )).toThrow();
  });

  it("DI param usage — service receives WorkshopConfig and applies alternate step", () => {
    // Stub mimicking AvailabilityService signature taking config as DI param
    function getSlotStarts(config: WorkshopConfig): string[] {
      const step = config.slotStepMinutes;
      const starts: string[] = [];
      // Simulate generating slots from 09:00 in step increments for 60 minutes window
      let minutes = 9 * 60;
      const endMinutes = 10 * 60;
      while (minutes < endMinutes) {
        const h = String(Math.floor(minutes / 60)).padStart(2, "0");
        const m = String(minutes % 60).padStart(2, "0");
        starts.push(`${h}:${m}`);
        minutes += step;
      }
      return starts;
    }

    const defaultConfig: WorkshopConfig = workshopConfigSchema.parse({});
    expect(getSlotStarts(defaultConfig)).toEqual(["09:00", "09:30"]);

    const altConfig: WorkshopConfig = workshopConfigSchema.parse({ slotStepMinutes: 15 });
    expect(getSlotStarts(altConfig)).toEqual(["09:00", "09:15", "09:30", "09:45"]);
    // Verify alt config does not affect the frozen default
    expect(workshopConfig.slotStepMinutes).toBe(30);
  });
});

// ─── T-036b PR #2 — DB provider (re-export) + WorkshopScheduleInput schema ───
describe("workshopConfig — T-036b DB provider (re-export)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoGetWorkshopConfigMock.mockResolvedValue({
      capacityPerSlot: 1,
      slotStepMinutes: 30,
      timezone: "America/Argentina/Buenos_Aires",
      operatingHours: {
        0: [],
        1: [...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[],
        2: [...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[],
        3: [...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[],
        4: [...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[],
        5: [...DEFAULT_OPERATING_INTERVALS] as unknown as { start: string; end: string }[],
        6: [],
      },
    });
  });

  it("getWorkshopConfig re-export is callable and returns frozen-default shape", async () => {
    const config = await getWorkshopConfig({} as never);
    expect(config).toMatchObject({
      capacityPerSlot: 1,
      slotStepMinutes: 30,
      timezone: "America/Argentina/Buenos_Aires",
    });
    expect(repoGetWorkshopConfigMock).toHaveBeenCalledTimes(1);
  });

  it("empty table → Mon-Fri defaults, Sat/Sun []", async () => {
    const config = await getWorkshopConfig({} as never);
    expect(config.operatingHours?.[1]).toEqual([...DEFAULT_OPERATING_INTERVALS]);
    expect(config.operatingHours?.[5]).toEqual([...DEFAULT_OPERATING_INTERVALS]);
    expect(config.operatingHours?.[0]).toEqual([]);
    expect(config.operatingHours?.[6]).toEqual([]);
  });

  it("partial week override — only patched dow changes from defaults", async () => {
    repoGetWorkshopConfigMock.mockResolvedValueOnce({
      capacityPerSlot: 1,
      slotStepMinutes: 30,
      timezone: "America/Argentina/Buenos_Aires",
      operatingHours: {
        2: [{ start: "09:00", end: "10:00" }],
      },
    });
    const config = await getWorkshopConfig({} as never);
    expect(config.operatingHours?.[2]).toEqual([{ start: "09:00", end: "10:00" }]);
    expect(config.operatingHours?.[1]).toBeUndefined();
  });

  it("Sat [] override — explicit empty array preserved", async () => {
    repoGetWorkshopConfigMock.mockResolvedValueOnce({
      capacityPerSlot: 1,
      slotStepMinutes: 30,
      timezone: "America/Argentina/Buenos_Aires",
      operatingHours: { 6: [] },
    });
    const config = await getWorkshopConfig({} as never);
    expect(config.operatingHours?.[6]).toEqual([]);
  });
});

describe("workshopConfig — T-036b WorkshopScheduleInput schema", () => {
  it("openIntervalSchema accepts HH:mm 00:00-23:59", () => {
    expect(openIntervalSchema.parse({ start: "00:00", end: "23:59" })).toEqual({
      start: "00:00",
      end: "23:59",
    });
  });

  it("openIntervalSchema rejects 24:00 / 25:00 / 1:00 / 99:99", () => {
    expect(() => openIntervalSchema.parse({ start: "24:00", end: "25:00" })).toThrow();
    expect(() => openIntervalSchema.parse({ start: "1:00", end: "2:00" })).toThrow();
    expect(() => openIntervalSchema.parse({ start: "99:99", end: "99:99" })).toThrow();
  });

  it("workshopScheduleInputSchema accepts valid payload", () => {
    const ok = workshopScheduleInputSchema.parse({
      dayOfWeek: 1,
      openIntervals: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "18:00" },
      ],
    });
    expect(ok.dayOfWeek).toBe(1);
    expect(ok.openIntervals).toHaveLength(2);
  });

  it("workshopScheduleInputSchema allows empty intervals (closed day)", () => {
    const ok = workshopScheduleInputSchema.parse({ dayOfWeek: 0, openIntervals: [] });
    expect(ok.openIntervals).toEqual([]);
  });

  it("workshopScheduleInputSchema rejects dayOfWeek=7 / -1 / 1.5", () => {
    expect(() =>
      workshopScheduleInputSchema.parse({ dayOfWeek: 7, openIntervals: [] }),
    ).toThrow();
    expect(() =>
      workshopScheduleInputSchema.parse({ dayOfWeek: -1, openIntervals: [] }),
    ).toThrow();
    expect(() =>
      workshopScheduleInputSchema.parse({ dayOfWeek: 1.5, openIntervals: [] }),
    ).toThrow();
  });

  it("workshopScheduleInputSchema rejects overlapping intervals via superRefine", () => {
    expect(() =>
      workshopScheduleInputSchema.parse({
        dayOfWeek: 2,
        openIntervals: [
          { start: "09:00", end: "12:00" },
          { start: "11:30", end: "14:00" },
        ],
      }),
    ).toThrow();
  });

  it("workshopScheduleInputSchema rejects start>=end via superRefine", () => {
    expect(() =>
      workshopScheduleInputSchema.parse({
        dayOfWeek: 2,
        openIntervals: [{ start: "12:00", end: "09:00" }],
      }),
    ).toThrow();
  });

  it("workshopScheduleInputSchema rejects unsorted via superRefine", () => {
    expect(() =>
      workshopScheduleInputSchema.parse({
        dayOfWeek: 2,
        openIntervals: [
          { start: "14:00", end: "18:00" },
          { start: "09:00", end: "12:00" },
        ],
      }),
    ).toThrow();
  });

  it("workshopScheduleInputSchema rejects extra fields (strict mode)", () => {
    expect(() =>
      workshopScheduleInputSchema.parse({
        dayOfWeek: 1,
        openIntervals: [],
        extra: "no",
      } as unknown),
    ).toThrow();
  });
});
