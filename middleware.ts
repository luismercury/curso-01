import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const config = {
  matcher: ["/api/:path*"],
};

const PUBLIC_GET_SERVICES = /^\/api\/services(\/.*)?$/;
const PUBLIC_AUTH = /^\/api\/auth(\/.*)?$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (PUBLIC_AUTH.test(pathname)) return NextResponse.next();
  if (method === "GET" && PUBLIC_GET_SERVICES.test(pathname)) return NextResponse.next();

  // Not an api route matched? matcher already filters, but guard.
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const token =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing token" }, { status: 401 });
  }

  const secretStr = process.env.AUTH_SECRET;
  if (!secretStr || secretStr.length < 32) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
  }
  try {
    const secret = new TextEncoder().encode(secretStr);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Invalid token" }, { status: 401 });
  }
}
