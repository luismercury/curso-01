import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  ForbiddenError,
  UnauthorizedError,
  assertRole,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { UserRole } from "@/lib/auth/roles";
import { servicePatchSchema } from "@/db/validators/servicio";
import { ServiceNotFoundError } from "@/services/errors";
import { updateServiceActive } from "@/services/servicioService";

const uuidSchema = z.string().uuid();

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  // 1. Auth before any parse/DB
  try {
    const user = await requireAuth(req);
    assertRole(user, UserRole.ADMINISTRADOR);
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

  // Validate UUID before body/DB
  try {
    uuidSchema.parse(id);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return toValidationError(e, "Invalid service ID format");
    }
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid service ID format");
  }

  // 2. Validate body strict {active:boolean}
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  let parsed: z.infer<typeof servicePatchSchema>;
  try {
    parsed = servicePatchSchema.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) return toValidationError(e);
    throw e;
  }

  // 3. Update
  try {
    const dto = await updateServiceActive(db, id, parsed.active);
    return NextResponse.json(dto, { status: 200 });
  } catch (e) {
    if (e instanceof ServiceNotFoundError) {
      return toErrorBody(ERROR_CODES.SERVICE_NOT_FOUND, e.message);
    }
    if (e instanceof z.ZodError) return toValidationError(e);
    throw e;
  }
}
