import "server-only";

import { z } from "zod";

import { getWorkshopConfig as getWorkshopConfigFromRepo } from "@/db/repositories/workshopSchedules";
import type { DbOrTx } from "@/db";
import {
  DEFAULT_OPERATING_INTERVALS,
  ValidationError,
  validateIntervals,
} from "./workshopSchedule";
import type { TimeInterval, WeeklySchedule } from "./workshopSchedule";

/**
 * WorkshopConfig — single frozen source of truth for FASE 5 slot/booking policy.
 *
 * Invariants:
 * - INV-01 capacityPerSlot is count-based (tstzrange &&), default 1.
 * - INV-05 slot generation uses fixed slotStepMinutes 30, filtered by durationMinutes.
 * - INV-06 timezone is IANA America/Argentina/Buenos_Aires; DB stores TIMESTAMPTZ UTC.
 *
 * Consumers MUST receive WorkshopConfig as a DI parameter, not import the global.
 * T-036b DB provider: `getWorkshopConfig(db)` re-exports the repository implementation
 * so the config layer stays the public seam — consumers await per request, no global cache.
 */

const intervalSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

/**
 * HH:mm regex matching `00:00`-`23:59` — used by PATCH /api/admin/schedule.
 * Stricter than intervalSchema (no `^..$` anchors shared, exact 2-digit components).
 */
const hhmmStrictRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Zod schema for the PATCH body of `/api/admin/schedule`.
 * Strict + superRefine reuses `validateIntervals` so route + repo share the same guard.
 */
export const openIntervalSchema = z.object({
  start: z.string().regex(hhmmStrictRegex, "start must be HH:mm 00:00-23:59"),
  end: z.string().regex(hhmmStrictRegex, "end must be HH:mm 00:00-23:59"),
});

export const workshopScheduleInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openIntervals: z.array(openIntervalSchema).superRefine((intervals, ctx) => {
      try {
        validateIntervals(intervals as TimeInterval[]);
      } catch (err) {
        if (err instanceof ValidationError) {
          ctx.addIssue({ code: "custom", message: err.message });
        } else {
          throw err;
        }
      }
    }),
  })
  .strict();

export type WorkshopScheduleInput = z.infer<typeof workshopScheduleInputSchema>;

const weeklyScheduleSchema = z
  .record(z.coerce.number().int().min(0).max(6), z.array(intervalSchema).min(1))
  .optional()
  .superRefine((val, ctx) => {
    if (!val) return;
    for (const intervals of Object.values(val)) {
      try {
        validateIntervals(intervals as TimeInterval[]);
      } catch (err) {
        if (err instanceof ValidationError) {
          ctx.addIssue({ code: "custom", message: err.message });
        } else {
          throw err;
        }
      }
    }
  });

export const workshopConfigSchema = z.object({
  capacityPerSlot: z.number().int().min(1).default(1),
  slotStepMinutes: z
    .number()
    .int()
    .min(5)
    .max(60)
    .refine((v) => v % 5 === 0, {
      message: "slotStepMinutes must be divisible by 5",
    })
    .default(30),
  timezone: z.string().min(1).default("America/Argentina/Buenos_Aires"),
  operatingHours: weeklyScheduleSchema,
});

export { DEFAULT_OPERATING_INTERVALS };
export type { TimeInterval, WeeklySchedule };

export const workshopConfig = Object.freeze(
  workshopConfigSchema.parse({}),
) as Readonly<z.infer<typeof workshopConfigSchema>>;

export type WorkshopConfig = z.infer<typeof workshopConfigSchema>;

export const WORKSHOP_TIMEZONE = workshopConfig.timezone;

/**
 * T-036b DB provider — returns a fully-resolved WorkshopConfig per request.
 * Re-exports the repository implementation so consumers depend only on the
 * config layer; the frozen `workshopConfig` fallback stays untouched for
 * routes that don't need DB-backed overrides.
 *
 * No global cache (INV-01/05 freshness): every consumer awaits per request.
 */
export async function getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig> {
  return getWorkshopConfigFromRepo(db);
}
