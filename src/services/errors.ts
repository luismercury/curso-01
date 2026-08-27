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

/**
 * Thrown when a customer lookup by id finds no row.
 * Maps to HTTP 404 CUSTOMER_NOT_FOUND.
 */
export class CustomerNotFoundError extends DomainError {
  readonly code = "CUSTOMER_NOT_FOUND" as const;
  readonly customerId: string;

  constructor(customerId: string, options?: { cause?: unknown }) {
    super(`No customer exists with id "${customerId}"`);
    this.name = "CustomerNotFoundError";
    this.customerId = customerId;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when vehicle creation collides on patente UNIQUE (global).
 * Maps PG 23505 → HTTP 409 PLATE_ALREADY_EXISTS.
 */
export class VehiclePlateTakenError extends DomainError {
  readonly code = "PLATE_ALREADY_EXISTS" as const;
  readonly plate: string;

  constructor(plate: string, options?: { cause?: unknown }) {
    super(`A vehicle with plate "${plate}" already exists`);
    this.name = "VehiclePlateTakenError";
    this.plate = plate;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when vehicle creation references a non-existent clienteId (FK).
 * Maps PG 23503 → HTTP 404 CUSTOMER_NOT_FOUND.
 */
export class VehicleCustomerNotFoundError extends DomainError {
  readonly code = "CUSTOMER_NOT_FOUND" as const;
  readonly customerId: string;

  constructor(customerId: string, options?: { cause?: unknown }) {
    super(`No customer exists with id "${customerId}"`);
    this.name = "VehicleCustomerNotFoundError";
    this.customerId = customerId;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when a service lookup by id finds no row.
 * Maps to HTTP 404 SERVICE_NOT_FOUND.
 */
export class ServiceNotFoundError extends DomainError {
  readonly code = "SERVICE_NOT_FOUND" as const;
  readonly serviceId: string;

  constructor(serviceId: string, options?: { cause?: unknown }) {
    super(`No service exists with id "${serviceId}"`);
    this.name = "ServiceNotFoundError";
    this.serviceId = serviceId;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * Alias for backward compatibility with Spanish repository naming.
 * Prefer VehicleCustomerNotFoundError in service layer.
 */
export const VehicleClienteNotFoundError = VehicleCustomerNotFoundError;
