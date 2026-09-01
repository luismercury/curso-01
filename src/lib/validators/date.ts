/**
 * Client-safe Zod schemas + pure helpers for the date selection UI (T-041).
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle
 *   and to call from RSC pages without crossing the server-only boundary.
 * - English YYYY-MM-DD calendar strings; never naive `Date`/`toISOString()`
 *   (INV-06). All BA derivations go through `Intl.DateTimeFormat("en-CA",
 *   { timeZone })` so server and client agree on the calendar day regardless
 *   of host TZ (no UTC drift on BA evenings).
 *
 * INV-06: timezone is parametrizable via `tz` argument; the canonical BA
 * timezone is `America/Argentina/Buenos_Aires` (`WorkshopConfig.timezone`).
 * No hardcoded `09:00-12:00 / 14:00-18:00` here — those live in
 * `config/workshopSchedule.ts` (`DEFAULT_OPERATING_INTERVALS`).
 *
 * INV-08: helper outputs are camelCase-friendly primitives — `ymd` strings,
 * DOW numbers, and `Date` only inside the UTC range pair (caller decides
 * serialization). The Spanish DB names (`fechaHoraInicio`, `fechaHoraFin`)
 * never appear on the wire.
 *
 * DST strategy: every helper anchors at noon UTC before formatting in BA
 * (`en-CA`). Noon UTC is far enough from the BA midnight boundary that
 * neither ±1h DST transitions flip the BA calendar day — same precedent as
 * `services/availability/slotGenerator.ts` `baWallTimeToUtcDate`.
 */
import { z } from "zod";

/**
 * Maximum advance window (days) for the date picker. Today + 60 days.
 * Hardcoded constant — not `WorkshopConfig.maxAdvanceDays` because no such
 * field exists in v1 (Technical-spec §7 leaves horizon parametrisation as
 * a future enhancement). Future `maxAdvanceDays` can override without UI
 * change.
 */
export const DATE_MAX_DAYS = 60;

/**
 * Regex `^\d{4}-\d{2}-\d{2}$` — strict YYYY-MM-DD shape. Does NOT validate
 * calendar correctness by itself (e.g. `2026-13-40` or `2026-02-30` pass).
 * The superRefine below applies the calendar check via the noon round-trip.
 *
 * Empty string is rejected (use `.optional()` at the call site if a missing
 * value should be valid).
 */
const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * YYYY-MM-DD schema with calendar-validity check.
 *
 * Pass conditions:
 *   1. matches `^\d{4}-\d{2}-\d{2}$`
 *   2. `new Date(ymd + "T12:00:00.000Z").toISOString().slice(0,10) === ymd`
 *      catches calendar overflow like `2026-02-30 → 2026-03-02` (matches the
 *      `availabilityService.ts` overflow guard at `route.ts:63-69`).
 *
 * Past / future-max checks are NOT in the schema — they depend on the
 * current time and the workshop config, which are caller concerns. Use
 * `isPastBa` and `addBaDays` from the RSC / island to bound the range.
 */
export const dateSchema = z.string().regex(ymdRegex, "must be YYYY-MM-DD").superRefine((value, ctx) => {
  const noonUtc = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(noonUtc.getTime()) || noonUtc.toISOString().slice(0, 10) !== value) {
    ctx.addIssue({
      code: "custom",
      message: "calendar invalid (overflow or impossible date)",
    });
  }
});

/**
 * Format `date` as BA calendar `YYYY-MM-DD`. Pure — depends only on the
 * Intl formatter and the timezone argument. Never uses `toISOString()`
 * (UTC) — that would drift by one day for BA evenings (INV-06).
 *
 * @param tz IANA timezone, e.g. `America/Argentina/Buenos_Aires`.
 * @param ref Reference instant; defaults to `new Date()`.
 */
export function getTodayBaYmd(tz: string, ref: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(ref);
}

/**
 * Add `days` to a BA ymd string and return the resulting BA ymd. Pure —
 * noon UTC anchor dodges DST midnight shifts (same strategy as
 * `getTodayBaYmd`).
 *
 * DST safety: noon UTC is far enough from BA midnight that ±1h DST
 * transitions never flip the BA calendar day. The formatter sees the
 * post-shift UTC instant and projects the BA date correctly.
 *
 * @param ymd YYYY-MM-DD (already validated by `dateSchema`).
 * @param days Integer offset; negative for past.
 * @param tz IANA timezone.
 */
