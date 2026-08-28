import "server-only";

import { z } from "zod";

import {
  getOperatingIntervalsForDate,
  toMinutes,
  ValidationError,
} from "@/config/workshopSchedule";
import type { TimeInterval } from "@/config/workshopSchedule";
import type { WorkshopConfig } from "@/config/workshopConfig";

// Single source of truth for 30..120 %5 bounds — shared by slotGenerator and turnos
export const durationSchema = z
  .number()
  .int()
  .min(30)
  .max(120)
  .refine((v) => v % 5 === 0, {
    message: "durationMinutes must be divisible by 5",
  });

export type DurationValidationResult = {
  end: Date;
  valid: boolean;
  error?: ValidationError;
  intervalEnd?: Date;
};

function getBaYmd(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getBaWallMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";
  let hour = Number(getPart("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(getPart("minute"));
  return hour * 60 + minute;
}

/**
 * Convert BA wall-time (YYYY-MM-DD, HH:mm) to UTC Date using Intl.
 * DST-aware via offset delta (same algorithm as slotGenerator).
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
  const getPart = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const tzYear = Number(getPart("year"));
  const tzMonth = Number(getPart("month"));
  const tzDay = Number(getPart("day"));
  let tzHour = Number(getPart("hour"));
  if (tzHour === 24) tzHour = 0;
  const tzMinute = Number(getPart("minute"));

  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  const offset = tzAsUtc - utcMs;
  return new Date(utcMs - offset);
}

/** Pure UTC arithmetic — no timezone logic */
export function calculateEndDateTime(
  start: Date,
  durationMinutes: number,
): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}

/** Find which operating interval contains `start` (BA wall-time) */
export function findContainingInterval(
  start: Date,
  config: Pick<WorkshopConfig, "timezone" | "operatingHours">,
): TimeInterval | undefined {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new ValidationError("invalid start Date");
  }
  const intervals = getOperatingIntervalsForDate(start, config);
  if (intervals.length === 0) return undefined;
  const startMin = getBaWallMinutes(start, config.timezone);
  for (const interval of intervals) {
    const s = toMinutes(interval.start);
    const e = toMinutes(interval.end);
    if (startMin >= s && startMin < e) {
      return interval;
    }
  }
  return undefined;
}

/** Main entry: validates duration bounds, computes end, checks inclusive closure */
export function calculateEndAndValidate(args: {
  start: Date;
  durationMinutes: number;
  config: Pick<WorkshopConfig, "timezone" | "operatingHours">;
}): DurationValidationResult {
  if (!(args.start instanceof Date) || Number.isNaN(args.start.getTime())) {
    throw new ValidationError("invalid start Date");
  }

  const parsed = durationSchema.safeParse(args.durationMinutes);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "invalid durationMinutes";
    throw new ValidationError(msg);
  }
  const durationMinutes = parsed.data;
  const end = calculateEndDateTime(args.start, durationMinutes);

  const intervals = getOperatingIntervalsForDate(args.start, args.config);
  if (intervals.length === 0) {
    return {
      end,
      valid: false,
      error: new ValidationError("closed day: no operating intervals"),
      intervalEnd: undefined,
    };
  }

  const containing = findContainingInterval(args.start, args.config);
  if (!containing) {
    return {
      end,
      valid: false,
      error: new ValidationError("start outside operating intervals"),
      intervalEnd: undefined,
    };
  }

  const baYmd = getBaYmd(args.start, args.config.timezone);
  const intervalEnd = baWallTimeToUtcDate(
    baYmd,
    containing.end,
    args.config.timezone,
  );

  if (end.getTime() <= intervalEnd.getTime()) {
    return { end, valid: true, intervalEnd };
  }

  return {
    end,
    valid: false,
    error: new ValidationError(
      `fechaHoraFin ${end.toISOString()} exceeds finIntervaloOperativo ${intervalEnd.toISOString()}`,
    ),
    intervalEnd,
  };
}

/** Parse ISO string → UTC Date; invalid ISO → throws ValidationError 400 */
export function parseIsoToUtc(iso: string): Date {
  if (typeof iso !== "string" || iso.trim() === "") {
    throw new ValidationError("invalid ISO date");
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`invalid ISO date: ${iso}`);
  }
  return d;
}
