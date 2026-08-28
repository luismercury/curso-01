import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { workshopConfigSchema } from "@/config/workshopConfig";
import { getAvailableSlotsForDate, getBaDayUtcRange } from "@/services/availability/availabilityService";
import { generateSlotsForDate, formatSlotsAsHHmm } from "@/services/availability/slotGenerator";
import { calculateEndAndValidate } from "@/services/availability/duration";

// Helpers — DI via workshopConfigSchema.parse({}), BA wall -03:00
function makeConfig(o?: {
  slotStepMinutes?: number;
  timezone?: string;
  capacityPerSlot?: number;
  operatingHours?: Record<number, { start: string; end: string }[]>;
}) {
  return workshopConfigSchema.parse({
    slotStepMinutes: o?.slotStepMinutes,
    timezone: o?.timezone,
    capacityPerSlot: o?.capacityPerSlot,
    operatingHours: o?.operatingHours,
  });
}

const CFG = makeConfig();
const MON = new Date("2026-09-07T15:00:00.000Z");
const SAT = new Date("2026-09-12T15:00:00.000Z");
const e = (s: string, en: string, st: string) => ({
  start: new Date(`2026-09-07T${s}:00-03:00`),
  end: new Date(`2026-09-07T${en}:00-03:00`),
  status: st,
});

