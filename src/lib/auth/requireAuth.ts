/**
 * requireAuth — server-side auth helper (hybrid with edge middleware)
 *
 * Boundary note:
 * - `middleware.ts` runs on the edge and verifies JWT via `jose` without DB.
 * - This helper runs on the Node/server runtime (can import `db`/`env`) and
 *   also verifies JWT via `jose` for per-route ownership/role checks.
 * - Ownership rule: `vehiculo.clienteId == authUser.id` (and `turno.clienteId == authUser.id`);
 *   `ADMINISTRADOR` bypasses ownership via `assertOwnership`.
 * - Returns 401 UNAUTHORIZED for missing/invalid JWT, 403 FORBIDDEN for owner/role mismatch.
 * - Middleware handles 401 early; this helper handles 403 and re-verifies for defense-in-depth.
 */

import { jwtVerify } from "jose";
import type { UserRoleType } from "@/lib/auth/roles";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRoleType;
}

export class UnauthorizedError extends Error {
  status = 401 as const;
  code = "UNAUTHORIZED" as const;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  status = 403 as const;
  code = "FORBIDDEN" as const;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function getTokenFromRequest(req: Request): string | null {
  // NextRequest.cookies.get support (when called with NextRequest)
  const maybeCookies = (req as unknown as { cookies?: { get?: (n: string) => { value: string } | undefined } }).cookies;
  if (maybeCookies?.get) {
    const v1 = maybeCookies.get("authjs.session-token")?.value;
    if (v1) return v1;
    const v2 = maybeCookies.get("__Secure-authjs.session-token")?.value;
    if (v2) return v2;
  }
  const header = req.headers.get("cookie");
  if (!header) return null;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "authjs.session-token" || k === "__Secure-authjs.session-token") return decodeURIComponent(v);
  }
  return null;
}

export async function requireAuth(req: Request): Promise<AuthUser> {
  const token = getTokenFromRequest(req);
  if (!token) throw new UnauthorizedError("Missing token");

  const secretStr = process.env.AUTH_SECRET;
  if (!secretStr || secretStr.length < 32) throw new UnauthorizedError("Invalid token");

  try {
    const secret = new TextEncoder().encode(secretStr);
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub as string | undefined;
    const email = (payload.email as string | undefined) ?? "";
    const role = payload.role as UserRoleType | undefined;
    if (!sub || !role) throw new UnauthorizedError("Invalid token");
    return { id: sub, email, role };
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    throw new UnauthorizedError("Invalid token");
  }
}

export function assertOwnership(resourceOwnerId: string, authUser: AuthUser): void {
  if (authUser.role === "ADMINISTRADOR") return;
  if (resourceOwnerId !== authUser.id) throw new ForbiddenError("Not owner");
}

export function assertRole(authUser: AuthUser, requiredRole: UserRoleType): void {
  if (authUser.role !== requiredRole) throw new ForbiddenError(`Requires role ${requiredRole}`);
}
