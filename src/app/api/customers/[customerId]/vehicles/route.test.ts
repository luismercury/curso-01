import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const requireAuthMock = vi.fn();
const assertOwnershipMock = vi.fn();
vi.mock("@/lib/auth/requireAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/requireAuth")>("@/lib/auth/requireAuth");
  return { ...actual, requireAuth: (...a: unknown[]) => requireAuthMock(...(a as never[])), assertOwnership: (...a: unknown[]) => assertOwnershipMock(...(a as never[])) };
});
const createVehicleMock = vi.fn();
const listVehiclesByCustomerMock = vi.fn();
vi.mock("@/services/vehicleService", async () => {
  const actual = await vi.importActual<typeof import("@/services/vehicleService")>("@/services/vehicleService");
  return { ...actual, createVehicle: (...a: unknown[]) => createVehicleMock(...(a as never[])), listVehiclesByCustomer: (...a: unknown[]) => listVehiclesByCustomerMock(...(a as never[])) };
});

import { UnauthorizedError, ForbiddenError } from "@/lib/auth/requireAuth";
import { VehicleCustomerNotFoundError, VehiclePlateTakenError } from "@/services/errors";
import { GET, POST } from "@/app/api/customers/[customerId]/vehicles/route";

const CID = "00000000-0000-4000-a000-000000000001";
const OID = "00000000-0000-4000-a000-000000000002";
const AID = "00000000-0000-4000-a000-000000000099";
const makePost = (cid: string, body: unknown, raw?: string) => new Request(`http://localhost/api/customers/${cid}/vehicles`, { method: "POST", body: raw ?? JSON.stringify(body), headers: { "content-type": "application/json" } });
const makeGet = (cid: string) => new Request(`http://localhost/api/customers/${cid}/vehicles`, { headers: { cookie: "authjs.session-token=fake" } });
const params = (customerId: string) => ({ params: Promise.resolve({ customerId }) });
const body = { brand: "Toyota", model: "Corolla", year: 2022, plate: "ABC123" };
const dto = { id: "10000000-0000-4000-a000-000000000001", customerId: CID, brand: "Toyota", model: "Corolla", year: 2022, plate: "ABC123", createdAt: new Date("2026-01-01T00:00:00.000Z"), updatedAt: new Date("2026-01-02T00:00:00.000Z") };

describe("POST /api/customers/[customerId]/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: CID, email: "o@e.com", role: "CLIENTE" as const });
    assertOwnershipMock.mockImplementation(() => {});
    createVehicleMock.mockResolvedValue(dto);
    listVehiclesByCustomerMock.mockResolvedValue([]);
  });
  it("201 English DTO owner", async () => {
    const res = await POST(makePost(CID, body), params(CID));
    expect(res.status).toBe(201);
    const j = (await res.json()) as typeof dto;
    expect(j.customerId).toBe(CID);
    expect(j.brand).toBe("Toyota");
    expect(Object.keys(j).sort()).toEqual(["brand","createdAt","customerId","id","model","plate","updatedAt","year"].sort());
    expect(j).not.toHaveProperty("marca");
    expect(createVehicleMock).toHaveBeenCalledTimes(1);
  });
  it("201 ADMIN bypass", async () => {
    requireAuthMock.mockResolvedValue({ id: AID, email: "a@e.com", role: "ADMINISTRADOR" as const });
    createVehicleMock.mockResolvedValue({ ...dto, customerId: OID });
    const res = await POST(makePost(OID, body), params(OID));
    expect(res.status).toBe(201);
    expect(((await res.json()) as typeof dto).customerId).toBe(OID);
  });
  it("401 §12 when unauthenticated", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await POST(makePost(CID, body), params(CID));
    expect(res.status).toBe(401);
    expect((await res.json() as {error:{code:string}}).error.code).toBe("UNAUTHORIZED");
    expect(createVehicleMock).not.toHaveBeenCalled();
  });
  it("403 §12 and authz before DB", async () => {
    assertOwnershipMock.mockImplementation(() => { throw new ForbiddenError("Not owner"); });
    let called = false; createVehicleMock.mockImplementation(async () => { called = true; return dto; });
    const res = await POST(makePost(OID, body), params(OID));
    expect(res.status).toBe(403);
    expect(called).toBe(false);
    expect(createVehicleMock).not.toHaveBeenCalled();
  });
  it("400 invalid customerId uuid", async () => {
    const res = await POST(makePost("bad", body), params("bad"));
    expect(res.status).toBe(400);
    expect((await res.json() as {error:{code:string;issues:unknown[]}}).error.code).toBe("VALIDATION_ERROR");
    expect(createVehicleMock).not.toHaveBeenCalled();
  });
  it("400 Invalid JSON", async () => {
    const res = await POST(makePost(CID, null, "not-json"), params(CID));
    expect(res.status).toBe(400);
    expect((await res.json() as {error:{code:string}}).error.code).toBe("VALIDATION_ERROR");
  });
  it("400 Zod issues on bad body", async () => {
    const res = await POST(makePost(CID, { brand:"A", model:"", year:1800, plate:"!!!" }), params(CID));
    expect(res.status).toBe(400);
    const b = await res.json() as {error:{code:string;issues:unknown[]}};
    expect(b.error.code).toBe("VALIDATION_ERROR");
    expect(b.error.issues.length).toBeGreaterThan(0);
  });
  it("409 PLATE_ALREADY_EXISTS §12", async () => {
    createVehicleMock.mockRejectedValue(new VehiclePlateTakenError("ABC123"));
    const res = await POST(makePost(CID, body), params(CID));
    expect(res.status).toBe(409);
    const raw = await res.json() as Record<string,unknown>;
    expect((raw.error as {code:string}).code).toBe("PLATE_ALREADY_EXISTS");
    expect(raw).not.toHaveProperty("code");
  });
  it("404 CUSTOMER_NOT_FOUND §12", async () => {
    createVehicleMock.mockRejectedValue(new VehicleCustomerNotFoundError(CID));
    const res = await POST(makePost(CID, body), params(CID));
    expect(res.status).toBe(404);
    expect((await res.json() as {error:{code:string}}).error.code).toBe("CUSTOMER_NOT_FOUND");
  });
});

