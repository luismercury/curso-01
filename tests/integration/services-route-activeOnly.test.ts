/**
 * Integration tests for `/api/services` route's `includeInactive` contract
 * + page-boundary tampered `?serviceId=` fallback.
 *
 * Pure node: mocks `requireAuth`/`listServices`/`auth` so the 401/403/200
 * branches run without Postgres.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const listServicesMock = vi.fn();
vi.mock("@/services/servicioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/servicioService")>(
    "@/services/servicioService",
  );
  return { ...actual, listServices: (...args: unknown[]) => listServicesMock(...(args as never[])) };
});

const requireAuthMock = vi.fn();
vi.mock("@/lib/auth/requireAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireAuth")>(
    "@/lib/auth/requireAuth",
  );
  return { ...actual, requireAuth: (...args: unknown[]) => requireAuthMock(...(args as never[])) };
});

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

const authMock = vi.fn();
vi.mock("@/lib/auth/auth", () => ({ auth: () => authMock() }));

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/requireAuth";
import { GET } from "@/app/api/services/route";

const activeDto = {
  id: "00000000-0000-4000-a000-000000000001",
  name: "Oil Change", description: "Basic oil change",
  durationMinutes: 30, active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const inactiveDto = {
  id: "00000000-0000-4000-a000-000000000002",
  name: "Legacy Service", description: null,
  durationMinutes: 60, active: false,
  createdAt: new Date("2026-01-03T00:00:00.000Z"),
  updatedAt: new Date("2026-01-04T00:00:00.000Z"),
};

function req(url: string): Request {
  return new Request(url);
}

describe("GET /api/services — includeInactive contract (T-040)", () => {
  beforeEach(() => { vi.clearAllMocks(); requireAuthMock.mockReset(); listServicesMock.mockReset(); });
  afterEach(() => vi.clearAllMocks());

  it("default (no query) -> 200 active-only, no auth required", async () => {
    listServicesMock.mockResolvedValueOnce([activeDto]);
    const res = await GET(req("http://localhost/api/services"));
    expect(res.status).toBe(200);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("includeInactive=false explicit -> 200 active-only, no auth", async () => {
    listServicesMock.mockResolvedValueOnce([activeDto]);
    const res = await GET(req("http://localhost/api/services?includeInactive=false"));
    expect(res.status).toBe(200);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("includeInactive=true + no auth -> 401 UNAUTHORIZED, no DB call", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError("Missing token"));
    const res = await GET(req("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("includeInactive=true + CLIENTE -> 403 FORBIDDEN, no DB call", async () => {
    requireAuthMock.mockResolvedValueOnce({ id: "u-1", email: "c@x.test", role: "CLIENTE" });
    const res = await GET(req("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("includeInactive=true + ADMINISTRADOR -> 200 all (active + inactive)", async () => {
    requireAuthMock.mockResolvedValueOnce({ id: "admin-1", email: "admin@x.test", role: "ADMINISTRADOR" });
    listServicesMock.mockResolvedValueOnce([activeDto, inactiveDto]);
    const res = await GET(req("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof activeDto[];
    expect(json.some((d) => d.active === false)).toBe(true);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: true });
  });

  it("includeInactive=garbage -> 400 VALIDATION_ERROR, no DB call", async () => {
    const res = await GET(req("http://localhost/api/services?includeInactive=yes"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(listServicesMock).not.toHaveBeenCalled();
  });
});

describe("Services page boundary — tampered ?serviceId= fallback (T-040)", () => {
  beforeEach(() => { vi.clearAllMocks(); authMock.mockReset(); listServicesMock.mockReset(); });
  afterEach(() => vi.clearAllMocks());

  async function renderPage(searchParams: Record<string, string>) {
    const mod = await import("@/app/(customer)/services/page");
    return mod.default({ searchParams: Promise.resolve(searchParams) });
  }

  it("tampered ?serviceId=garbage does not 500", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u-1", email: "u@x.test", role: "CLIENTE" } });
    listServicesMock.mockResolvedValueOnce([activeDto]);
    const tree = await renderPage({ serviceId: "garbage" });
    expect(tree).toBeDefined();
    expect(JSON.stringify(tree)).toContain("Oil Change");
  });

  it("valid active ?serviceId= restores selection without a 500", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u-1", email: "u@x.test", role: "CLIENTE" } });
    listServicesMock.mockResolvedValueOnce([activeDto]);
    const tree = await renderPage({ serviceId: activeDto.id });
    expect(tree).toBeDefined();
    expect(JSON.stringify(tree)).toContain(activeDto.id);
  });

  it("null session -> redirect('/login') regardless of ?serviceId=", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(renderPage({ serviceId: "garbage" })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("?serviceId= unknown UUID -> renders list, no select", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u-1", email: "u@x.test", role: "CLIENTE" } });
    listServicesMock.mockResolvedValueOnce([activeDto]);
    const tree = await renderPage({ serviceId: "00000000-0000-4000-a000-000000000099" });
    expect(tree).toBeDefined();
    const json = JSON.stringify(tree);
    expect(json).toContain(activeDto.id); // list rendered
    expect(json).not.toContain("00000000-0000-4000-a000-000000000099"); // unknown id not echoed
  });
});