import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { workshopConfigSchema } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { getAvailableSlots, getAvailableSlotsForDate, getBaDayUtcRange } from "@/services/availability/availabilityService";
import { generateSlotsForDate, formatSlotsAsHHmm } from "@/services/availability/slotGenerator";
import { ACTIVE_STATUSES } from "@/services/availability/overlap";

function makeConfig(o?: { slotStepMinutes?: number; timezone?: string; capacityPerSlot?: number; operatingHours?: Record<number, { start: string; end: string }[]> }) {
  return workshopConfigSchema.parse({ slotStepMinutes: o?.slotStepMinutes, timezone: o?.timezone, capacityPerSlot: o?.capacityPerSlot, operatingHours: o?.operatingHours });
}
const CFG = makeConfig();
const MON = new Date("2026-09-07T15:00:00.000Z");
const SAT = new Date("2026-09-12T15:00:00.000Z");
const e = (s: string, en: string, st: string) => ({ start: new Date(`2026-09-07T${s}:00-03:00`), end: new Date(`2026-09-07T${en}:00-03:00`), status: st });

describe("pure — empty/partial/full/closed", () => {
  it("empty returns all candidates", () => {
    const exp = generateSlotsForDate({ date: MON, durationMinutes: 60, config: CFG });
    const res = getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: [] });
    expect(res).toEqual(exp);
    expect(res).toHaveLength(12);
  });
  it("partial 09:00-10:00 blocks 09:00/09:30 not 10:00", () => {
    const res = getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: [e("09:00", "10:00", "PENDIENTE")] });
    const h = formatSlotsAsHHmm(res, CFG.timezone);
    expect(h).not.toContain("09:00"); expect(h).not.toContain("09:30"); expect(h).toContain("10:00"); expect(res).toHaveLength(10);
  });
  it("half-open adjacency 10:00 not blocked", () => {
    const h = formatSlotsAsHHmm(getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: [e("09:00", "10:00", "CONFIRMADO")] }), CFG.timezone);
    expect(h).toContain("10:00");
  });
  it("full occupancy returns []", () => {
    const cands = generateSlotsForDate({ date: MON, durationMinutes: 60, config: CFG });
    const ex = cands.map((c) => ({ start: c.start, end: c.end, status: "PENDIENTE" }));
    expect(getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: ex })).toEqual([]);
  });
  it("closed Saturday returns [] 200 not error", () => {
    expect(getAvailableSlots({ date: SAT, durationMinutes: 60, config: CFG, existingTurnos: [] })).toEqual([]);
    expect(getAvailableSlots({ date: SAT, durationMinutes: 60, config: CFG, existingTurnos: [e("09:00", "10:00", "PENDIENTE")] })).toEqual([]);
  });
});

describe("pure — validation/capacity/step", () => {
  it.each([25, 127, 29, 121, 65.5])("invalid duration %p throws 400", (d) => {
    expect(() => getAvailableSlots({ date: MON, durationMinutes: d as number, config: CFG, existingTurnos: [] })).toThrow(ValidationError);
  });
  it("Invalid Date throws 400", () => {
    expect(() => getAvailableSlots({ date: new Date("invalid"), durationMinutes: 60, config: CFG, existingTurnos: [] })).toThrow(ValidationError);
  });
  it("capacity 2 with count1 available, count2 blocked", () => {
    const c2 = makeConfig({ capacityPerSlot: 2 });
    const avail = getAvailableSlots({ date: MON, durationMinutes: 60, config: c2, existingTurnos: [e("09:00", "10:00", "PENDIENTE")] });
    expect(formatSlotsAsHHmm(avail, c2.timezone)).toContain("09:00");
    const blocked = getAvailableSlots({ date: MON, durationMinutes: 60, config: c2, existingTurnos: [e("09:00", "10:00", "PENDIENTE"), e("09:00", "10:00", "CONFIRMADO")] });
    expect(formatSlotsAsHHmm(blocked, c2.timezone)).not.toContain("09:00");
  });
  it("slotStepMinutes 15 yields superset of 30", () => {
    const c15 = makeConfig({ slotStepMinutes: 15 }); const c30 = makeConfig({ slotStepMinutes: 30 });
    const r15 = getAvailableSlots({ date: MON, durationMinutes: 60, config: c15, existingTurnos: [] });
    const r30 = getAvailableSlots({ date: MON, durationMinutes: 60, config: c30, existingTurnos: [] });
    expect(r15.length).toBeGreaterThan(r30.length); expect(r30).toHaveLength(12);
  });
  it("wrapper invalid duration/Date throws before fetch", async () => {
    const spy = vi.fn(async () => []);
    await expect(getAvailableSlotsForDate({ date: MON, durationMinutes: 25, config: CFG, fetchActiveTurnos: spy })).rejects.toThrow(ValidationError);
    expect(spy).not.toHaveBeenCalled();
    await expect(getAvailableSlotsForDate({ date: new Date("invalid"), durationMinutes: 60, config: CFG, fetchActiveTurnos: spy })).rejects.toThrow(ValidationError);
  });
});

