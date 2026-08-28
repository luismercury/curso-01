import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_OPERATING_INTERVALS,
  WORKSHOP_TIMEZONE,
  workshopConfig,
  workshopConfigSchema,
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