export function addBaDays(ymd: string, days: number, tz: string): string {
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const noonUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(noonUtcMs + days * 86400000);
  return getTodayBaYmd(tz, shifted);
}

/**
 * Is `ymd` strictly before `todayYmd` (both BA calendar strings)? Pure
 * lexicographic compare — YYYY-MM-DD strings sort the same chronologically.
 *
 * Returns `false` when `ymd === todayYmd` (today itself is not past; the
 * booking window allows same-day per RN-05 if a future slot remains —
 * slot existence is T-042's responsibility).
 */
export function isPastBa(ymd: string, todayYmd: string): boolean {
  return ymd < todayYmd;
}

/**
 * UTC range that spans a BA calendar day `[00:00 BA, next 00:00 BA)`.
 *
 * Pure client-safe — mirrors `availabilityService.getBaDayUtcRange(string)`
 * but lives here so the validator file stays free of `server-only` imports.
 * Uses the same `baWallTimeToUtcDate` Intl offset-delta strategy inline
 * (single tiny implementation, no transitive server-only dep).
 *
 * INV-06: BA-local 00:00 maps to a DST-aware UTC instant. The range is
 * half-open `[fromUtc, toUtc)` so downstream filters can use simple
 * `start >= fromUtc && start < toUtc`.
 *
 * Applies the same noon round-trip guard as `dateSchema.superRefine` so
 * calendar-overflow inputs (`2026-02-30`, `2026-13-40`) throw here too.
 *
 * @throws Error when `ymd` does not pass `dateSchema` (regex or
 *         calendar overflow).
 */
export function getBaDayUtcRange(
  ymd: string,
  tz: string,
): { fromUtc: Date; toUtc: Date } {
  if (!ymdRegex.test(ymd)) {
    throw new Error(`invalid BA date string: ${ymd}`);
  }
  // Noon round-trip rejects calendar overflow before any UTC math.
  const noonUtc = new Date(`${ymd}T12:00:00.000Z`);
  if (
    Number.isNaN(noonUtc.getTime()) ||
    noonUtc.toISOString().slice(0, 10) !== ymd
  ) {
    throw new Error(`invalid BA calendar date: ${ymd}`);
  }
  const fromUtc = baWallTimeToUtcDate(ymd, "00:00", tz);
  const toUtc = baWallTimeToUtcDate(nextBaYmd(ymd), "00:00", tz);
  return { fromUtc, toUtc };
}

/**
 * Compute the next BA calendar ymd (lexicographic +1 day). Mirrors the
 * helper of the same name in `services/availability/availabilityService`
 * — kept private here so the validator surface stays small. For BA
 * (UTC-3, no DST since 2009) the UTC midnight +1d trick yields the right
 * next BA ymd without an explicit BA reformat.
 */
function nextBaYmd(baYmd: string): string {
  const [yStr, mStr, dStr] = baYmd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const utc = Date.UTC(y, m - 1, d);
  const next = new Date(utc + 24 * 60 * 60 * 1000);
  const yyyy = String(next.getUTCFullYear()).padStart(4, "0");
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Same offset-delta trick as `slotGenerator.baWallTimeToUtcDate` but for
 * the `00:00` boundary specifically. Pure — single Intl formatter per
 * call. Kept private to this file so the validator surface stays small.
 */
function baWallTimeToUtcDate(baYmd: string, hhmm: string, tz: string): Date {
  const [yStr, mStr, dStr] = baYmd.split("-");
  const [hStr, minStr] = hhmm.split(":");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const h = Number(hStr);
  const min = Number(minStr);

  const utcMs = Date.UTC(y, m - 1, d, h, min, 0);
  const candidate = new Date(utcMs);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(candidate);
  const getPart = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const tzYear = Number(getPart("year"));
  const tzMonth = Number(getPart("month"));
  const tzDay = Number(getPart("day"));
  let tzHour = Number(getPart("hour"));
  if (tzHour === 24) tzHour = 0; // Intl quirk around midnight
  const tzMinute = Number(getPart("minute"));

  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  const offset = tzAsUtc - utcMs;
  return new Date(utcMs - offset);
}
