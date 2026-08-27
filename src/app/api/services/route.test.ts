import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const listServicesMock = vi.fn();

vi.mock("@/services/servicioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/servicioService")>(
    "@/services/servicioService",
  );
  return {
    ...actual,
    listServices: (...args: unknown[]) => listServicesMock(...(args as never[])),
  };
});

const requireAuthMock = vi.fn();

vi.mock("@/lib/auth/requireAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireAuth")>(
    "@/lib/auth/requireAuth",
  );
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...(args as never[])),
  };
});

import { UnauthorizedError } from "@/lib/auth/requireAuth";
import { GET } from "@/app/api/services/route";

const activeDto = {
  id: "00000000-0000-4000-a000-000000000001",
  name: "Oil Change",
  description: "Basic oil change",
  durationMinutes: 30,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const inactiveDto = {
  id: "00000000-0000-4000-a000-000000000002",
  name: "Legacy Service",
  description: null,
  durationMinutes: 60,
  active: false,
  createdAt: new Date("2026-01-03T00:00:00.000Z"),
  updatedAt: new Date("2026-01-04T00:00:00.000Z"),
};

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockReset();
    listServicesMock.mockResolvedValue([activeDto]);
  });

  it("200 active-only when no query param (public, no auth required)", async () => {
    listServicesMock.mockResolvedValue([activeDto]);
    const res = await GET(makeRequest("http://localhost/api/services"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as (typeof activeDto & { createdAt: string; updatedAt: string })[];
    expect(json.length).toBe(1);
    expect(json[0]?.id).toBe(activeDto.id);
    expect(json[0]?.name).toBe(activeDto.name);
    expect(json[0]?.createdAt).toBe(activeDto.createdAt.toISOString());
    expect(json[0]?.updatedAt).toBe(activeDto.updatedAt.toISOString());
    expect(json[0]).not.toHaveProperty("nombre");
    expect(json[0]).not.toHaveProperty("activo");
    expect(listServicesMock).toHaveBeenCalledTimes(1);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("200 active-only when includeInactive=false explicitly (no auth)", async () => {
    listServicesMock.mockResolvedValue([activeDto]);
    const res = await GET(makeRequest("http://localhost/api/services?includeInactive=false"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof activeDto[];
    expect(json.length).toBe(1);
    expect(json[0]?.active).toBe(true);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on garbage enum value", async () => {
    const res = await GET(makeRequest("http://localhost/api/services?includeInactive=1"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(body).toHaveProperty("error");
    const raw = body as unknown as Record<string, unknown>;
    expect(raw).not.toHaveProperty("code");
    expect(listServicesMock).not.toHaveBeenCalled();
    expect(requireAuthMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on bare param without value", async () => {
    const res1 = await GET(makeRequest("http://localhost/api/services?includeInactive"));
    expect(res1.status).toBe(400);
    expect(((await res1.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(listServicesMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    listServicesMock.mockResolvedValue([activeDto]);
    const res2 = await GET(makeRequest("http://localhost/api/services?includeInactive="));
    expect(res2.status).toBe(400);
    expect(((await res2.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("401 UNAUTHORIZED when includeInactive=true without auth", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await GET(makeRequest("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error).toHaveProperty("message");
    const raw = body as unknown as Record<string, unknown>;
    expect(raw).toHaveProperty("error");
    expect(raw).not.toHaveProperty("code");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN when includeInactive=true with CLIENTE role", async () => {
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "c@example.com", role: "CLIENTE" });
    const res = await GET(makeRequest("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error).toHaveProperty("message");
    // generic message, no raw flat shape
    const raw = body as unknown as Record<string, unknown>;
    expect(raw).toHaveProperty("error");
    expect(raw).not.toHaveProperty("code");
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("200 all services when includeInactive=true as ADMINISTRADOR", async () => {
    requireAuthMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMINISTRADOR",
    });
    listServicesMock.mockResolvedValue([activeDto, inactiveDto]);
    const res = await GET(makeRequest("http://localhost/api/services?includeInactive=true"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof activeDto[];
    expect(json.length).toBe(2);
    expect(json.some((d) => d.active === false)).toBe(true);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: true });
    expect(requireAuthMock).toHaveBeenCalledTimes(1);
    // INV-08: no snake_case leakage
    expect(json[0]).not.toHaveProperty("duracionMinutos");
    expect(json[0]).not.toHaveProperty("nombre");
  });

  it("200 [] empty catalog (never 404)", async () => {
    listServicesMock.mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/services"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown[];
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(0);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
  });
});
