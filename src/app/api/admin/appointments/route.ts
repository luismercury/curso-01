import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/db";
import { workshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  assertRole,
  ForbiddenError,
  UnauthorizedError,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { listAppointments } from "@/services/appointmentService";
import { parseAppointmentQuery } from "@/lib/http/appointmentQuery";

export async function GET(req: Request) {
  let authUser: Awaited<ReturnType<typeof requireAuth>>;
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

  try {
    assertRole(authUser, "ADMINISTRADOR");
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  const raw = Object.fromEntries(new URL(req.url).searchParams.entries()) as Record<
    string,
    string | undefined
  >;

  let parsed: ReturnType<typeof parseAppointmentQuery>;
  try {
    parsed = parseAppointmentQuery(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    if (e instanceof ValidationError) {
      return toErrorBody(ERROR_CODES.VALIDATION_ERROR, e.message);
    }
    throw e;
  }

  const config: Pick<typeof workshopConfig, "timezone" | "operatingHours" | "capacityPerSlot"> = {
    timezone: workshopConfig.timezone,
    operatingHours: workshopConfig.operatingHours,
    capacityPerSlot: workshopConfig.capacityPerSlot,
  };

  try {
    const result = await listAppointments({ db, config, now: new Date() }, parsed as never, authUser);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return toErrorBody(ERROR_CODES.VALIDATION_ERROR, e.message);
    }
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }
}
