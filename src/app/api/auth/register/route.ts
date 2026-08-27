import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { registerSchema } from "@/db/validators/auth";
import { createUser, UserEmailTakenError } from "@/db/repositories/users";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid JSON" }, { status: 400 });
  }
  let parsed: ReturnType<typeof registerSchema.parse>;
  try {
    parsed = registerSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ code: "VALIDATION_ERROR", issues: e.issues }, { status: 400 });
    }
    throw e;
  }
  try {
    const dto = await createUser(db, parsed);
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    if (e instanceof UserEmailTakenError) {
      return NextResponse.json({ code: "EMAIL_ALREADY_EXISTS", message: e.message }, { status: 409 });
    }
    throw e;
  }
}
