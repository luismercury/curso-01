import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/db";
import { upsertDaySchedule } from "@/db/repositories/workshopSchedules";
import {
  workshopScheduleInputSchema,
  type WorkshopScheduleInput,
} from "@/config/workshopConfig";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  assertRole,
  ForbiddenError,
  UnauthorizedError,
  requireAuth,
} from "@/lib/auth/requireAuth";

/**
 * T-036b PR #2 — `PATCH /api/admin/schedule`
 *
 * Body: `{ dayOfWeek: 0..6, openIntervals: [{ start: "HH:mm", end: "HH:mm" }] }`.
 *
 * Precedence (mirrors H-19 / T-036 admin patterns):
 *   1. requireAuth → 401 UNAUTHORIZED before parse.
 *   2. assertRole(ADMINISTRADOR) → 403 FORBIDDEN before parse (CLIENTE never mutates).
 *   3. Zod strict + superRefine(validateIntervals) → 400 VALIDATION_ERROR with issues.
 *   4. upsertDaySchedule (validateIntervals guard inside repo) → 200.
 *
 * `dynamic = "force-dynamic"` ensures the route is never statically cached.
 */
export const dynamic = "force-dynamic";

export async function PATCH(req: Request): Promise<NextResponse> {
  // 1. Auth before parse — 401 wins.
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

  // 2. Role before parse — 403 wins over 400 even with valid body.
  try {
    assertRole(authUser, "ADMINISTRADOR");
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return toErrorBody(ERROR_CODES.FORBIDDEN, e.message);
    }
    throw e;
  }

  // 3. JSON body parse.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  // 4. Zod strict + superRefine(validateIntervals) — overlap/start>=end/unsorted/format.
  let parsed: WorkshopScheduleInput;
  try {
    parsed = workshopScheduleInputSchema.parse(rawBody);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }

  // 5. Persist single day. validateIntervals guard runs inside upsertDaySchedule.
  const stored = await upsertDaySchedule(db, parsed.dayOfWeek, parsed.openIntervals);

  return NextResponse.json(
    { dayOfWeek: parsed.dayOfWeek, openIntervals: stored },
    { status: 200 },
  );
}
