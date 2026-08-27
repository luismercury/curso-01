import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SignJWT } from "jose";
import { env } from "@/lib/env";
import { loginSchema } from "@/db/validators/auth";
import { db } from "@/db";
import { findUserByEmail } from "@/db/repositories/users";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid JSON" }, { status: 400 });
  }
  let parsed: { email: string; password: string };
  try {
    parsed = loginSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ code: "VALIDATION_ERROR", issues: e.issues }, { status: 400 });
    }
    throw e;
  }
  const user = await findUserByEmail(db, parsed.email);
  const unauthorized = () => NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid credentials" }, { status: 401 });
  if (!user) return unauthorized();
  const ok = await verifyPassword(parsed.password, user.passwordHash);
  if (!ok) return unauthorized();

  const secret = new TextEncoder().encode(env.AUTH_SECRET);
  const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const res = NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 200 });
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set("authjs.session-token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
