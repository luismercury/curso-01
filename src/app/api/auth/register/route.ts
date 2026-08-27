import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { registerSchema } from "@/db/validators/auth";
import { createUser, UserEmailTakenError } from "@/db/repositories/users";
import {
  ERROR_CODES,
  toErrorBody,
  toValidationError,
} from "@/lib/http/errors";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toErrorBody(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
  }
  let parsed: ReturnType<typeof registerSchema.parse>;
  try {
    parsed = registerSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return toValidationError(e);
    }
    throw e;
  }
  try {
    const dto = await createUser(db, parsed);
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof UserEmailTakenError) {
      return toErrorBody(ERROR_CODES.EMAIL_ALREADY_EXISTS, e.message);
    }
    throw e;
  }
}
