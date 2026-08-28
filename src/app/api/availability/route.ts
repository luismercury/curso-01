import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  ForbiddenError,
  UnauthorizedError,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { workshopConfig } from "@/config/workshopConfig";
import type { GetAvailableSlotsConfig } from "@/services/availability/availabilityService";
import {
  getAvailableSlotsForDate,
  getBaDayUtcRange,
} from "@/services/availability/availabilityService";
import { formatSlotsAsHHmm } from "@/services/availability/slotGenerator";
import { findActiveTurnosByDateRange } from "@/db/repositories/turnos";
import { getServiceById } from "@/services/servicioService";
import { ServiceNotFoundError } from "@/services/errors";
import { ValidationError } from "@/config/workshopSchedule";

const querySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    serviceId: z.string().uuid("serviceId must be a uuid"),
  })
  .strict();

export async function GET(req: Request) {
  // 1. Auth before parse (defense-in-depth)
  try {
    await requireAuth(req);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return toErrorBody(ERROR_CODES.UNAUTHORIZED, e.message);
    }
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  // 2. Strict query parse
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return toValidationError(parsed.error);
  }

  const { date: dateStr, serviceId } = parsed.data;

  // 3. Calendar validation via BA DST range (string overload) + ISO overflow check
  try {
    getBaDayUtcRange(dateStr, workshopConfig.timezone);
    // Detect overflow like 2026-02-30 → 2026-03-02
    const noonCheck = new Date(`${dateStr}T12:00:00.000Z`);
    if (
      Number.isNaN(noonCheck.getTime()) ||
      noonCheck.toISOString().slice(0, 10) !== dateStr
    ) {
      throw new ValidationError(`invalid calendar date: ${dateStr}`);
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      return toValidationError(e);
    }
    throw e;
  }

  // 4. Service resolution + activation guard
  let dto: Awaited<ReturnType<typeof getServiceById>>;
  try {
    dto = await getServiceById(db, serviceId);
  } catch (e) {
    if (e instanceof ServiceNotFoundError) {
      return toErrorBody(ERROR_CODES.SERVICE_NOT_FOUND, e.message);
    }
    if (e instanceof z.ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  if (!dto.active) {
    return toErrorBody(ERROR_CODES.INVALID_SERVICE, "Service is inactive");
  }

  // 5. WorkshopConfig DI
  const config: GetAvailableSlotsConfig = {
    timezone: workshopConfig.timezone,
    slotStepMinutes: workshopConfig.slotStepMinutes,
    capacityPerSlot: workshopConfig.capacityPerSlot,
    operatingHours: workshopConfig.operatingHours,
  };

  // Adapter: single bulk fetch
  const fetchActiveTurnos: import("@/services/availability/availabilityService").FetchActiveTurnos =
    (range) => findActiveTurnosByDateRange(db, range);

  // 6. Delegate to domain — noon sentinel ensures BA ymd matches dateStr via Intl
  const noonDate = new Date(`${dateStr}T12:00:00.000Z`);

  let slots: Awaited<ReturnType<typeof getAvailableSlotsForDate>>;
  try {
    slots = await getAvailableSlotsForDate({
      date: noonDate,
      durationMinutes: dto.durationMinutes,
      config,
      fetchActiveTurnos,
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return toValidationError(e);
    }
    if (e instanceof z.ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  // 7. Presentation
  const availableSlots = formatSlotsAsHHmm(slots, config.timezone);

  return NextResponse.json({ date: dateStr, availableSlots }, { status: 200 });
}
