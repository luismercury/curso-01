/**
 * HTTP helper tests for `src/lib/api/vehicles.ts`.
 *
 * Verifies the parse + status-to-ApiError mapping contract that the form
 * (Task 3.5) and the provider (PR2) depend on:
 *  - 2xx returns the parsed JSON shape (VehicleDTOJson).
 *  - 401/403/400/409 throw ApiError with the right `code`/`status`/`issues`.
 *  - ErrorBody is parsed when present; a missing/wrong body falls back to
 *    `statusToFallbackCode(status)`.
 *  - Network errors surface as ApiError(code:"NETWORK_ERROR", status:0).
 *  - credentials:"include" + cache:"no-store" + JSON content-type are set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/validators/vehicle";
import { createVehicle } from "@/lib/api/vehicles";

const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";

function dtoJson(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "660e8400-e29b-41d4-a716-446655440002",
    customerId: CUSTOMER_ID,
    brand: "Toyota",
    model: "Corolla",
    year: 2024,
    plate: "ABC123",
    createdAt: "2026-08-31T13:00:00.000Z",
    updatedAt: "2026-08-31T13:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createVehicle — happy path (REQ-VEH-04)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to /api/customers/{customerId}/vehicles with credentials+no-store+JSON", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(201, dtoJson()));
    await createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/customers/${encodeURIComponent(CUSTOMER_ID)}/vehicles`);
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" }));
  });

  it("returns parsed VehicleDTOJson on 201", async () => {
    const fetchMock = vi.mocked(fetch);
    const expected = dtoJson();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, expected));
    const dto = await createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } });
    expect(dto).toEqual(expected);
    expect(dto.createdAt).toBe("2026-08-31T13:00:00.000Z"); // ISO string, no Date leak
    expect(dto).not.toHaveProperty("cliente_id");
  });
});

describe("createVehicle — ApiError mapping on non-2xx (REQ-VEH-04)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("401 -> ApiError{code:'UNAUTHORIZED',status:401}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Missing token" } }));
    let captured: unknown;
    try {
      await createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect(captured).toMatchObject({ code: "UNAUTHORIZED", status: 401, message: "Missing token" });
  });

  it("403 -> ApiError{code:'FORBIDDEN',status:403}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "Not owner" } }));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403, message: "Not owner" });
  });

  it("400 with issues -> ApiError carries code+status+issues", async () => {
    const fetchMock = vi.mocked(fetch);
    const issues = [{ path: ["plate"], message: "Plate invalid" }];
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Bad input", issues } }));
    let captured: unknown;
    try {
      await createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect((captured as ApiError).code).toBe("VALIDATION_ERROR");
    expect((captured as ApiError).status).toBe(400);
    expect((captured as ApiError).issues).toEqual(issues);
  });

  it("409 -> ApiError{code:'PLATE_ALREADY_EXISTS',status:409}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: { code: "PLATE_ALREADY_EXISTS", message: "Plate already exists" } }));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "PLATE_ALREADY_EXISTS", status: 409 });
  });

  it("404 with no ErrorBody -> fallback code NOT_FOUND", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 404 }));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("401 with no ErrorBody -> fallback code UNAUTHORIZED", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("5xx -> fallback UNKNOWN_ERROR", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ERROR", status: 500 });
  });
});

describe("createVehicle — network failure", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("fetch reject -> ApiError{code:'NETWORK_ERROR',status:0}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("econnreset"));
    await expect(
      createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});

describe("createVehicle — body parse", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("parses a single DTO object (not an array) — design D1 contract", async () => {
    const fetchMock = vi.mocked(fetch);
    const dto = dtoJson({ plate: "ZZZ999" });
    fetchMock.mockResolvedValueOnce(jsonResponse(201, dto));
    const result = await createVehicle({ customerId: CUSTOMER_ID, payload: { brand: "Toyota", model: "Corolla", year: 2024, plate: "ABC123" } });
    expect(Array.isArray(result)).toBe(false);
    expect(result.plate).toBe("ZZZ999");
  });
});