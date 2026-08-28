import "server-only";

/**
 * Workshop operating schedule helpers — pure, server-only, no DB.
 *
 * Provides interval validation shared with T-036b PATCH and
 * date-aware operating-hours resolution via BA timezone.
 */

export type TimeInterval = { start: string; end: string };

export type WeeklySchedule = Partial<
  Record<0 | 1 | 2 | 3 | 4 | 5 | 6, TimeInterval[]>
>;

export const DEFAULT_OPERATING_INTERVALS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
] as const;

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function toMinutes(t: string): number {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  return h * 60 + m;
}

export function validateIntervals(intervals: TimeInterval[]): void {
  for (let i = 0; i < intervals.length; i++) {
    const current = intervals[i];
    if (!current) continue;
    const s = toMinutes(current.start);
    const e = toMinutes(current.end);
    if (Number.isNaN(s) || Number.isNaN(e)) {
      throw new ValidationError(`invalid time format: ${current.start}-${current.end}`);
    }
    if (s < 0 || s > 24 * 60 || e < 0 || e > 24 * 60) {
      throw new ValidationError(`interval out of bounds 00:00-24:00: ${current.start}-${current.end}`);
    }
    if (s >= e) {
      throw new ValidationError(`start must be before end: ${current.start}-${current.end}`);
    }
    if (i > 0) {
      const prev = intervals[i - 1];
      if (!prev) continue;
      const prevEnd = toMinutes(prev.end);
      const prevStart = toMinutes(prev.start);
      // Enforce sorted by start and non-overlapping (prev.end <= current.start)
      // This also rejects unsorted input where current.start < prev.start
      if (prevStart > s) {
        throw new ValidationError(`intervals must be sorted by start: ${prev.start}-${prev.end} before ${current.start}-${current.end}`);
      }
      if (prevEnd > s) {
        throw new ValidationError(`overlapping intervals: ${prev.start}-${prev.end} overlaps ${current.start}-${current.end}`);
      }
    }
  }
}

function getBaDayOfWeek(date: Date, timeZone: string): number {
  // Derive BA calendar date without using host-local Date.getDay().
  // Format the instant in the target timezone as YYYY-MM-DD (en-CA),
  // then compute dow via UTC to avoid host TZ influence.
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const isoDate = formatter.format(date); // YYYY-MM-DD
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Resolve operating intervals for a given calendar date.
 * Pure function, no DB, no side effects.
 *
 * @param date - Absolute instant (UTC). BA calendar date is derived via config.timezone.
 * @param config - WorkshopConfig via DI (timezone + optional WeeklySchedule).
 * @returns BA-local HH:mm intervals for that dow, or fallback defaults.
 */
export function getOperatingIntervalsForDate(
  date: Date,
  config: { timezone: string; operatingHours?: WeeklySchedule },
): TimeInterval[] {
  const dow = getBaDayOfWeek(date, config.timezone) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const override = config.operatingHours?.[dow];
  if (override !== undefined) return override as TimeInterval[];
  if (dow >= 1 && dow <= 5) {
    // Return mutable copy of frozen default to avoid accidental mutation
    return [...DEFAULT_OPERATING_INTERVALS] as unknown as TimeInterval[];
  }
  return [];
}
