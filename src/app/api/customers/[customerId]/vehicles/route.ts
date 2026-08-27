import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  assertOwnership,
  requireAuth,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/requireAuth";
import {
  createVehicle,
  listVehiclesByCustomer,
  vehicleCreateInputSchema,
} from "@/services/vehicleService";
import {
  VehicleCustomerNotFoundError,
  VehiclePlateTakenError,
} from "@/services/errors";

const uuidSchema = z.string().uuid();

export async function POST(
  req: Request,
  context: { params: Promise<{ customerId: string }> },
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

  const { customerId } = await context.params;

  try {
    uuidSchema.parse(customerId);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e, "Invalid customerId");
    }
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid customerId");
  }

  try {
    assertOwnership(customerId, authUser);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  let parsed: ReturnType<typeof vehicleCreateInputSchema.parse>;
  try {
    const candidate =
      body !== null && typeof body === "object" && !Array.isArray(body)
        ? { ...(body as Record<string, unknown>), customerId }
        : { customerId, ...(body as Record<string, unknown>) };
    parsed = vehicleCreateInputSchema.parse(candidate);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  try {
    const dto = await createVehicle(db, parsed);
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof VehiclePlateTakenError) {
      return toErrorBody(ERROR_CODES.PLATE_ALREADY_EXISTS, e.message);
    }
    if (e instanceof VehicleCustomerNotFoundError) {
      return toErrorBody(ERROR_CODES.CUSTOMER_NOT_FOUND, e.message);
    }
    throw e;
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ customerId: string }> },
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

  const { customerId } = await context.params;

  try {
    uuidSchema.parse(customerId);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e, "Invalid customerId");
    }
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid customerId");
  }

  try {
    assertOwnership(customerId, authUser);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  try {
    const dtos = await listVehiclesByCustomer(db, customerId);
    return NextResponse.json(dtos, { status: 200 });
  } catch (e) {
    if (e instanceof VehicleCustomerNotFoundError) {
      return toErrorBody(ERROR_CODES.CUSTOMER_NOT_FOUND, e.message);
    }
    throw e;
  }
}
