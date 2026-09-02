/**
 * HTTP helper for the booking-form submit (T-043 PR2).
 *
 * Why POST-only (per design D1): the page already has all 4 selections
 * (serviceId, date, slot, vehicleId) resolved in the URL by the time the
 * user reaches the `<BookingForm>`. Submitting via JSON keeps the route
 * `bodySchema.strict()` as the single source of truth — the server route
 * at `app/api/appointments/route.ts:42-91` parses the JSON body, validates
 * with Zod (ISO 8601 with timezone for INV-06), then delegates to the
 * atomic `appointmentService.createAppointment` (REPEATABLE READ +
 * EXCLUDE gist, INV-04).
 *
 * INV-03: cookie auth (`credentials: "include"`). The client never reads
 * or sends `customerId` — it is always the session-derived id enforced by
 * `requireAuth()` server-side.
 *
 * INV-06: the caller (BookingForm.tsx) reconstructs the wall-clock
 * `${date}T${slot}:00-03:00` (BA fixed, Law 26.474). This module does NOT
 * touch `Date` or `toISOString` — pure string plumbing keeps the wire
 * format predictable.
 *
 * INV-08: the 201 response is parsed from `TurnoDTO` JSON (camelCase +
 * ISO strings — mirror of `db/mappers/turno.ts:TurnoDTO`).
 *
 * 201 → caller navigates to `/appointments?confirmed=<id>` (T-044 reads it).
 * 409 → caller shows "El horario seleccionado ya no se encuentra disponible"
 *       + `router.refresh()` so the slot grid re-fetches from the source.
 * 403 → caller shows "Vehicle not found or not owned" + drops `?vehicleId=`.
 * 422 → caller shows "Service not active" + drops `?serviceId=` + jumps to
 *       `/services` so the user picks another service.
 * 401 → caller imperatively `window.location.assign("/login?next=...")`.
 * 400 → caller shows the validation message from `issues[0]`.
 */
import { z } from "zod";

import { ApiError, type ApiErrorBody } from "@/lib/validators/service";

/**
 * Wire-format Zod schemas for the appointment boundary (T-045 UI-04).
 *
 * The `submitBooking` helper above returns `TurnoDTOJson` parsed by a
 * single `await response.json() as TurnoDTOJson` cast — the server route
 * already validates with Zod (`route.ts` `bodySchema.strict()`), so the
 * client trusts the cast. For the upcoming-list surface we ADD a
 * structural Zod schema so RSC→client props (which cross an unvalidated
 * boundary inside the same request) can still reject snake_case leaks
 * before they reach React.
 *
 * INV-08: `turnoDTOSchema.strict()` and `enrichedTurnoDTOSchema.strict()`
 * reject any snake_case / Spanish DB key at parse time. The tests assert
 * `safeParse({ fecha_hora_inicio: ... }).success === false`.
 *
 * INV-06: date fields use `z.string().datetime({ offset: true })` —
 * accepts ISO 8601 with timezone offset (`Z` or `±HH:mm`). `Date`
 * instances never appear on the wire.
 */

/**
 * INV-02 UPPER_SNAKE status enum. The four legal appointment states —
 * PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO. COMPLETADO is excluded
 * explicitly per the spec (no `COMPLETADO` state in v1).
 */
export const appointmentStatusSchema = z.enum([
  "PENDIENTE",
  "CONFIRMADO",
  "RECHAZADO",
  "CANCELADO",
]);

/**
 * Strict ISO 8601 with timezone. Matches the wire contract every server
 * route emits (`route.ts` `toTurnoDTOJson` -> `.toISOString()`).
 */
const isoDateTime = z.string().datetime({ offset: true });

/**
 * Base wire-format schema for an existing `TurnoDTOJson`. Mirrors the
 * `TurnoDTOJson` interface below so `enrichedTurnoDTOSchema` can extend
 * it instead of duplicating field-by-field.
 */
export const turnoDTOSchema = z
  .object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startDateTime: isoDateTime,
    endDateTime: isoDateTime,
    status: appointmentStatusSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

/**
 * Wire-format schema for the upcoming-appointments list (T-045). Adds
 * `serviceName` (from `servicios.nombre`) and `vehicleLabel`
 * (`"${marca} ${modelo} — ${patente}"`). Both are non-empty strings —
 * the mapper substitutes the fallback constant when the LEFT JOIN
 * produces NULL, so Zod never accepts `""`.
 */
export const enrichedTurnoDTOSchema = turnoDTOSchema
  .extend({
    serviceName: z.string().min(1),
    vehicleLabel: z.string().min(1),
  })
  .strict();

/**
 * Public JSON shape returned by `POST /api/appointments` (201).
 *
 * Mirror of `db/mappers/turno.ts:TurnoDTO` with `Date` instances replaced by
 * ISO 8601 strings — the wire format that crosses the RSC → client boundary.
 * INV-08: snake_case / Spanish names (`cliente_id`, `vehiculo_id`,
 * `servicio_id`, `fecha_hora_inicio`, `fecha_hora_fin`, `estado`,
 * `created_at`, `updated_at`) never appear on the wire.
 */
