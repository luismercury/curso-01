import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Unified §12 error envelope helper.
 * Produces { error: { code, message, issues? } } with status mapped from code.
 * Zod path adds `issues` array (400 VALIDATION_ERROR).
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  PLATE_ALREADY_EXISTS: "PLATE_ALREADY_EXISTS",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_BY_CODE: Record<string, number> = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.CUSTOMER_NOT_FOUND]: 404,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.EMAIL_ALREADY_EXISTS]: 409,
  [ERROR_CODES.PLATE_ALREADY_EXISTS]: 409,
};

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

/**
 * Build a §12 envelope response.
 * @param code - machine-readable error code (see ERROR_CODES)
 * @param message - human-readable message
 * @param init - optional status override and Zod issues
 */
export function toErrorBody(
  code: string,
  message: string,
  init?: { status?: number; issues?: unknown },
): NextResponse<ErrorBody> {
  const status = init?.status ?? STATUS_BY_CODE[code] ?? 500;
  const error: ErrorBody["error"] =
    init?.issues !== undefined
      ? { code, message, issues: init.issues }
      : { code, message };
  return NextResponse.json({ error }, { status });
}

/**
 * Convenience for Zod validation failures → 400 VALIDATION_ERROR with issues.
 * Accepts a ZodError instance or any error carrying an `issues` array.
 */
export function toValidationError(
  error: ZodError | unknown,
  message = "Validation failed",
): NextResponse<ErrorBody> {
  if (error instanceof ZodError) {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, message, {
      status: 400,
      issues: error.issues,
    });
  }
  const issues = (error as { issues?: unknown })?.issues;
  if (Array.isArray(issues)) {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, message, {
      status: 400,
      issues,
    });
  }
  return toErrorBody(ERROR_CODES.VALIDATION_ERROR, message, { status: 400 });
}