describe("GET /api/customers/[customerId]/vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: CID, email: "o@e.com", role: "CLIENTE" as const });
    assertOwnershipMock.mockImplementation(() => {});
    listVehiclesByCustomerMock.mockResolvedValue([dto]);
  });
  it("200 VehiculoDTO[] owner", async () => {
    const res = await GET(makeGet(CID), params(CID));
    expect(res.status).toBe(200);
    const j = await res.json() as typeof dto[];
    expect(j.length).toBe(1);
    expect(j[0]?.brand).toBe("Toyota");
    expect(j[0]).not.toHaveProperty("marca");
  });
  it("200 [] empty ok", async () => {
    listVehiclesByCustomerMock.mockResolvedValue([]);
    const res = await GET(makeGet(CID), params(CID));
    expect(res.status).toBe(200);
    expect((await res.json() as unknown[]).length).toBe(0);
  });
  it("200 ADMIN bypass", async () => {
    requireAuthMock.mockResolvedValue({ id: AID, email: "a@e.com", role: "ADMINISTRADOR" as const });
    listVehiclesByCustomerMock.mockResolvedValue([{ ...dto, customerId: OID }]);
    const res = await GET(makeGet(OID), params(OID));
    expect(res.status).toBe(200);
    expect(((await res.json()) as typeof dto[])[0]?.customerId).toBe(OID);
  });
  it("401 §12", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("x"));
    const res = await GET(makeGet(CID), params(CID));
    expect(res.status).toBe(401);
    expect(listVehiclesByCustomerMock).not.toHaveBeenCalled();
  });
  it("403 §12 and before DB", async () => {
    assertOwnershipMock.mockImplementation(() => { throw new ForbiddenError("x"); });
    const res = await GET(makeGet(OID), params(OID));
    expect(res.status).toBe(403);
    expect(listVehiclesByCustomerMock).not.toHaveBeenCalled();
  });
  it("400 invalid uuid", async () => {
    const res = await GET(makeGet("bad"), params("bad"));
    expect(res.status).toBe(400);
    expect(listVehiclesByCustomerMock).not.toHaveBeenCalled();
  });
  it("404 when service throws", async () => {
    listVehiclesByCustomerMock.mockRejectedValue(new VehicleCustomerNotFoundError(CID));
    const res = await GET(makeGet(CID), params(CID));
    expect(res.status).toBe(404);
    expect((await res.json() as {error:{code:string}}).error.code).toBe("CUSTOMER_NOT_FOUND");
  });
});
