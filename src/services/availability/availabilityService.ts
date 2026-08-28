import "server-only";

import type { WorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { durationSchema } from "@/services/availability/duration";
import { ACTIVE_STATUSES, isSlotAvailable } from "@/services/availability/overlap";
import {
  baWallTimeToUtcDate,
  generateSlotsForDate,
} from "@/services/availability/slotGenerator";
import type { Slot } from "@/services/availability/slotGenerator";

export type { Slot };
export type ExistingEntry = {
  start: Date;
  end: Date;
  status: string;
};

export type GetAvailableSlotsConfig = Pick<
  WorkshopConfig,
  "timezone" | "slotStepMinutes" | "capacityPerSlot" | "operatingHours"
>;

export type FetchActiveTurnos = (range: {
  fromUtc: Date;
  toUtc: Date;
}) => Promise<ExistingEntry[]>;

function getBaYmd(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

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
 * Derive BA calendar-day UTC range [fromUtc, toUtc).
 * fromUtc = BA 00:00 inclusive, toUtc = next BA 00:00 exclusive, DST-aware via Intl.
 */
export function getBaDayUtcRange(
  date: Date,
  timeZone: string,
): { fromUtc: Date; toUtc: Date };
export function getBaDayUtcRange(
  baYmd: string,
  timeZone: string,
): { fromUtc: Date; toUtc: Date };
export function getBaDayUtcRange(
  dateOrYmd: Date | string,
  timeZone: string,
): { fromUtc: Date; toUtc: Date } {
  let baYmd: string;
  if (typeof dateOrYmd === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOrYmd)) {
      throw new ValidationError(`invalid BA date string: ${dateOrYmd}`);
    }
    baYmd = dateOrYmd;
  } else {
    if (!(dateOrYmd instanceof Date) || Number.isNaN(dateOrYmd.getTime())) {
      throw new ValidationError("invalid date");
    }
    baYmd = getBaYmd(dateOrYmd, timeZone);
  }
  const fromUtc = baWallTimeToUtcDate(baYmd, "00:00", timeZone);
  const toYmd = nextBaYmd(baYmd);
  const toUtc = baWallTimeToUtcDate(toYmd, "00:00", timeZone);
  return { fromUtc, toUtc };
}

function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new ValidationError("invalid date");
  }
}

function assertValidDuration(durationMinutes: number): number {
  const parsed = durationSchema.safeParse(durationMinutes);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "invalid durationMinutes",
    );
  }
  return parsed.data;
}

/**
 * Pure core — zero DB imports, server-only, DI of WorkshopConfig.
 * Composes generateSlotsForDate + isSlotAvailable (count < capacityPerSlot, half-open).
 */
export function getAvailableSlots(args: {
  date: Date;
  durationMinutes: number;
  config: GetAvailableSlotsConfig;
  existingTurnos: ExistingEntry[];
}): Slot[] {
  assertValidDate(args.date);
  const durationMinutes = assertValidDuration(args.durationMinutes);

  const candidates = generateSlotsForDate({
    date: args.date,
    durationMinutes,
    config: args.config,
  });

  if (candidates.length === 0) return [];
  if (args.existingTurnos.length === 0) return candidates;

  return candidates.filter((slot) =>
    isSlotAvailable(
      { start: slot.start, end: slot.end },
      args.existingTurnos,
      args.config.capacityPerSlot,
    ),
  );
}

/**
 * Async wrapper — owns I/O boundary.
 * Computes BA day UTC range once, single bulk fetch, delegates to pure core.
 */
export async function getAvailableSlotsForDate(args: {
  date: Date;
  durationMinutes: number;
  config: GetAvailableSlotsConfig;
  fetchActiveTurnos: FetchActiveTurnos;
}): Promise<Slot[]> {
  assertValidDate(args.date);
  const durationMinutes = assertValidDuration(args.durationMinutes);

  const { fromUtc, toUtc } = getBaDayUtcRange(args.date, args.config.timezone);

  const existingTurnos = await args.fetchActiveTurnos({ fromUtc, toUtc });

  return getAvailableSlots({
    date: args.date,
    durationMinutes,
    config: args.config,
    existingTurnos,
  });
}
