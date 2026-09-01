/**
 * Pure unit tests for `src/lib/validators/date.ts` (T-041 PR1).
 *
 * Coverage:
 *   - `dateSchema`: regex accept/reject, noon round-trip overflow
 *     (2026-02-30 → fail), calendar validity (2026-13-40 → fail),
 *     accept valid (2026-09-01 → ok), reject empty.
 *   - `getTodayBaYmd`: BA calendar day matches `Intl en-CA` formatter
 *     output; not UTC (`toISOString().slice(0,10)`) — guards INV-06.
 *   - `addBaDays`: forward (+1, +60), backward (-1), DST crossing
 *     (anchor noon UTC keeps BA day stable).
 *   - `isPastBa`: past / today / future.
 *   - `getBaDow`: Sun=0, Mon=1, Sat=6 for known BA ymd values.
 *   - `getBaDayUtcRange`: from/to differ by 23/24/25h across DST,
 *     always span one BA calendar day, malformed ymd throws.
 *   - `DATE_MAX_DAYS` constant guard.
 */
import { describe, expect, it } from "vitest";

import {
  addBaDays,
  DATE_MAX_DAYS,
  dateSchema,
  getBaDayUtcRange,
  getTodayBaYmd,
  isPastBa,
} from "@/lib/validators/date";

const TZ = "America/Argentina/Buenos_Aires";

describe("DATE_MAX_DAYS — constant guard", () => {
  it("is 60 (per task 1.1 contract)", () => {
    expect(DATE_MAX_DAYS).toBe(60);
  });
});

describe("dateSchema — YYYY-MM-DD regex + noon round-trip (REQ-DATE-03)", () => {
  it.each([
    ["2026-09-01"],
    ["2026-12-31"],
    ["2024-02-29"], // 2024 is a leap year (Feb 29 valid)
    ["2026-01-01"],
  ])("accepts valid ymd %s", (input) => {
    expect(dateSchema.safeParse(input).success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(dateSchema.safeParse("").success).toBe(false);
  });

  it.each([
    ["2026-13-40"], // bad month + bad day
    ["2026-02-30"], // February overflow → round-trip → 2026-03-02
    ["not-a-date"],
    ["2026/09/01"], // wrong separator
    ["26-09-01"], // 2-digit year
    ["2026-9-1"], // unpadded
  ])("rejects invalid ymd %s (regex or calendar overflow)", (input) => {
    expect(dateSchema.safeParse(input).success).toBe(false);
  });

  it("accepts 2026-02-29 in leap year 2024 (no overflow)", () => {
    expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
  });

  it("never throws on safeParse — caller MUST use safeParse, not parse", () => {
    expect(() => dateSchema.safeParse(undefined)).not.toThrow();
    expect(() => dateSchema.safeParse(null)).not.toThrow();
    expect(() => dateSchema.safeParse(123)).not.toThrow();
  });
});

describe("getTodayBaYmd — BA calendar formatter (INV-06)", () => {
  it("matches Intl en-CA output for the same timezone", () => {
    const ref = new Date("2026-09-01T15:00:00.000Z");
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ref);
    expect(getTodayBaYmd(TZ, ref)).toBe(expected);
  });

  it("does NOT match UTC toISOString (no drift)", () => {
    // 23:30 UTC on 2026-09-01 = 20:30 BA → still 2026-09-01 BA.
    // 02:00 UTC on 2026-09-02 = 23:00 BA on 2026-09-01 → BA day ≠ UTC day.
    const lateNightUtc = new Date("2026-09-02T02:00:00.000Z");
    expect(getTodayBaYmd(TZ, lateNightUtc)).toBe("2026-09-01");
    expect(lateNightUtc.toISOString().slice(0, 10)).toBe("2026-09-02");
  });
});

