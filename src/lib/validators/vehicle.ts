/**
 * Client-safe Zod schemas for the vehicle UI boundary.
 *
 * - Pure: no `server-only`, no DB imports. Safe to ship to the browser bundle.
 * - English camelCase — mirrors `services/vehicleService.vehicleCreateInputSchema`
 *   but is independent so the UI form never pulls server-only modules.
 * - `customerId` is server-derived via `auth()`; the client payload is just
 *   `{ brand, model, year, plate }`. The server re-asserts `customerId` from
 *   the JWT (`INV-03` ownership rule).
 * - `normalizePatente` re-exported from `@/db/validators/vehiculo` (pure function,
 *   no `server-only` marker in that module) to keep a single source of truth for
 *   the dual-defense plate normalization used by repositories.
 *
 * INV-08: snake_case/Spanish DB names (`marca`, `patente`, `cliente_id`) never
 * appear on the wire — only camelCase English.
 */
import { z } from "zod";
import { normalizePatente as normalizePatenteShared } from "@/db/validators/vehiculo";

export const MAX_BRAND = 100;
export const MAX_MODEL = 100;
export const MIN_YEAR = 1900;

/**
 * Server-computed max year (current year + 1) — passed down as a prop so the
 * client never calls `new Date()` and avoids hydration mismatch across the
 * Dec 31 → Jan 1 boundary.
 */
export function maxYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

/**
 * Plate normalization reused from the DB validators layer. Trim → upper →
 * strip whitespace and dashes. Pure, idempotent.
 */
export const normalizePatente = normalizePatenteShared;

/**
 * Client payload schema (camelCase English, strict, no `customerId`).
 * `customerId` is always derived server-side from `auth()`.
 */
export const vehicleCreateInputSchema = z
  .object({
    brand: z
      .string()
      .trim()
      .min(2, "Brand must be at least 2 characters")
      .max(MAX_BRAND, `Brand must be at most ${MAX_BRAND} characters`),
    model: z
      .string()
      .trim()
      .min(2, "Model must be at least 2 characters")
      .max(MAX_MODEL, `Model must be at most ${MAX_MODEL} characters`),
    year: z
      .number()
      .int("Year must be an integer")
      .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
      .max(maxYear(), "Year cannot be more than next year"),
    plate: z
      .string()
      .transform((v) => normalizePatente(v))
      .pipe(
        z
          .string()
          .regex(
            /^[A-Z0-9]{6,7}$/,
            "Plate must be 6-7 alphanumeric characters after normalization",
          ),
      ),
  })
  .strict();

export type VehicleCreatePayload = z.input<typeof vehicleCreateInputSchema>;
export type VehicleCreateParsed = z.infer<typeof vehicleCreateInputSchema>;

/**
 * Client-safe error envelope mirrors the server `ErrorBody`
 * `{ error: { code, message, issues? } }` from `lib/http/errors`.
 * The HTTP helper (`src/lib/api/vehicles.ts`) throws `ApiError` on non-2xx.
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