export interface TurnoDTOJson {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  /** ISO 8601 with timezone (e.g. `"2026-09-10T12:30:00.000Z"`). */
  startDateTime: string;
  /** ISO 8601 with timezone (server-computed: startDateTime + service.durationMinutes). */
  endDateTime: string;
  /** One of `PENDIENTE | CONFIRMADO | RECHAZADO | CANCELADO` (INV-02). */
  status: string;
  /** ISO 8601 with timezone. */
  createdAt: string;
  /** ISO 8601 with timezone. */
  updatedAt: string;
}

/**
 * Input shape for the booking submit.
 *
 * The `startDateTime` value MUST be ISO 8601 with a timezone offset (or
 * `Z`). The caller (BookingForm.tsx) builds `${date}T${slot}:00-03:00`
 * because BA has been fixed at UTC-3 since 2009 (Law 26.474, no DST) —
 * the route regex at `route.ts:27` accepts the explicit `-03:00` form.
 */
export interface SubmitBookingInput {
  vehicleId: string;
  serviceId: string;
  startDateTime: string;
}

/**
 * Wire-format shape returned by the upcoming-appointments list (T-045).
 * Mirrors `EnrichedTurnoDTO` (`db/mappers/turno.ts`) with `Date`
 * instances replaced by ISO 8601 strings — the wire format that crosses
 * the RSC → client boundary.
 *
 * INV-08: snake_case / Spanish names (`cliente_id`, `vehiculo_id`,
 * `servicio_id`, `fecha_hora_inicio`, `fecha_hora_fin`, `estado`,
 * `created_at`, `updated_at`, `nombre`, `marca`, `modelo`, `patente`)
 * never appear on the wire.
 *
 * INV-02: `status` is one of `PENDIENTE | CONFIRMADO | RECHAZADO |
 * CANCELADO`. COMPLETADO never appears.
 *
 * `serviceName` is `servicios.nombre` (or the fallback constant when the
 * LEFT JOIN returns NULL). `vehicleLabel` is `"${marca} ${modelo} —
 * ${patente}"` (em dash, U+2014) or the fallback constant.
 */
export interface EnrichedTurnoDTOJson extends TurnoDTOJson {
  serviceName: string;
  vehicleLabel: string;
}

/** Predicate mirroring `lib/api/vehicles.ts:42-49` — confirms the server
 *  envelope `{ error: { code, message, issues? } }` shape. */
function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const e = (value as { error?: unknown }).error;
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  const message = (e as { message?: unknown }).message;
  return typeof code === "string" && typeof message === "string";
}

function statusToFallbackCode(status: number): string {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "INVALID_SERVICE";
  return "UNKNOWN_ERROR";
}

/**
 * POST a booking to `/api/appointments`.
 *
 * On non-2xx throws `ApiError` with the parsed envelope
 * (`{ code, message, status, issues? }`). On network failure throws
 * `ApiError(code:"NETWORK_ERROR", status:0)`.
 *
 * The caller maps:
 *   - 201 → navigate to `/appointments?confirmed=<id>` (T-044).
 *   - 409 → `setError` + `router.refresh()`.
 *   - 403 → `setError` + delete `?vehicleId=` + `router.refresh()`.
 *   - 422 → `setError` + delete `?serviceId=` + navigate to `/services`.
 *   - 401 → imperative `window.location.assign("/login?next=...")`.
 *   - 400 → show `error.message` (from the server).
 */
export async function submitBooking(
  input: SubmitBookingInput,
): Promise<TurnoDTOJson> {
  let response: Response;
  try {
    response = await fetch("/api/appointments", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (e) {
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Network error",
      status: 0,
    });
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // fall through with body = null
    }
    if (isErrorBody(body)) {
      throw new ApiError({
        code: body.error.code,
        message: body.error.message,
        status: response.status,
        issues: body.error.issues,
      });
    }
    throw new ApiError({
      code: statusToFallbackCode(response.status),
      message: response.statusText || "Request failed",
      status: response.status,
    });
  }

  const data = (await response.json()) as TurnoDTOJson;
  return data;
}

