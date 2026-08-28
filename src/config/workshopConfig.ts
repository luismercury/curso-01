import "server-only";

import { z } from "zod";

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
  operatingHours: z.record(z.string(), z.array(intervalSchema)).optional(),
});

export const DEFAULT_OPERATING_INTERVALS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
] as const;

export const workshopConfig = Object.freeze(
  workshopConfigSchema.parse({}),
) as Readonly<z.infer<typeof workshopConfigSchema>>;

export type WorkshopConfig = z.infer<typeof workshopConfigSchema>;

export const WORKSHOP_TIMEZONE = workshopConfig.timezone;

// Future provider (T-036b):
// export async function getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig> { ... }