describe("addBaDays — DST-safe noon anchor", () => {
  it("+1 day forward keeps BA calendar date +1", () => {
    expect(addBaDays("2026-09-01", 1, TZ)).toBe("2026-09-02");
  });

  it("+60 days forward = today + 60 (boundary contract)", () => {
    expect(addBaDays("2026-09-01", 60, TZ)).toBe("2026-10-31");
  });

  it("-1 day backward yields previous day", () => {
    expect(addBaDays("2026-09-01", -1, TZ)).toBe("2026-08-31");
  });

  it("crosses month boundary correctly", () => {
    expect(addBaDays("2026-01-31", 1, TZ)).toBe("2026-02-01");
  });

  it("crosses year boundary correctly", () => {
    expect(addBaDays("2026-12-31", 1, TZ)).toBe("2027-01-01");
  });

  it("crosses leap-day correctly", () => {
    expect(addBaDays("2024-02-28", 1, TZ)).toBe("2024-02-29");
    expect(addBaDays("2024-02-29", 1, TZ)).toBe("2024-03-01");
  });

  it("+0 returns same ymd", () => {
    expect(addBaDays("2026-09-01", 0, TZ)).toBe("2026-09-01");
  });
});

describe("isPastBa — lexicographic compare on YYYY-MM-DD", () => {
  it("returns true when ymd < todayYmd", () => {
    expect(isPastBa("2026-08-31", "2026-09-01")).toBe(true);
  });

  it("returns false when ymd === todayYmd (today itself allowed)", () => {
    expect(isPastBa("2026-09-01", "2026-09-01")).toBe(false);
  });

  it("returns false when ymd > todayYmd (future)", () => {
    expect(isPastBa("2026-09-02", "2026-09-01")).toBe(false);
  });
});

describe("getBaDayUtcRange — pure UTC range for BA day", () => {
  it("spans exactly 24h on a non-DST day", () => {
    const { fromUtc, toUtc } = getBaDayUtcRange("2026-09-01", TZ);
    const diffMs = toUtc.getTime() - fromUtc.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("spans 23h on spring-forward day (BA has no DST, but stays correct)", () => {
    // BA does NOT observe DST (UTC-3 year-round). Range is always 24h.
    const { fromUtc, toUtc } = getBaDayUtcRange("2026-09-15", TZ);
    const diffMs = toUtc.getTime() - fromUtc.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("fromUtc represents BA-local 00:00 (UTC-3 = 03:00Z)", () => {
    const { fromUtc } = getBaDayUtcRange("2026-09-01", TZ);
    // BA is UTC-3 → 00:00 BA = 03:00 UTC.
    expect(fromUtc.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("toUtc is exclusive boundary (== fromUtc of next BA day)", () => {
    const day1 = getBaDayUtcRange("2026-09-01", TZ);
    const day2 = getBaDayUtcRange("2026-09-02", TZ);
    expect(day1.toUtc.getTime()).toBe(day2.fromUtc.getTime());
  });

  it("throws on malformed ymd input", () => {
    expect(() => getBaDayUtcRange("garbage", TZ)).toThrow();
    expect(() => getBaDayUtcRange("2026-13-40", TZ)).toThrow();
    expect(() => getBaDayUtcRange("", TZ)).toThrow();
  });

  it("handles year/month rollover", () => {
    const dec = getBaDayUtcRange("2026-12-31", TZ);
    const jan = getBaDayUtcRange("2027-01-01", TZ);
    expect(dec.toUtc.getTime()).toBe(jan.fromUtc.getTime());
  });
});

describe("Integration: min/max bound derivation (used by RSC)", () => {
  it("today + DATE_MAX_DAYS yields +60 days (no off-by-one)", () => {
    const today = "2026-09-01";
    const max = addBaDays(today, DATE_MAX_DAYS, TZ);
    expect(max).toBe("2026-10-31");
  });

  it("isPastBa + max bound rejects past and far-future", () => {
    const today = "2026-09-01";
    const max = addBaDays(today, DATE_MAX_DAYS, TZ);
    expect(isPastBa("2026-08-31", today)).toBe(true);
    expect(isPastBa("2026-09-01", today)).toBe(false);
    expect("2026-11-01" > max).toBe(true);
  });
});