/**
 * PATCH a cancellation to `/api/appointments/{id}/cancel` (T-046 UI-04).
 *
 * Why PATCH-without-body (per design D01, REQ-08): the route is
 * idempotent — the resource transitions `PENDIENTE|CONFIRMADO → CANCELADO`
 * and only the URL identifies the target. No body, no auth header (the
 * cookie is sent via `credentials:"include"`). The server enforces
 * `assertOwnership` then `ensureFuture` then `canTransition` (RN-07), so
 * client gating is affordance-only.
 *
 * INV-03: cookie auth. The client never sends `customerId` — server-side
 * `requireAuth()` derives it from the session cookie.
 *
 * INV-02: on success the server returns `status:"CANCELADO"` (UPPER_SNAKE,
 * no `COMPLETADO`).
 *
 * INV-08: response is parsed as `TurnoDTO` JSON (camelCase + ISO).
 *
 * Non-2xx behavior — switches on `body.error.code` (NOT status), so the
 * caller can map by semantic code rather than HTTP status:
 *   - `UNAUTHORIZED`              → caller redirects to `/login?next=…`
 *   - `FORBIDDEN`                 → caller renders "No tienes permiso…"
 *   - `APPOINTMENT_NOT_FOUND`     → caller renders "El turno no existe."
 *   - `INVALID_APPOINTMENT_STATE` with `now >= start` → EXACT copy
 *     `"El turno ya comenzó"` (server sets the message at the border)
 *   - `INVALID_APPOINTMENT_STATE` other → `"El turno ya no puede cancelarse."`
 *   - `NETWORK_ERROR` (fetch rejects) → caller shows offline message
 *
 * The route never uses HTTP 400 here (the server validates `id` as UUID
 * with `z.string().uuid()` and returns 400 only on malformed input —
 * impossible from this helper because we `safeParse` the id first).
 */
export async function cancelAppointment(id: string): Promise<TurnoDTOJson> {
  // Client-side UUID guard (REQ-08) — catches tampered URLs before the
  // request leaves the browser. `status:0` marks a client-side failure so
  // the caller can distinguish it from server 4xx/5xx.
  const idParsed = z.uuid().safeParse(id);
  if (!idParsed.success) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      message: "Invalid appointment ID format",
      status: 0,
    });
  }

  let response: Response;
  try {
    response = await fetch(`/api/appointments/${id}/cancel`, {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: e instanceof Error ? e.message : "Network error",
      status: 0,
    });
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // fall through with body = null
    }
    if (isErrorBody(body)) {
      throw new ApiError({
        code: body.error.code,
        message: body.error.message,
        status: response.status,
        issues: body.error.issues,
      });
    }
    throw new ApiError({
      code: statusToFallbackCode(response.status),
      message: response.statusText || "Request failed",
      status: response.status,
    });
  }

  const data = (await response.json()) as TurnoDTOJson;
  return data;
}

/**
 * Reconstruct the BA wall-clock ISO 8601 string the server expects.
 *
 * Why a helper (vs. inline concatenation in BookingForm.tsx):
 *   1. Keeps the TZ assumption in one place — easy to swap for
 *      `slotGenerator.baWallTimeToUtcDate(yyyymmdd, hhmm, tz)` if DST is
 *      ever reinstated in Argentina (Law 26.474 — no DST since 2009).
 *   2. Easy to unit-test in isolation (`appointments.test.ts`).
 *   3. The route regex (`route.ts:27`) requires `YYYY-MM-DDTHH:mm:ss±HH:mm`
 *      — including seconds. The helper hard-codes `:00` for the seconds
 *      component because slotStepMinutes is 30 (slots land on `:00` or
 *      `:30` minute boundaries).
 *
 * TODO(DST) escape hatch — if BA ever reinstates DST, replace the body
 * with `formatInTimeZone(`${date} ${slot}`, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")`
 * or compute via `slotGenerator.baWallTimeToUtcDate(date, slot, tz)` +
 * `.toISOString()`. The test suite asserts the -03:00 offset via `Intl`
 * so a DST regression fails CI.
 *
 * @param date YYYY-MM-DD (already validated by `dateSchema` upstream).
 * @param slot HH:mm (already validated by `slotSchema` upstream — 30-min step).
 * @returns ISO 8601 string with explicit `-03:00` offset, e.g.
 *          `"2026-09-10T09:30:00-03:00"`.
 */
export function buildBookingStartDateTime(date: string, slot: string): string {
  // INV-06: BA timezone hardcoded at UTC-3 since Law 26.474 (2009, no DST).
  // See `WorkshopConfig.timezone = "America/Argentina/Buenos_Aires"`.
  return `${date}T${slot}:00-03:00`;
}

/**
 * Build the post-login `next=` query that preserves the current URL path
 * + search so the user lands back on the booking flow after signing in.
 *
 * Lives here (not in BookingForm.tsx) so the helper is testable in
 * isolation and so the redirect target is derived from inputs only — no
 * `window` / `location` dependency. BookingForm.tsx reads
 * `usePathname()` + `useSearchParams()` and pipes them through.
 *
 * `useSearchParams().toString()` returns the query WITHOUT the leading
 * `?` — e.g. `"serviceId=…&date=…"` — so the helper joins with `?` when
 * the search string is non-empty and falls back to the bare pathname
 * when the search is empty.
 */
export function buildLoginNext(pathname: string, search: string): string {
  const pathWithQuery = search.length > 0 ? `${pathname}?${search}` : pathname;
  return `/login?next=${encodeURIComponent(pathWithQuery)}`;
}