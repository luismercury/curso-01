import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const updateServiceActiveMock = vi.fn();

vi.mock("@/services/servicioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/servicioService")>(
    "@/services/servicioService",
  );
  return {
    ...actual,
    updateServiceActive: (...args: unknown[]) => updateServiceActiveMock(...(args as never[])),
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
import { ServiceNotFoundError } from "@/services/errors";
import { PATCH } from "@/app/api/services/[id]/route";

const SERVICE_ID = "550e8400-e29b-41d4-a716-446655440001";
const UNKNOWN_ID = "660e8400-e29b-41d4-a716-446655440099";

const activeDto = {
  id: SERVICE_ID,
  name: "Oil Change",
  description: "Basic oil change",
  durationMinutes: 30,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const inactiveDto = {
  ...activeDto,
  active: false,
};

function makePatchRequest(id: string, body: unknown): { req: Request; context: { params: Promise<{ id: string }> } } {
  const req = new Request(`http://localhost/api/services/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const context = { params: Promise.resolve({ id }) };
  return { req, context };
}

describe("PATCH /api/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockReset();
    updateServiceActiveMock.mockReset();
  });

  it("401 UNAUTHORIZED when no token and no DB call", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(SERVICE_ID, { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN when CLIENTE role and no DB call", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", email: "c@example.com", role: "CLIENTE" });
    const { req, context } = makePatchRequest(SERVICE_ID, { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on non-UUID id", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest("not-a-uuid", { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues?: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on empty id", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest("", { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on non-boolean active", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest(SERVICE_ID, { active: "false" });
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on empty body", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest(SERVICE_ID, {});
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on extra field strict", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest(SERVICE_ID, { active: true, foo: "bar" });
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on missing active field", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    const { req, context } = makePatchRequest(SERVICE_ID, { notActive: true });
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(updateServiceActiveMock).not.toHaveBeenCalled();
  });

  it("404 SERVICE_NOT_FOUND when unknown id", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    updateServiceActiveMock.mockRejectedValue(new ServiceNotFoundError(UNKNOWN_ID));
    const { req, context } = makePatchRequest(UNKNOWN_ID, { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVICE_NOT_FOUND");
    expect(updateServiceActiveMock).toHaveBeenCalledTimes(1);
  });

  it("200 success returns DTO with updated active false", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    updateServiceActiveMock.mockResolvedValue(inactiveDto);
    const { req, context } = makePatchRequest(SERVICE_ID, { active: false });
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof inactiveDto & { createdAt: string };
    expect(json.id).toBe(SERVICE_ID);
    expect(json.active).toBe(false);
    expect(json).not.toHaveProperty("nombre");
    expect(json).not.toHaveProperty("activo");
    expect(updateServiceActiveMock).toHaveBeenCalledWith(expect.anything(), SERVICE_ID, false);
  });

  it("200 success toggle to active true", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    updateServiceActiveMock.mockResolvedValue(activeDto);
    const { req, context } = makePatchRequest(SERVICE_ID, { active: true });
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof activeDto;
    expect(json.active).toBe(true);
  });

  it("INV-08 DTO has English keys only", async () => {
    requireAuthMock.mockResolvedValue({ id: "a1", email: "admin@example.com", role: "ADMINISTRADOR" });
    updateServiceActiveMock.mockResolvedValue(activeDto);
    const { req, context } = makePatchRequest(SERVICE_ID, { active: true });
    const res = await PATCH(req, context);
    const json = (await res.json()) as unknown as Record<string, unknown>;
    expect(json).toHaveProperty("name");
    expect(json).toHaveProperty("durationMinutes");
    expect(json).toHaveProperty("active");
    expect(json).not.toHaveProperty("nombre");
    expect(json).not.toHaveProperty("duracionMinutos");
    expect(json).not.toHaveProperty("activo");
  });
});