describe("getBaDayUtcRange DST-aware", () => {
  it("BA 2026-09-07 00:00 -> 03:00Z", () => {
    const { fromUtc, toUtc } = getBaDayUtcRange(MON, "America/Argentina/Buenos_Aires");
    expect(fromUtc.toISOString()).toBe("2026-09-07T03:00:00.000Z"); expect(toUtc.toISOString()).toBe("2026-09-08T03:00:00.000Z");
  });
  it("string overload matches Date overload", () => {
    const a = getBaDayUtcRange(MON, "America/Argentina/Buenos_Aires"); const b = getBaDayUtcRange("2026-09-07", "America/Argentina/Buenos_Aires");
    expect(a.fromUtc.toISOString()).toBe(b.fromUtc.toISOString());
  });
  it("NY winter vs summer offsets differ", () => {
    const w = getBaDayUtcRange("2026-01-15", "America/New_York"); expect(w.fromUtc.toISOString()).toBe("2026-01-15T05:00:00.000Z");
    const s = getBaDayUtcRange("2026-07-15", "America/New_York"); expect(s.fromUtc.toISOString()).toBe("2026-07-15T04:00:00.000Z");
    expect(w.fromUtc.toISOString()).not.toBe(s.fromUtc.toISOString());
  });
  it("NY DST start 2026-03-08 23h wall day", () => {
    const { fromUtc, toUtc } = getBaDayUtcRange("2026-03-08", "America/New_York");
    expect(fromUtc.toISOString()).toBe("2026-03-08T05:00:00.000Z"); expect(toUtc.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(toUtc.getTime() - fromUtc.getTime()).toBe(23 * 3600 * 1000);
  });
});

describe("wrapper — single bulk fetch + delegation", () => {
  it("calls fetch exactly once with BA range", async () => {
    const spy = vi.fn(async () => []); const exp = getBaDayUtcRange(MON, CFG.timezone);
    await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: CFG, fetchActiveTurnos: spy });
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = (spy.mock.calls[0] as unknown as [{ fromUtc: Date; toUtc: Date }])[0];
    expect(arg.fromUtc.toISOString()).toBe(exp.fromUtc.toISOString()); expect(arg.toUtc.toISOString()).toBe(exp.toUtc.toISOString());
  });
  it("result equals pure core (table-driven)", async () => {
    for (const { dur, ex } of [{ dur: 60, ex: [] as ReturnType<typeof e>[] }, { dur: 90, ex: [e("09:00", "10:00", "PENDIENTE")] }, { dur: 30, ex: [e("14:00", "15:00", "CONFIRMADO")] }]) {
      const fm = vi.fn(async () => ex);
      const wr = await getAvailableSlotsForDate({ date: MON, durationMinutes: dur, config: CFG, fetchActiveTurnos: fm });
      const pu = getAvailableSlots({ date: MON, durationMinutes: dur, config: CFG, existingTurnos: ex });
      expect(wr).toEqual(pu);
    }
  });
  it("RECHAZADO/CANCELADO does not block", async () => {
    for (const st of ["RECHAZADO", "CANCELADO"]) {
      const fm = vi.fn(async () => [e("09:00", "10:00", st)]);
      const wr = await getAvailableSlotsForDate({ date: MON, durationMinutes: 60, config: CFG, fetchActiveTurnos: fm });
      const empty = getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: [] });
      expect(wr).toEqual(empty); expect(formatSlotsAsHHmm(wr, CFG.timezone)).toContain("09:00");
    }
  });
  it("closed day wrapper returns [] but still fetches once", async () => {
    const spy = vi.fn(async () => []);
    expect(await getAvailableSlotsForDate({ date: SAT, durationMinutes: 60, config: CFG, fetchActiveTurnos: spy })).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("purity and DI", () => {
  it("server-only and no @/db in pure core", async () => {
    const fs = await import("node:fs");
    const c = fs.readFileSync("src/services/availability/availabilityService.ts", "utf8");
    expect(c).toMatch(/import\s+["']server-only["']/); expect(c).not.toMatch(/from\s+["']@\/db/);
  });
  it("reuses ACTIVE_STATUSES, baWallTimeToUtcDate, generateSlotsForDate, isSlotAvailable, DI capacityPerSlot/timezone", async () => {
    const fs = await import("node:fs");
    const c = fs.readFileSync("src/services/availability/availabilityService.ts", "utf8");
    expect(c).toMatch(/ACTIVE_STATUSES/); expect(c).toMatch(/baWallTimeToUtcDate/); expect(c).toMatch(/generateSlotsForDate/);
    expect(c).toMatch(/isSlotAvailable/); expect(c).toMatch(/config\.capacityPerSlot/); expect(c).toMatch(/config\.timezone/);
  });
  it("no hardcoded capacity default or timezone literal", async () => {
    const fs = await import("node:fs");
    const c = fs.readFileSync("src/services/availability/availabilityService.ts", "utf8");
    expect(c).not.toMatch(/capacityPerSlot\s*=\s*1/); expect(c).not.toMatch(/"America\/Argentina\/Buenos_Aires"/);
  });
  it("ACTIVE_STATUSES canonical", () => { expect(ACTIVE_STATUSES).toEqual(["PENDIENTE", "CONFIRMADO"]); });
  it("pure DI same inputs same output", () => {
    const ex = [e("09:00", "10:00", "PENDIENTE")];
    expect(getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: ex })).toEqual(getAvailableSlots({ date: MON, durationMinutes: 60, config: CFG, existingTurnos: ex }));
  });
  it("no hardcoded -03:00", async () => {
    const fs = await import("node:fs");
    const c = fs.readFileSync("src/services/availability/availabilityService.ts", "utf8");
    expect(c).not.toMatch(/"-03:00"/);
  });
});
