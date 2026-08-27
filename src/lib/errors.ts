/**
 * Base class for domain-level errors that map to predictable HTTP responses
 * (e.g. 409 Conflict). Repositories translate infrastructure errors into
 * these so callers never import driver-specific types.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * PostgreSQL error codes for T-009 hardening (see Technical-spec §10).
 * 23514 → CHECK violation (VALIDATION_ERROR domain)
 * 23P01 → EXCLUDE violation (APPOINTMENT_NOT_AVAILABLE for T-028)
 * 23503 → FK violation (preserved)
 * 23505 → UNIQUE violation (preserved)
 * Walk via hasPgCode so callers never import driver types.
 */
export const PG_CODES = {
  CHECK_VIOLATION: "23514",
  EXCLUSION_VIOLATION: "23P01",
  FOREIGN_KEY_VIOLATION: "23503",
  UNIQUE_VIOLATION: "23505",
} as const;

/**
 * Walk an error's `cause` chain looking for a PostgreSQL error code.
 * Drizzle wraps driver errors in DrizzleQueryError, keeping the original
 * pg error on `cause` — check every level so callers never import driver
 * types to classify failures.
 * Distinct codes: 23514 CHECK → VALIDATION_ERROR, 23P01 EXCLUDE → APPOINTMENT_NOT_AVAILABLE.
 */
export function hasPgCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ((current as { code?: unknown }).code === code) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
