import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

// RED 1.6 — requireAuth 401/403 + ADMIN bypass contract (T-051, REQ-AUTH-07)

const SECRET = "test-auth-secret-32-chars-minimum-xyz123";

function mkReq(cookieHeader?: string): Request {
  return new Request("http://localhost/api/vehicles/123", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

async function signToken(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode(SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

describe("requireAuth — 401 unauthenticated vs 403 non-owner vs ADMIN bypass (RED 1.6)", () => {
  const prev = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  });

  it("requireAuth throws 401 when no cookie present", async () => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await expect(requireAuth(mkReq())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(requireAuth(mkReq())).rejects.toMatchObject({ status: 401 });
  });

  it("requireAuth throws 401 when token is invalid", async () => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    const req = mkReq("authjs.session-token=invalid.token.here");
    await expect(requireAuth(req)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requireAuth returns authUser when token is valid", async () => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    const token = await signToken({ sub: "u1", email: "a@b.com", role: "CLIENTE" });
    const req = mkReq(`authjs.session-token=${token}`);
    const user = await requireAuth(req);
    expect(user.id).toBe("u1");
    expect(user.email).toBe("a@b.com");
    expect(user.role).toBe("CLIENTE");
  });

  it("requireAuth reads __Secure-authjs.session-token fallback", async () => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    const token = await signToken({ sub: "u2", email: "b@c.com", role: "CLIENTE" });
    const req = mkReq(`__Secure-authjs.session-token=${token}`);
    const user = await requireAuth(req);
    expect(user.id).toBe("u2");
  });

  it("assertOwnership throws 403 when CLIENTE non-owner", async () => {
    const { assertOwnership } = await import("@/lib/auth/requireAuth");
    const authUser = { id: "u1", email: "a@b.com", role: "CLIENTE" as const };
    expect(() => assertOwnership("u2", authUser)).toThrow();
    try {
      assertOwnership("u2", authUser);
    } catch (e) {
      expect((e as { code?: string }).code).toBe("FORBIDDEN");
      expect((e as { status?: number }).status).toBe(403);
    }
  });

  it("assertOwnership passes when CLIENTE owner", async () => {
    const { assertOwnership } = await import("@/lib/auth/requireAuth");
    const authUser = { id: "u1", email: "a@b.com", role: "CLIENTE" as const };
    expect(() => assertOwnership("u1", authUser)).not.toThrow();
  });

  it("assertOwnership ADMIN bypasses ownership check", async () => {
    const { assertOwnership } = await import("@/lib/auth/requireAuth");
    const admin = { id: "admin1", email: "admin@b.com", role: "ADMINISTRADOR" as const };
    expect(() => assertOwnership("other-id", admin)).not.toThrow();
    expect(() => assertOwnership("any-owner", admin)).not.toThrow();
  });

  it("assertRole throws 403 when role mismatch, passes when matches", async () => {
    const { assertRole } = await import("@/lib/auth/requireAuth");
    const cliente = { id: "u1", email: "a@b.com", role: "CLIENTE" as const };
    const admin = { id: "a1", email: "admin@b.com", role: "ADMINISTRADOR" as const };
    expect(() => assertRole(cliente, "ADMINISTRADOR")).toThrow();
    try {
      assertRole(cliente, "ADMINISTRADOR");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("FORBIDDEN");
    }
    expect(() => assertRole(admin, "ADMINISTRADOR")).not.toThrow();
    expect(() => assertRole(cliente, "CLIENTE")).not.toThrow();
  });

  it("middleware edge-safe: requireAuth is server-side, not middleware (import allowlist note)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve("src/lib/auth/requireAuth.ts"), "utf8");
    // Must document hybrid boundary
    expect(src).toMatch(/edge/i);
    expect(src).toMatch(/middleware/i);
    // requireAuth is server-side: may import jose, NOT server-only guarded middleware imports
    expect(src).toMatch(/jose/);
  });
});
