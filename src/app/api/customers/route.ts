import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import { createCustomer, customerCreateInputSchema } from "@/services/customerService";
import { CustomerEmailTakenError } from "@/services/errors";

/**
 * POST /api/customers — unauthenticated alias of POST /api/auth/register.
 * Delegates validation to customerCreateInputSchema and persistence to
 * customerService.createCustomer (single 23505 → 409 path).
 * INV-08: returns Spanish 5-field ClienteDTO projection.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  let parsed: ReturnType<typeof customerCreateInputSchema.parse>;
  try {
    parsed = customerCreateInputSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  try {
    const dto = await createCustomer(db, parsed);
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof CustomerEmailTakenError) {
      return toErrorBody(ERROR_CODES.EMAIL_ALREADY_EXISTS, e.message);
    }
    throw e;
  }
}
