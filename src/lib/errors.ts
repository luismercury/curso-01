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
 * Walk an error's `cause` chain looking for a PostgreSQL error code.
 * Drizzle wraps driver errors in DrizzleQueryError, keeping the original
 * pg error on `cause` — check every level so callers never import driver
 * types to classify failures.
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
