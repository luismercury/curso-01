import "server-only";

import { z } from "zod";

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
 * Future DB provider path (T-036b): `getWorkshopConfig(db): Promise<WorkshopConfig>`
 * will return the same shape from a workshop_config table without changing signatures.
 */

const intervalSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

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

// Future provider (T-036b):
// export async function getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig> { ... }
