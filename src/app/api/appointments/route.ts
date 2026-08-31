import "server-only";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/db";
import { getWorkshopConfig } from "@/config/workshopConfig";
import { ValidationError } from "@/config/workshopSchedule";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { InvalidServiceError } from "@/services/appointmentGuard";
import {
  createAppointment,
  listAppointments,
} from "@/services/appointmentService";
import {
  AppointmentNotAvailableError,
  AppointmentNotFoundError,
} from "@/services/errors";
import { parseAppointmentQuery } from "@/lib/http/appointmentQuery";

// INV-06: ISO 8601 with timezone required (Z or ±HH:MM)
const isoWithTimezoneRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const bodySchema = z
  .object({
    vehicleId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startDateTime: z
      .string()
      .regex(isoWithTimezoneRegex, "startDateTime must be ISO 8601 with timezone")
      .refine((val) => !Number.isNaN(Date.parse(val)), "invalid startDateTime")
      .transform((val) => new Date(val)),
  })
  .strict();

export async function POST(req: Request) {
  // 1. Auth before parse (401)
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

  // 2. Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  // 3. Zod strict parse with timezone
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(rawBody);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  // 4. T-036b DI config per request — empty workshop_schedules → defaults Mon-Fri
  //    / Sat-Sun []; patched rows reflect on next request via getWorkshopConfig.
  const config = await getWorkshopConfig(db);

  // 5. Delegate to atomic service
  try {
    const dto = await createAppointment(
      { db, config },
      {
        vehicleId: parsed.vehicleId,
        serviceId: parsed.serviceId,
        startDateTime: parsed.startDateTime,
        authUser,
      },
    );
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof AppointmentNotAvailableError) {
      return toErrorBody(
        ERROR_CODES.APPOINTMENT_NOT_AVAILABLE,
        "El horario seleccionado ya no se encuentra disponible.",
      );
    }
    if (e instanceof InvalidServiceError) {
      return toErrorBody(ERROR_CODES.INVALID_SERVICE, e.message);
    }
    if (e instanceof ValidationError) {
      return toErrorBody(ERROR_CODES.VALIDATION_ERROR, e.message);
    }
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    if (e instanceof AppointmentNotFoundError) {
      return toErrorBody(ERROR_CODES.APPOINTMENT_NOT_FOUND, e.message);
    }
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }
}

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

  const config = await getWorkshopConfig(db);

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
