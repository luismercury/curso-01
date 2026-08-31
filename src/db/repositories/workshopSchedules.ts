import "server-only";

import { eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { workshopSchedules } from "@/db/schema";
import type { WorkshopScheduleRow } from "@/db/schema";
import { workshopConfig } from "@/config/workshopConfig";
import type { WorkshopConfig } from "@/config/workshopConfig";
import {
  DEFAULT_OPERATING_INTERVALS,
  validateIntervals,
  ValidationError,
} from "@/config/workshopSchedule";
import type { TimeInterval, WeeklySchedule } from "@/config/workshopSchedule";

/**
 * T-036b repository — per-day operating hours persistence.
 *
 * INV-01/05/06: defaults live only in workshopSchedule.ts (no hardcoded
 * 09:00-12:00/14:00-18:00 here). Empty table → Mon-Fri DEFAULT, Sat/Sun [].
 * No global cache — consumers await getWorkshopConfig(db) per request.
 * validateIntervals guards every write.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function assertDayOfWeek(value: number): DayOfWeek {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new ValidationError(`dayOfWeek must be between 0 and 6, got ${value}`);
  }
  return value as DayOfWeek;
}

function rowToIntervals(row: WorkshopScheduleRow): TimeInterval[] {
  const raw = row.openIntervals;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is TimeInterval =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { start?: unknown }).start === "string" &&
      typeof (item as { end?: unknown }).end === "string",
  );
}

export async function getDaySchedule(
  db: DbOrTx,
  dayOfWeek: number,
): Promise<TimeInterval[] | null> {
  const dow = assertDayOfWeek(dayOfWeek);
  const rows = await db
    .select()
    .from(workshopSchedules)
    .where(eq(workshopSchedules.dayOfWeek, dow))
    .limit(1);
  return rows[0] ? rowToIntervals(rows[0]) : null;
}

export async function upsertDaySchedule(
  db: DbOrTx,
  dayOfWeek: number,
  intervals: TimeInterval[],
): Promise<TimeInterval[]> {
  const dow = assertDayOfWeek(dayOfWeek);
  validateIntervals(intervals);
  const [row] = await db
    .insert(workshopSchedules)
    .values({ dayOfWeek: dow, openIntervals: intervals })
    .onConflictDoUpdate({
      target: workshopSchedules.dayOfWeek,
      set: { openIntervals: intervals },
    })
    .returning();
  if (!row) {
    throw new Error("upsert into workshop_schedules returned no rows");
  }
  return rowToIntervals(row);
}

export async function getWeeklySchedule(db: DbOrTx): Promise<WeeklySchedule> {
  const rows = await db.select().from(workshopSchedules);
  const byDay = new Map<number, TimeInterval[]>();
  for (const row of rows) byDay.set(row.dayOfWeek, rowToIntervals(row));
  const schedule: WeeklySchedule = {};
  for (let dow = 0; dow <= 6; dow++) {
    const key = dow as DayOfWeek;
    const intervals = byDay.get(dow);
    if (intervals !== undefined) schedule[key] = intervals;
    else if (dow >= 1 && dow <= 5) schedule[key] = [...DEFAULT_OPERATING_INTERVALS] as unknown as TimeInterval[];
    else schedule[key] = [];
  }
  return schedule;
}

export async function getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig> {
  const operatingHours = await getWeeklySchedule(db);
  return {
    capacityPerSlot: workshopConfig.capacityPerSlot,
    slotStepMinutes: workshopConfig.slotStepMinutes,
    timezone: workshopConfig.timezone,
    // getWeeklySchedule populates all 7 days; widen Partial → Record.
    operatingHours: operatingHours as Record<DayOfWeek, TimeInterval[]>,
  };
}
