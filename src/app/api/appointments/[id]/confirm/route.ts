import "server-only";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/db";
import { workshopConfig } from "@/config/workshopConfig";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  ForbiddenError,
  UnauthorizedError,
  assertRole,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { UserRole } from "@/lib/auth/roles";
import { confirmAppointment } from "@/services/appointmentService";
import {
  AppointmentNotFoundError,
  InvalidAppointmentStateError,
} from "@/services/errors";

const uuidSchema = z.string().uuid();

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  // 1. Auth + role before any validation/DB (401/403)
  let authUser: Awaited<ReturnType<typeof requireAuth>>;
  try {
    const user = await requireAuth(req);
    assertRole(user, UserRole.ADMINISTRADOR);
    authUser = user;
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

  // 2. UUID validation → 400 with issues
  try {
    uuidSchema.parse(id);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e, "Invalid appointment ID format");
    }
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid appointment ID format");
  }

  // 3. DI config per INV-01/06 (parametrizable, not hardcoded)
  const config: Pick<
    typeof workshopConfig,
    "timezone" | "operatingHours" | "capacityPerSlot"
  > = {
    timezone: workshopConfig.timezone,
    operatingHours: workshopConfig.operatingHours,
    capacityPerSlot: workshopConfig.capacityPerSlot,
  };

  // 4. Delegate to service — no body, no capacity/FOR UPDATE logic
  try {
    const dto = await confirmAppointment({ db, config }, id, authUser);
    return NextResponse.json(dto, { status: 200 });
  } catch (e) {
    if (e instanceof AppointmentNotFoundError) {
      return toErrorBody(ERROR_CODES.APPOINTMENT_NOT_FOUND, e.message);
    }
    if (e instanceof InvalidAppointmentStateError) {
      return toErrorBody(ERROR_CODES.INVALID_APPOINTMENT_STATE, e.message);
    }
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }
}
