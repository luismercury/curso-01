import "server-only";

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { db } from "@/db";
import { ERROR_CODES, toErrorBody, toValidationError } from "@/lib/http/errors";
import {
  ForbiddenError,
  UnauthorizedError,
  assertRole,
  requireAuth,
} from "@/lib/auth/requireAuth";
import { UserRole } from "@/lib/auth/roles";
import { serviceCreateSchema } from "@/db/validators/servicio";
import { ServicioNombreTakenError } from "@/db/repositories/servicios";
import { createService, listServices } from "@/services/servicioService";

const querySchema = z.object({
  includeInactive: z.enum(["true", "false"]).optional().default("false"),
});

export async function GET(req: Request) {
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return toValidationError(parsed.error);
  }

  const includeInactive = parsed.data.includeInactive === "true";

  if (includeInactive) {
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
  }

  const dtos = await listServices(db, { includeInactive });
  return NextResponse.json(dtos, { status: 200 });
}

export async function POST(req: Request) {
  // 1. Auth before any DB/parse
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

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }

  let parsed: z.infer<typeof serviceCreateSchema>;
  try {
    parsed = serviceCreateSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) return toValidationError(e);
    throw e;
  }

  // 3. Create
  try {
    const dto = await createService(db, parsed);
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof ServicioNombreTakenError) {
      return toErrorBody(ERROR_CODES.SERVICE_ALREADY_EXISTS, e.message);
    }
    if (e instanceof ZodError) return toValidationError(e);
    throw e;
  }
}
