/**
 * Client-safe Zod schemas + pure helpers for the service selection UI.
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle.
 * - English camelCase — mirrors `db/validators/servicio` (which uses Spanish
 *   DB keys) but is independent so the UI never pulls server-only modules.
 * - INV-08: snake_case/Spanish DB names (`nombre`, `duracionMinutos`,
 *   `activo`) never appear on the wire — only camelCase English.
 *
 * `ApiError` and `ApiErrorBody` mirror the server envelope from
 * `lib/http/errors.ts`. Defined inline (same precedent as
 * `lib/validators/vehicle.ts`) so client islands do not pull server-only
 * modules when they need to parse a non-2xx response from
 * `lib/api/services.ts`.
 */
import { z } from "zod";

/**
 * UUID guard for `?serviceId=` search params.
 *
 * Tampered / non-UUID input fails `safeParse` and the caller MUST fall back
 * to "no selection" instead of throwing or 500-ing (spec scenario:
 * "Tampered/inactive `?serviceId=` fallback").
 */
export const serviceIdSchema = z.string().uuid();

/**
 * Pure formatter for `durationMinutes`. No timezone math, no client
 * `fechaHoraFin` calc (INV-05).
 *
 * Format rules:
 *   - `m < 60`           → `"X min"`
 *   - `m === 60`         → `"60 min"`  (prefer minutes for the 1-hour mark)
 *   - `60 < m < 120`     → `"1 h Y min"` (e.g. `75 → "1 h 15 min"`)
 *   - `m >= 120, clean`  → `"X h"`     (e.g. `120 → "2 h"`)
 *   - `m >= 120, rem>0`  → `"X h Y min"` (e.g. `135 → "2 h 15 min"`)
 *
 * Non-finite or negative input falls back to `"0 min"` so the UI never
 * renders `NaN`.
 */
export function formatDuration(durationMinutes: number): string {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) return "0 min";
  const total = Math.round(durationMinutes);
  const h = Math.floor(total / 60);
  const rem = total % 60;
  if (h === 0) return `${total} min`;
  if (h === 1 && rem === 0) return "60 min";
  if (rem === 0) return `${h} h`;
  return `${h} h ${rem} min`;
}

/**
 * Client-safe error envelope mirrors the server `ErrorBody`
 * `{ error: { code, message, issues? } }` from `lib/http/errors`.
 * The HTTP helper (`src/lib/api/services.ts`) throws `ApiError` on non-2xx.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: Array<string | number>; message: string }>;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: ApiErrorBody["error"]["issues"];

  constructor(args: {
    code: string;
    message: string;
    status: number;
    issues?: ApiErrorBody["error"]["issues"];
  }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.status = args.status;
    this.issues = args.issues;
  }
}