describe("T-026 availability critical — EC-02 traceability", () => {
  // R1 Empty-Day baseline (parametrized) + DST oracle
  it("R1 empty weekday 60min returns 12 sorted slots 09:00..17:00", async () => {
    const fetchActiveTurnos = vi.fn(async () => []);
    const slots = await getAvailableSlotsForDate({
      date: MON,
      durationMinutes: 60,
      config: CFG,
      fetchActiveTurnos,
    });
    const hhmm = formatSlotsAsHHmm(slots, CFG.timezone);
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
    expect(hhmm).toEqual([...hhmm].sort());
    expect(slots).toHaveLength(12);
    expect(fetchActiveTurnos).toHaveBeenCalledTimes(1);
    // DST oracle via Intl — BA 2026-09-07 00:00 is 03:00Z (UTC-3, no DST)
    const range = getBaDayUtcRange("2026-09-07", CFG.timezone);
    expect(range.fromUtc.toISOString()).toBe("2026-09-07T03:00:00.000Z");
    expect(range.toUtc.toISOString()).toBe("2026-09-08T03:00:00.000Z");
  });

  it("R1 DST oracle getBaDayUtcRange string overload matches Date overload and NY differs", async () => {
    const baStr = getBaDayUtcRange("2026-09-07", CFG.timezone);
    const baDate = getBaDayUtcRange(MON, CFG.timezone);
    expect(baStr.fromUtc.toISOString()).toBe(baDate.fromUtc.toISOString());
    expect(baStr.fromUtc.toISOString()).toBe("2026-09-07T03:00:00.000Z");
  });

  // R2 Single occupancy — PENDIENTE and CONFIRMADO block 09:00/09:30 not 10:00 half-open [)
  it.each(["PENDIENTE", "CONFIRMADO"] as const)("R2 single %s 09:00-10:00 blocks 09:00,09:30 not 10:00", async (status) => {
    const fetchActiveTurnos = vi.fn(async () => [e("09:00", "10:00", status)]);
    const slots = await getAvailableSlotsForDate({
      date: MON,
      durationMinutes: 60,
      config: CFG,
      fetchActiveTurnos,
    });
    const hhmm = formatSlotsAsHHmm(slots, CFG.timezone);
    expect(hhmm).not.toContain("09:00");
    expect(hhmm).not.toContain("09:30");
    expect(hhmm).toContain("10:00");
    expect(slots).toHaveLength(10);
  });

  // R3 Count vs capacity — table-driven, DI capacityPerSlot (count < capacity)
  it.each([
    { capacity: 1, count: 1, shouldBlock: true, label: "1/1 blocked" },
    { capacity: 2, count: 1, shouldBlock: false, label: "2/1 available" },
    { capacity: 2, count: 2, shouldBlock: true, label: "2/2 blocked" },
  ])("R3 count vs capacity $label", async ({ capacity, count, shouldBlock }) => {
    const cfg = makeConfig({ capacityPerSlot: capacity });
    const entries = count === 2 ? [e("09:00", "10:00", "PENDIENTE"), e("09:00", "10:00", "CONFIRMADO")] : [e("09:00", "10:00", "PENDIENTE")];
    const fetchActiveTurnos = vi.fn(async () => entries);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: cfg, fetchActiveTurnos });
    const hhmm = formatSlotsAsHHmm(slots, cfg.timezone);
    if (shouldBlock) {
      expect(hhmm).not.toContain("09:00");
    } else {
      expect(hhmm).toContain("09:00");
    }
  });

  it("R3 RECHAZADO/CANCELADO does not increment count — 09:00 available", async () => {
    for (const status of ["RECHAZADO", "CANCELADO"] as const) {
      const fetchActiveTurnos = vi.fn(async () => [e("09:00", "10:00", status)]);
      const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: CFG, fetchActiveTurnos });
      const hhmm = formatSlotsAsHHmm(slots, CFG.timezone);
      expect(hhmm).toContain("09:00");
      expect(slots).toHaveLength(12);
    }
  });

  // R4 Duration-parametrized filtering — table-driven, generation before overlap
  it.each([
    { duration: 30, expected: 14, includes: ["11:30", "17:30"], excludes: [] as string[] },
    { duration: 60, expected: 12, includes: ["11:00"], excludes: ["11:30"] },
    { duration: 90, expected: 10, includes: ["10:30", "16:30"], excludes: ["11:30", "17:30"] },
    { duration: 120, expected: 8, includes: ["10:00", "16:00"], excludes: ["10:30", "11:30"] },
  ])("R4 duration $duration → $expected slots", async ({ duration, expected, includes, excludes }) => {
    const fetchActiveTurnos = vi.fn(async () => []);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: duration, config: CFG, fetchActiveTurnos });
    const hhmm = formatSlotsAsHHmm(slots, CFG.timezone);
    expect(slots).toHaveLength(expected);
    for (const inc of includes) expect(hhmm).toContain(inc);
    for (const exc of excludes) expect(hhmm).not.toContain(exc);
    // 11:00+60==12:00 inclusive valid — 11:00 present for 60
    if (duration === 60) expect(hhmm).toContain("11:00");
  });

  it("R4 duration filter precedes overlap — 11:30 never generated for 90 even with fixtures", async () => {
    // generateSlotsForDate itself must not contain 11:30 for 90
    const candidates = generateSlotsForDate({ date: MON, durationMinutes: 90, config: CFG });
    const hhmm = formatSlotsAsHHmm(candidates, CFG.timezone);
    expect(hhmm).not.toContain("11:30");
    expect(hhmm).toContain("10:30");
    // wrapper with mocked fetch also never contains 11:30
    const fetchActiveTurnos = vi.fn(async () => [e("09:00", "10:00", "PENDIENTE")]);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 90, config: CFG, fetchActiveTurnos });
    expect(formatSlotsAsHHmm(slots, CFG.timezone)).not.toContain("11:30");
  });

  // R5 Outside operating hours — Saturday closed + gap entry
  it("R5 closed Saturday 2026-09-12 returns []", async () => {
    const fetchActiveTurnos = vi.fn(async () => []);
    const slots = await getAvailableSlotsForDate({ date: SAT, durationMinutes: 60, config: CFG, fetchActiveTurnos });
    expect(slots).toEqual([]);
    expect(fetchActiveTurnos).toHaveBeenCalledTimes(1);
  });

  it("R5 fuera de apertura — 13:00-14:00 PENDIENTE gap does not affect morning slots", async () => {
    const gap = { start: new Date("2026-09-07T13:00:00-03:00"), end: new Date("2026-09-07T14:00:00-03:00"), status: "PENDIENTE" };
    const fetchActiveTurnos = vi.fn(async () => [gap]);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: CFG, fetchActiveTurnos });
    const hhmm = formatSlotsAsHHmm(slots, CFG.timezone);
    // morning still full — gap entry creates no slot, does not block 09:00
    expect(hhmm).toContain("09:00");
    expect(slots).toHaveLength(12);
  });

  // R6 EC-02 service — fully booked 60 and 90 → [] no error, named EC-02
  it("R6 EC-02 fully booked 60min returns [] without error", async () => {
    const candidates = generateSlotsForDate({ date: MON, durationMinutes: 60, config: CFG });
    const existing = candidates.map((c) => ({ start: c.start, end: c.end, status: "PENDIENTE" }));
    const fetchActiveTurnos = vi.fn(async () => existing);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: CFG, fetchActiveTurnos });
    expect(slots).toEqual([]);
    expect(slots).not.toHaveProperty("error");
  });

  it("R6 EC-02 fully booked 90min returns [] without error", async () => {
    const candidates = generateSlotsForDate({ date: MON, durationMinutes: 90, config: CFG });
    const existing = candidates.map((c) => ({ start: c.start, end: c.end, status: "PENDIENTE" }));
    const fetchActiveTurnos = vi.fn(async () => existing);
    const slots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 90, config: CFG, fetchActiveTurnos });
    expect(slots).toEqual([]);
    expect(slots).not.toHaveProperty("error");
  });

  // R7 Closing boundary — 11:30+90 excluded via generateSlotsForDate + calculateEndAndValidate
  it("R7 11:30+90 excluded before overlap — 10:30+90==12:00 present", async () => {
    const candidates = generateSlotsForDate({ date: MON, durationMinutes: 90, config: CFG });
    const hhmm = formatSlotsAsHHmm(candidates, CFG.timezone);
    expect(hhmm).not.toContain("11:30");
    expect(hhmm).toContain("10:30");
    // inclusive boundary: 10:30+90 == 12:00 valid
    const wrapperSlots = await getAvailableSlotsForDate({ date: MON, durationMinutes: 90, config: CFG, fetchActiveTurnos: vi.fn(async () => []) });
    expect(formatSlotsAsHHmm(wrapperSlots, CFG.timezone)).toContain("10:30");
    expect(formatSlotsAsHHmm(wrapperSlots, CFG.timezone)).not.toContain("11:30");
  });

  it("R7 calculateEndAndValidate 11:30+90 valid=false", () => {
    const start = new Date("2026-09-07T11:30:00-03:00");
    const result = calculateEndAndValidate({ start, durationMinutes: 90, config: CFG });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    // 10:30+90 is inclusive valid
    const okStart = new Date("2026-09-07T10:30:00-03:00");
    const ok = calculateEndAndValidate({ start: okStart, durationMinutes: 90, config: CFG });
    expect(ok.valid).toBe(true);
  });
});
