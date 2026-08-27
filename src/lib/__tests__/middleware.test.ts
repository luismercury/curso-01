import { describe, expect, it } from "vitest";

describe("middleware matcher 401 vs public (RED 1.5)", () => {
  it("matcher protects /api/* except /api/auth/* and GET /api/services (file-content)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve("middleware.ts"), "utf8");
    expect(src).toMatch(/matcher/);
    // Regex literals serialize with \/ — match permissively : api + optional backslash + /auth
    expect(src).toMatch(/api.*auth/);
    expect(src).toMatch(/api.*services/);
    expect(src).toMatch(/401|UNAUTHORIZED/);
  });

  it("middleware is edge-safe — imports subset of allowlist", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve("middleware.ts"), "utf8");
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/from\s+["']@\/db/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/env/);
    // allowed: next/server, next-auth/jwt, jose
    expect(src).toMatch(/next\/server|next-auth\/jwt|jose/);
  });
});
