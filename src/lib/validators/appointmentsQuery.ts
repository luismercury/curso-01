/**
 * Client-safe Zod schemas for the upcoming-appointments screen (T-045 UI-04).
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle.
 * - INV-08: schemas validate camelCase English input (`page`, `limit`,
 *   `sort`) — Spanish DB keys never appear at the validator boundary.
 *
 * Clamp-on-parse contract (REQ-04): `appointmentsQuerySchema` must NEVER
 * throw on user-supplied URL state. The page-level `safeParse` catches
 * every Zod issue and falls back to `{ page: 1, limit: 20, sort:
 * "startAt:asc" }` so the screen renders the first page instead of 500-ing.
 * Each individual schema is also `safeParse`-friendly so callers can
 * validate single fields (e.g. `pageSchema` for the Pagination control).
 *
 * INV-02: sort accepts only the literal `"startAt:asc"` for T-045 (the
 * upcoming list is always sorted by startDateTime ascending). The full
 * `asc|desc|startAt:asc|startAt:desc` whitelisting lives in the repo
 * layer (`findTurnosPaginated`) — this validator is intentionally narrower
 * because the surface only ever needs one direction.
 */
import { z } from "zod";

/** Hard upper bound per §8.5 — protects the DB from `?limit=999999`. */
export const APPOINTMENTS_LIMIT_MAX = 100;
/** Default page size when `?limit=` is missing or invalid. */
export const APPOINTMENTS_LIMIT_DEFAULT = 20;

/**
 * Single-field page schema. `safeParse` never throws — invalid / missing
 * input returns `success: false`. The composite schema below clamps on
 * failure rather than throwing.
 */
export const pageSchema = z.coerce.number().int().min(1);

/**
 * Single-field limit schema — clamps at `APPOINTMENTS_LIMIT_MAX`. Coerce
 * handles `?limit=20` (string) → 20 (number) at the URL boundary.
 */
export const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(APPOINTMENTS_LIMIT_MAX);

/**
 * Single-field sort schema. For T-045 only `"startAt:asc"` is allowed;
 * the upcoming list is sorted by startDateTime ascending by definition.
 * Future enhancements (admin pending list, history view) can widen this
 * enum without breaking the existing UI.
 */
export const appointmentsSortSchema = z.enum(["startAt:asc"]);

/** Inferred TypeScript type — strict literal union. */
export type AppointmentsSort = z.infer<typeof appointmentsSortSchema>;

/**
 * Composite URL-state schema. The page wraps it in `safeParse` and falls
 * back to defaults on failure so an out-of-range or non-numeric value
 * never produces a 500.
 *
 * All three fields are optional — `parse` defaults them at the URL
 * boundary. The composite schema is intentionally permissive (no `.strict()`)
 * so unknown future siblings (e.g. `?status=` for admin views) don't
 * trip the parser; the repo layer is the enforcement point.
 */
export const appointmentsQuerySchema = z.object({
  page: pageSchema.optional(),
  limit: limitSchema.optional(),
  sort: appointmentsSortSchema.optional(),
});

/** Inferred input type — `page`/`limit` may be missing or invalid. */
export type AppointmentsQueryInput = z.input<typeof appointmentsQuerySchema>;

/** Coerced + defaulted output — always safe to spread into the repo. */
export type AppointmentsQuery = {
  page: number;
  limit: number;
  sort: AppointmentsSort;
};

/**
 * Default values used by `safeParseWithDefaults` when any field is
 * missing or invalid. Centralized so unit tests can assert the exact
 * fallback contract.
 */
export const APPOINTMENTS_QUERY_DEFAULTS: AppointmentsQuery = Object.freeze({
  page: 1,
  limit: APPOINTMENTS_LIMIT_DEFAULT,
  sort: "startAt:asc",
});

/**
 * `safeParse`-and-clamp helper. NEVER throws. Invalid / out-of-range
 * fields fall back to `APPOINTMENTS_QUERY_DEFAULTS`. Missing fields fall
 * back per field so `?page=2` alone produces `{ page: 2, limit: 20, sort:
 * "startAt:asc" }`.
 *
 * INV-08: returns the camelCase `AppointmentsQuery` shape — the repo
 * layer converts `sort` into the underlying `findTurnosPaginated` argument
 * via the whitelist at `turnos.ts:263`.
 */
export function parseAppointmentsQuery(
  input: unknown,
): AppointmentsQuery {
  const parsed = appointmentsQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { ...APPOINTMENTS_QUERY_DEFAULTS };
  }
  return {
    page: parsed.data.page ?? APPOINTMENTS_QUERY_DEFAULTS.page,
    limit: parsed.data.limit ?? APPOINTMENTS_QUERY_DEFAULTS.limit,
    sort: parsed.data.sort ?? APPOINTMENTS_QUERY_DEFAULTS.sort,
  };
}
