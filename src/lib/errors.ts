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
