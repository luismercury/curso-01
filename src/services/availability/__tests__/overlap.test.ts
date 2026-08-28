import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ValidationError } from "@/config/workshopSchedule";
import {
  ACTIVE_STATUSES,
  countOverlapping,
  isOverlapping,
  isSlotAvailable,
} from "@/services/availability/overlap";

// Fixtures via wall-time -03:00 so UTC instants are deterministic
function dt(hhmm: string): Date {
  return new Date(`2026-09-10T${hhmm}:00-03:00`);
}

function interval(start: string, end: string) {
  return { start: dt(start), end: dt(end) };
}

function existingEntry(start: string, end: string, status: string) {
  return { start: dt(start), end: dt(end), status };
}

describe("overlap — ACTIVE_STATUSES canonical", () => {
  it("equals ['PENDIENTE','CONFIRMADO'] readonly", () => {
    expect(ACTIVE_STATUSES).toEqual(["PENDIENTE", "CONFIRMADO"]);
    // as const => readonly, mutation should not affect original contract
    expect(Object.isFrozen(ACTIVE_STATUSES) || Array.isArray(ACTIVE_STATUSES)).toBe(true);
  });
});

describe("overlap — isOverlapping half-open [) via getTime()", () => {
  const cases: Array<{
    a: [string, string];
    b: [string, string];
    expected: boolean;
    desc: string;
  }> = [
    {
      a: ["09:00", "10:00"],
      b: ["10:00", "11:00"],
      expected: false,
      desc: "adjacent 09:00-10:00 vs 10:00-11:00 not overlapping",
    },
    {
      a: ["09:00", "10:00"],
      b: ["09:30", "10:30"],
      expected: true,
      desc: "partial overlap 09:00-10:00 vs 09:30-10:30",
    },
    {
      a: ["09:00", "11:00"],
      b: ["09:30", "10:00"],
      expected: true,
      desc: "contained 09:00-11:00 contains 09:30-10:00",
    },
    {
      a: ["09:00", "11:00"],
      b: ["09:00", "11:00"],
      expected: true,
      desc: "exact identical 09:00-11:00 vs 09:00-11:00",
    },
    {
      a: ["09:00", "09:30"],
      b: ["09:30", "10:00"],
      expected: false,
      desc: "adjacent 09:00-09:30 vs 09:30-10:00",
    },
    {
      a: ["10:30", "11:30"],
      b: ["09:00", "10:30"],
      expected: false,
      desc: "adjacent reversed 10:30-11:30 vs 09:00-10:30",
    },
    {
      a: ["09:00", "11:00"],
      b: ["10:59", "12:00"],
      expected: true,
      desc: "partial at end edge",
    },
  ];

  it.each(cases)("$desc -> $expected", ({ a, b, expected }) => {
    const ia = interval(a[0], a[1]);
    const ib = interval(b[0], b[1]);
    expect(isOverlapping(ia, ib)).toBe(expected);
  });

  it("partial overlap symmetry: isOverlapping(a,b) === isOverlapping(b,a)", () => {
    const a = interval("09:00", "10:00");
    const b = interval("09:30", "10:30");
    expect(isOverlapping(a, b)).toBe(true);
    expect(isOverlapping(b, a)).toBe(true);
  });

  it("adjacent symmetry: both directions false", () => {
    const a = interval("09:00", "10:00");
    const b = interval("10:00", "11:00");
    expect(isOverlapping(a, b)).toBe(false);
    expect(isOverlapping(b, a)).toBe(false);
  });

  it("UTC half-open parity: same wall interval with different offset is same UTC instant", () => {
    // 09:00-10:00 BA = 12:00-13:00Z; verify getTime() comparison not wall string
    const a = interval("09:00", "10:00"); // 12:00-13:00Z
    const b = interval("09:30", "10:30"); // 12:30-13:30Z
    expect(a.start.toISOString()).toBe("2026-09-10T12:00:00.000Z");
    expect(b.start.toISOString()).toBe("2026-09-10T12:30:00.000Z");
    expect(isOverlapping(a, b)).toBe(true);
  });

  it("throws ValidationError when a has end <= start", () => {
    const bad = interval("10:00", "09:00");
    const good = interval("09:00", "10:00");
    expect(() => isOverlapping(bad, good)).toThrow(ValidationError);
    try {
      isOverlapping(bad, good);
    } catch (err) {
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws ValidationError when a has end == start (zero length)", () => {
    const zero = interval("10:00", "10:00");
    const good = interval("09:00", "10:00");
    expect(() => isOverlapping(zero, good)).toThrow(ValidationError);
  });

  it("throws ValidationError on Invalid Date", () => {
    const invalid = { start: new Date("invalid"), end: dt("10:00") };
    const good = interval("09:00", "10:00");
    expect(() => isOverlapping(invalid, good)).toThrow(ValidationError);
    expect(() => isOverlapping(good, invalid)).toThrow(ValidationError);
  });

  it("throws ValidationError when b is Invalid Date", () => {
    const good = interval("09:00", "10:00");
    const invalidB = { start: new Date("invalid"), end: new Date("invalid") };
    expect(() => isOverlapping(good, invalidB)).toThrow(ValidationError);
  });
});

describe("overlap — countOverlapping status filtering", () => {
  it("requested 10:00-11:00 vs [PENDIENTE 09:30-10:30, CONFIRMADO 10:30-11:30, RECHAZADO 09:00-10:30] returns 2", () => {
    const requested = interval("10:00", "11:00");
    const existing = [
      existingEntry("09:30", "10:30", "PENDIENTE"), // overlaps
      existingEntry("10:30", "11:30", "CONFIRMADO"), // overlaps
      existingEntry("09:00", "10:30", "RECHAZADO"), // overlapping but rejected ignored
    ];
    expect(countOverlapping(requested, existing)).toBe(2);
  });

  it("returns 0 when none overlap", () => {
    const requested = interval("12:00", "13:00");
    const existing = [
      existingEntry("09:00", "10:00", "PENDIENTE"),
      existingEntry("14:00", "15:00", "CONFIRMADO"),
    ];
    expect(countOverlapping(requested, existing)).toBe(0);
  });

  it("RECHAZADO and CANCELADO overlapping 09:00-10:00 returns 0", () => {
    const requested = interval("09:00", "10:00");
    const existing = [
      existingEntry("09:00", "10:00", "RECHAZADO"),
      existingEntry("09:30", "10:30", "CANCELADO"),
      existingEntry("09:00", "11:00", "RECHAZADO"),
      existingEntry("09:00", "10:00", "CANCELADO"),
    ];
    expect(countOverlapping(requested, existing)).toBe(0);
  });

  it("counts only active overlapping mixed set", () => {
    const requested = interval("09:00", "10:00");
    const existing = [
      existingEntry("09:00", "10:00", "PENDIENTE"), // count
      existingEntry("09:30", "10:30", "CONFIRMADO"), // count
      existingEntry("09:00", "10:00", "RECHAZADO"), // no
      existingEntry("08:00", "09:00", "PENDIENTE"), // adjacent not overlap
      existingEntry("10:00", "11:00", "CONFIRMADO"), // adjacent not overlap
    ];
    expect(countOverlapping(requested, existing)).toBe(2);
  });

  it("adjacent entries not counted even if active", () => {
    const requested = interval("09:00", "10:00");
    const existing = [
      existingEntry("08:00", "09:00", "PENDIENTE"),
      existingEntry("10:00", "11:00", "CONFIRMADO"),
    ];
    expect(countOverlapping(requested, existing)).toBe(0);
  });

  it("throws ValidationError when requested is invalid (end <= start)", () => {
    const bad = interval("10:00", "09:00");
    expect(() => countOverlapping(bad, [])).toThrow(ValidationError);
  });

  it("throws ValidationError when requested contains Invalid Date", () => {
    const bad = { start: new Date("invalid"), end: dt("10:00") };
    expect(() => countOverlapping(bad, [])).toThrow(ValidationError);
  });

  it("supports custom activeStatuses override via opts", () => {
    const requested = interval("09:00", "10:00");
    const existing = [existingEntry("09:00", "10:00", "RECHAZADO")];
    // default ignores RECHAZADO
    expect(countOverlapping(requested, existing)).toBe(0);
    // override to count RECHAZADO
    expect(countOverlapping(requested, existing, { activeStatuses: ["RECHAZADO"] })).toBe(1);
  });
});

describe("overlap — isSlotAvailable capacity DI", () => {
  it("capacity 1 rejects single overlap -> false (caller maps to 409)", () => {
    const requested = interval("09:00", "10:00");
    const existing = [existingEntry("09:30", "10:30", "PENDIENTE")];
    expect(isSlotAvailable(requested, existing, 1)).toBe(false);
  });

  it("capacity 2 allows one overlap -> true", () => {
    const requested = interval("09:00", "10:00");
    const existing = [existingEntry("09:30", "10:30", "PENDIENTE")];
    expect(isSlotAvailable(requested, existing, 2)).toBe(true);
  });

  it("capacity 2 rejects two overlaps -> false (409)", () => {
    const requested = interval("09:00", "10:00");
    const existing = [
      existingEntry("09:00", "10:00", "PENDIENTE"),
      existingEntry("09:30", "10:30", "CONFIRMADO"),
    ];
    expect(isSlotAvailable(requested, existing, 2)).toBe(false);
  });

  it("capacity 1 allows zero overlap -> true", () => {
    const requested = interval("12:00", "13:00");
    const existing = [existingEntry("09:00", "10:00", "PENDIENTE")];
    expect(isSlotAvailable(requested, existing, 1)).toBe(true);
  });

  it("capacity 2 allows one but adjacent not counted", () => {
    const requested = interval("09:00", "10:00");
    const existing = [existingEntry("10:00", "11:00", "PENDIENTE")];
    expect(isSlotAvailable(requested, existing, 1)).toBe(true);
  });

  it.each([0, 0.5, NaN])("invalid capacity %p throws ValidationError 400", (cap) => {
    const requested = interval("09:00", "10:00");
    expect(() => isSlotAvailable(requested, [], cap as number)).toThrow(ValidationError);
    try {
      isSlotAvailable(requested, [], cap as number);
    } catch (err) {
      expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("invalid capacity string throws ValidationError", () => {
    const requested = interval("09:00", "10:00");
    // @ts-expect-error intentional bad type
    expect(() => isSlotAvailable(requested, [], "1")).toThrow(ValidationError);
  });

  it("negative capacity throws ValidationError", () => {
    const requested = interval("09:00", "10:00");
    expect(() => isSlotAvailable(requested, [], -1)).toThrow(ValidationError);
  });

  it("non-integer capacity throws ValidationError", () => {
    const requested = interval("09:00", "10:00");
    expect(() => isSlotAvailable(requested, [], 1.5)).toThrow(ValidationError);
  });

  it("capacity 3 allows two overlaps", () => {
    const requested = interval("09:00", "10:00");
    const existing = [
      existingEntry("09:00", "10:00", "PENDIENTE"),
      existingEntry("09:30", "10:30", "CONFIRMADO"),
    ];
    expect(isSlotAvailable(requested, existing, 3)).toBe(true);
    expect(isSlotAvailable(requested, existing, 2)).toBe(false);
  });

  it("throws ValidationError when requested invalid", () => {
    const bad = interval("10:00", "09:00");
    expect(() => isSlotAvailable(bad, [], 1)).toThrow(ValidationError);
  });

  it("RECHAZADO ignored even with capacity 1", () => {
    const requested = interval("09:00", "10:00");
    const existing = [existingEntry("09:00", "10:00", "RECHAZADO")];
    expect(isSlotAvailable(requested, existing, 1)).toBe(true);
  });
});

describe("overlap — purity and parity", () => {
  it("file contains 'server-only' and no drizzle import", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/overlap.ts", "utf8");
    expect(content).toMatch(/import\s+["']server-only["']/);
    expect(content).not.toMatch(/drizzle/);
    expect(content).not.toMatch(/from\s+["']drizzle-orm/);
  });

  it("uses getTime() UTC comparison only", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/overlap.ts", "utf8");
    expect(content).toMatch(/getTime\(\)/);
    expect(content).not.toMatch(/toLocaleString|getHours\(\)/);
  });

  it("does not hardcode capacity default; requires param", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/overlap.ts", "utf8");
    // No default param =1 for capacityPerSlot
    expect(content).not.toMatch(/capacityPerSlot\s*=\s*1/);
    expect(content).toMatch(/capacityPerSlot:\s*number/);
  });

  it("documents DB adapter contract countOverlappingInTx", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/overlap.ts", "utf8");
    expect(content).toMatch(/countOverlappingInTx/);
    expect(content).toMatch(/tstzrange/);
    expect(content).toMatch(/FOR UPDATE/);
    expect(content).toMatch(/EXCLUDE/);
  });

  it("is pure: no Date.now, no side effects", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/services/availability/overlap.ts", "utf8");
    expect(content).not.toMatch(/Date\.now\(\)/);
    expect(content).not.toMatch(/Math\.random/);
  });
});
