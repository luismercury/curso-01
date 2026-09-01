/**
 * HTTP helper tests for `src/lib/api/services.ts`.
 * Mirrors `vehicles.test.ts`. Verifies parse + status-to-ApiError mapping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/validators/service";
import { listServices } from "@/lib/api/services";

function dtoJson(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Oil Change",
    description: null,
    durationMinutes: 30,
    active: true,
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

describe("listServices — happy path (REQ-SVC-01)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("GETs /api/services?includeInactive=false with credentials+no-store+JSON accept", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [dtoJson()]));
    await listServices();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/services?includeInactive=false");
    expect(init?.method).toBe("GET");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect((init?.headers as Record<string, string>)["accept"]).toBe("application/json");
  });

  it("includeInactive=true surfaces in the query string", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [dtoJson()]));
    await listServices({ includeInactive: true });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/services?includeInactive=true");
  });

  it("returns parsed ServiceDTOJson[] on 200 — camelCase, ISO dates, no Spanish leak", async () => {
    const fetchMock = vi.mocked(fetch);
    const expected = [dtoJson()];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, expected));
    const list = await listServices();
    expect(list).toEqual(expected);
    expect(list[0]?.createdAt).toBe("2026-08-31T13:00:00.000Z");
    expect(list[0]).not.toHaveProperty("nombre");
    expect(list[0]).not.toHaveProperty("duracionMinutos");
    expect(list[0]).not.toHaveProperty("activo");
  });

  it("returns [] on 200 with empty body (never throws)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    expect(await listServices()).toEqual([]);
  });
});

describe("listServices — ApiError mapping on non-2xx (REQ-SVC-04)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [401, "UNAUTHORIZED", { error: { code: "UNAUTHORIZED", message: "Missing token" } }],
    [403, "FORBIDDEN", { error: { code: "FORBIDDEN", message: "Not admin" } }],
  ])("%i -> ApiError{code: %s}", async (status, code, body) => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(status, body));
    let captured: unknown;
    try {
      await listServices();
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect(captured).toMatchObject({ code, status });
  });

  it("400 with issues -> ApiError carries issues[]", async () => {
    const fetchMock = vi.mocked(fetch);
    const issues = [{ path: ["includeInactive"], message: "Must be 'true' or 'false'" }];
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Bad", issues } }),
    );
    let captured: unknown;
    try {
      await listServices();
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect((captured as ApiError).code).toBe("VALIDATION_ERROR");
    expect((captured as ApiError).issues).toEqual(issues);
  });

  it("non-JSON body / unknown status -> fallback (statusToFallbackCode)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(listServices()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      status: 500,
    });
  });
});

describe("listServices — network failure", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("fetch reject -> ApiError{code:'NETWORK_ERROR',status:0}", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("econnreset"));
    await expect(listServices()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });
});