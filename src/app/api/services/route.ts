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
import { listServices } from "@/services/servicioService";

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
