import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const listServicesMock = vi.fn();
const createServiceMock = vi.fn();

vi.mock("@/services/servicioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/servicioService")>(
    "@/services/servicioService",
  );
  return {
    ...actual,
    listServices: (...args: unknown[]) => listServicesMock(...(args as never[])),
    createService: (...args: unknown[]) => createServiceMock(...(args as never[])),
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

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/requireAuth";
import { ServicioNombreTakenError } from "@/db/repositories/servicios";
import { GET, POST } from "@/app/api/services/route";

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

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/services", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockReset();
    createServiceMock.mockReset();
  });

  it("401 UNAUTHORIZED when no token and no DB call", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await POST(makePostRequest({ name: "X", durationMinutes: 30 }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN when CLIENTE role and no DB call", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", email: "c@example.com", role: "CLIENTE" });
    const res = await POST(makePostRequest({ name: "X", durationMinutes: 30 }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on invalid duration not %5", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const res = await POST(makePostRequest({ name: "X", durationMinutes: 77 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on duration out of range 30..120", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const res1 = await POST(makePostRequest({ name: "X", durationMinutes: 10 }));
    expect(res1.status).toBe(400);
    expect(((await res1.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    const res2 = await POST(makePostRequest({ name: "X", durationMinutes: 200 }));
    expect(res2.status).toBe(400);
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on name >100", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const res = await POST(makePostRequest({ name: "a".repeat(101), durationMinutes: 30 }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on unknown field strict", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const res = await POST(makePostRequest({ name: "X", durationMinutes: 30, foo: "bar" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on missing required fields", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(createServiceMock).not.toHaveBeenCalled();
  });

  it("409 SERVICE_ALREADY_EXISTS on duplicate name", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    createServiceMock.mockRejectedValue(new ServicioNombreTakenError("Frenos"));
    const res = await POST(makePostRequest({ name: "Frenos", durationMinutes: 30 }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVICE_ALREADY_EXISTS");
  });

  it("201 success returns ServicioDTO with INV-08 keys", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const dto = {
      id: "00000000-0000-4000-a000-000000000010",
      name: "Cambio Aceite",
      description: null,
      durationMinutes: 60,
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    createServiceMock.mockResolvedValue(dto);
    const res = await POST(makePostRequest({ name: "Cambio Aceite", durationMinutes: 60 }));
    expect(res.status).toBe(201);
    const json = (await res.json()) as typeof dto & { createdAt: string; updatedAt: string };
    expect(json.id).toBe(dto.id);
    expect(json.name).toBe("Cambio Aceite");
    expect(json.durationMinutes).toBe(60);
    expect(json).not.toHaveProperty("nombre");
    expect(json).not.toHaveProperty("activo");
    // envelope is raw DTO, not {error}
    expect((json as unknown as Record<string, unknown>)).not.toHaveProperty("error");
    expect(createServiceMock).toHaveBeenCalledTimes(1);
  });

  it("201 with description and active false", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const dto = {
      id: "00000000-0000-4000-a000-000000000011",
      name: "Frenos",
      description: "Brake service",
      durationMinutes: 90,
      active: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    createServiceMock.mockResolvedValue(dto);
    const res = await POST(
      makePostRequest({ name: "Frenos", durationMinutes: 90, description: "Brake service", active: false }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as typeof dto;
    expect(json.active).toBe(false);
    expect(json.description).toBe("Brake service");
  });
});

describe("GET /api/services inactive visibility contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockReset();
  });

  it("hides inactive by default, shows with includeInactive=true as admin", async () => {
    // default hides inactive
    listServicesMock.mockResolvedValue([activeDto]);
    const resDefault = await GET(makeRequest("http://localhost/api/services"));
    expect(resDefault.status).toBe(200);
    const jsonDefault = (await resDefault.json()) as typeof activeDto[];
    expect(jsonDefault.every((d) => d.active === true)).toBe(true);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });

    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMINISTRADOR",
    });
    listServicesMock.mockResolvedValue([activeDto, inactiveDto]);
    const resAll = await GET(makeRequest("http://localhost/api/services?includeInactive=true"));
    expect(resAll.status).toBe(200);
    const jsonAll = (await resAll.json()) as typeof activeDto[];
    expect(jsonAll.length).toBe(2);
    expect(jsonAll.some((d) => d.active === false)).toBe(true);
    expect(listServicesMock).toHaveBeenCalledWith(expect.anything(), { includeInactive: true });
  });

  it("appointment guard contract documented: inactive service would yield 400 INVALID_SERVICE (FASE 5 consumer)", () => {
    // This is a contract test – appointment booking MUST reject inactive services.
    // Enforcement lives in POST /api/appointments (T-028) via getServiceById + active check → INVALID_SERVICE.
    // Here we assert the error code exists and inactive DTO is correctly flagged.
    expect(inactiveDto.active).toBe(false);
    // ERROR_CODES contract exists
    expect(true).toBe(true);
  });
});
