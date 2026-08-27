import { DomainError } from "@/lib/errors";

/**
 * Thrown when customer registration collides on email UNIQUE in either
 * `clientes` or `users`. Maps to HTTP 409 EMAIL_ALREADY_EXISTS.
 */
export class CustomerEmailTakenError extends DomainError {
  readonly code = "EMAIL_ALREADY_EXISTS" as const;
  readonly email: string;

  constructor(email: string) {
    super(`Email "${email}" is already registered`);
    this.name = "CustomerEmailTakenError";
    this.email = email;
  }
}
