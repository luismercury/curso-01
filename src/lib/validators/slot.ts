/**
 * Client-safe Zod schema for `?slot=HH:mm` search params.
 *
 * INV-05 step-30 invariant: only slots on a 30-minute boundary (00 or 30)
 * are bookable in v1. `slotStepMinutes = 30` lives on `WorkshopConfig` and
 * is enforced server-side via `generateSlotsForDate`; this schema is the
 * client-side guard so the URL state cannot desync from the resolved value.
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle.
 * - `safeParse` never throws; tampered / out-of-step input falls back to
 *   `success: false` so callers can keep the URL state non-null without
 *   crashing the component tree.
 *
 * Range allowed: `00:00`–`23:30`. Anchored to a 24h BA wall-clock day
 * (INV-06). DST does not affect HH:mm string parsing; the wire format is
 * intentionally timezone-free because the day itself (`?date=`) is what
 * carries the timezone context.
 */
import { z } from "zod";

/**
 * HH:mm anchored to the 30-minute step. Accepts `00:00` through `23:30`;
 * rejects malformed (`9:00`), wrong step (`09:15`), out-of-range (`24:00`,
 * `25:00`, `09:60`), empty string, and undefined.
 */
export const slotSchema = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/);

/** Inferred TypeScript type — `string` (HH:mm, two-digit hour, two-digit minute). */
export type SlotHHmm = z.infer<typeof slotSchema>;
