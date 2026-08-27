import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const requireAuthMock = vi.fn();
const assertOwnershipMock = vi.fn();

vi.mock("@/lib/auth/requireAuth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/requireAuth")>("@/lib/auth/requireAuth");
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...(args as never[])),
    assertOwnership: (...args: unknown[]) => assertOwnershipMock(...(args as never[])),
  };
});

const getCustomerByIdMock = vi.fn();

vi.mock("@/services/customerService", async () => {
  const actual = await vi.importActual<typeof import("@/services/customerService")>(
    "@/services/customerService",
  );
  return {
    ...actual,
    getCustomerById: (...args: unknown[]) => getCustomerByIdMock(...(args as never[])),
  };
});

import { UnauthorizedError, ForbiddenError } from "@/lib/auth/requireAuth";
import { CustomerNotFoundError } from "@/services/errors";
import { GET } from "@/app/api/customers/[id]/route";

const OWNER_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_ID = "00000000-0000-4000-a000-000000000002";
const ADMIN_ID = "00000000-0000-4000-a000-000000000099";
const UNKNOWN_ID = "00000000-0000-4000-a000-000000000099";

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/customers/${id}`, {
    headers: { cookie: "authjs.session-token=fake" },
  });
}

function paramsFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const cliente7 = {
  id: OWNER_ID,
  nombre: "Juan",
  apellido: "Perez",
  email: "juan@example.com",
  telefono: "+54 11 1234-5678",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("GET /api/customers/[id] — owned read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default: owner auth, ownership passes, DB returns record
    requireAuthMock.mockResolvedValue({ id: OWNER_ID, email: "juan@example.com", role: "CLIENTE" as const });
    assertOwnershipMock.mockImplementation(() => {});
    getCustomerByIdMock.mockResolvedValue(cliente7);
  });

  it("200 returns Spanish 7-field DTO for owner", async () => {
    const res = await GET(makeGetRequest(OWNER_ID), paramsFor(OWNER_ID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof cliente7;
    expect(json.id).toBe(OWNER_ID);
    expect(json).toHaveProperty("nombre");
    expect(json).toHaveProperty("apellido");
    expect(json).toHaveProperty("email");
    expect(json).toHaveProperty("telefono");
    expect(json).toHaveProperty("createdAt");
    expect(json).toHaveProperty("updatedAt");
    expect(getCustomerByIdMock).toHaveBeenCalledWith(expect.anything(), OWNER_ID);
  });

  it("200 ADMIN bypasses ownership — other id still returns 200", async () => {
    requireAuthMock.mockResolvedValue({ id: ADMIN_ID, email: "admin@example.com", role: "ADMINISTRADOR" as const });
    // real assertOwnership would pass for ADMIN; our mock passes by default
    assertOwnershipMock.mockImplementation(() => {});
    const otherDto = { ...cliente7, id: OTHER_ID };
    getCustomerByIdMock.mockResolvedValue(otherDto);
    const res = await GET(makeGetRequest(OTHER_ID), paramsFor(OTHER_ID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof otherDto;
    expect(json.id).toBe(OTHER_ID);
  });

  it("401 UNAUTHORIZED with §12 envelope when requireAuth throws", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await GET(makeGetRequest(OWNER_ID), paramsFor(OWNER_ID));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body).toHaveProperty("error");
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN with §12 envelope when not owner (CLIENTE non-owner)", async () => {
    requireAuthMock.mockResolvedValue({ id: OWNER_ID, email: "a@b.com", role: "CLIENTE" as const });
    assertOwnershipMock.mockImplementation(() => {
      throw new ForbiddenError("Not owner");
    });
    const res = await GET(makeGetRequest(OTHER_ID), paramsFor(OTHER_ID));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    // authz before DB — service must not be called on 403
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("404 CUSTOMER_NOT_FOUND with §12 envelope when service throws", async () => {
    getCustomerByIdMock.mockRejectedValue(new CustomerNotFoundError(UNKNOWN_ID));
    const res = await GET(makeGetRequest(UNKNOWN_ID), paramsFor(UNKNOWN_ID));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("400 VALIDATION_ERROR with issues for invalid uuid", async () => {
    const res = await GET(makeGetRequest("not-a-uuid"), paramsFor("not-a-uuid"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; issues: unknown[] };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    // invalid uuid should not hit DB
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("authz before DB: 403 never calls getCustomerById even if record exists", async () => {
    requireAuthMock.mockResolvedValue({ id: OWNER_ID, email: "a@b.com", role: "CLIENTE" as const });
    let serviceCalled = false;
    getCustomerByIdMock.mockImplementation(async () => {
      serviceCalled = true;
      return cliente7;
    });
    assertOwnershipMock.mockImplementation(() => {
      throw new ForbiddenError("Not owner");
    });
    const res = await GET(makeGetRequest(OTHER_ID), paramsFor(OTHER_ID));
    expect(res.status).toBe(403);
    expect(serviceCalled).toBe(false);
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("401 envelope is §12 shaped {error:{code,message}} — no flat {code} leak", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Invalid token"));
    const res = await GET(makeGetRequest(OWNER_ID), paramsFor(OWNER_ID));
    const raw = (await res.json()) as Record<string, unknown>;
    expect(raw).toHaveProperty("error");
    expect(raw).not.toHaveProperty("code");
  });
});
