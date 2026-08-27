import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  assertOwnership,
  requireAuth,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/requireAuth";
import { getCustomerById } from "@/services/customerService";
import { CustomerNotFoundError } from "@/services/errors";

const uuidSchema = z.string().uuid();

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  let authUser;
  try {
    authUser = await requireAuth(req);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return toErrorBody(ERROR_CODES.UNAUTHORIZED, e.message);
    }
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  const { id } = await context.params;

  // Validate uuid before ownership/DB — produces 400 for malformed id
  // irrespective of owner, while keeping authz before DB for valid ids.
  try {
    uuidSchema.parse(id);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return toValidationError(e, "Invalid id");
    }
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid id");
  }

  try {
    assertOwnership(id, authUser);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  try {
    const dto = await getCustomerById(db, id);
    return NextResponse.json(dto, { status: 200 });
  } catch (e) {
    if (e instanceof CustomerNotFoundError) {
      return toErrorBody(ERROR_CODES.CUSTOMER_NOT_FOUND, e.message);
    }
    throw e;
  }
}
