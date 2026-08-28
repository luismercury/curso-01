import "server-only";

import { z } from "zod";

import type { WorkshopConfig } from "@/config/workshopConfig";
import { getOperatingIntervalsForDate, toMinutes } from "@/config/workshopSchedule";
import { ValidationError } from "@/config/workshopSchedule";

/** UTC slot — both dates are TIMESTAMPTZ-ready (UTC) */
export type Slot = {
  start: Date;
  end: Date;
};

export type SlotGeneratorConfig = Pick<
  WorkshopConfig,
  "timezone" | "slotStepMinutes" | "operatingHours"
>;

const durationSchema = z
  .number()
  .int()
  .min(30)
  .max(120)
  .refine((v) => v % 5 === 0, { message: "durationMinutes must be divisible by 5" });

function getBaYmd(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function toHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert BA wall-time (YYYY-MM-DD, HH:mm) to UTC Date using Intl.
 * Pure, no new deps, handles DST via offset delta.
 */
export function baWallTimeToUtcDate(
  baYmd: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [yStr, mStr, dStr] = baYmd.split("-");
  const [hStr, minStr] = hhmm.split(":");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const h = Number(hStr);
  const min = Number(minStr);

  const utcMs = Date.UTC(y, (m as number) - 1, d as number, h as number, min as number);
  const candidate = new Date(utcMs);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(candidate);
  const getPart = (type: string): string => parts.find((p) => p.type === type)?.value ?? "0";

  const tzYear = Number(getPart("year"));
  const tzMonth = Number(getPart("month"));
  const tzDay = Number(getPart("day"));
  // Intl may return 24 for midnight in some locales; normalize to 0
  let tzHour = Number(getPart("hour"));
  if (tzHour === 24) tzHour = 0;
  const tzMinute = Number(getPart("minute"));

  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  const offset = tzAsUtc - utcMs;
  return new Date(utcMs - offset);
}

/** Thin adapter: UTC slots → BA HH:mm strings for API response. */
export function formatSlotsAsHHmm(slots: Slot[], timeZone: string): string[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return slots.map((slot) => formatter.format(slot.start));
}

/**
 * Generate candidate UTC slots for a BA calendar day.
 * Pure: no DB, no side effects, no new runtime deps.
 */
export function generateSlotsForDate(args: {
  date: Date;
  durationMinutes: number;
  config: SlotGeneratorConfig;
}): Slot[] {
  const parsed = durationSchema.safeParse(args.durationMinutes);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "invalid durationMinutes");
  }
  const durationMinutes = parsed.data;

  const intervals = getOperatingIntervalsForDate(args.date, args.config);
  if (intervals.length === 0) return [];

  const baYmd = getBaYmd(args.date, args.config.timezone);
  const slots: Slot[] = [];

  for (const interval of intervals) {
    const startMin = toMinutes(interval.start);
    const endMin = toMinutes(interval.end);
    for (let min = startMin; min <= endMin - durationMinutes; min += args.config.slotStepMinutes) {
      const hhmm = toHHmm(min);
      const start = baWallTimeToUtcDate(baYmd, hhmm, args.config.timezone);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      slots.push({ start, end });
    }
  }

  return slots;
}

// Re-export for convenience where tests check no duplication
export { toMinutes };
