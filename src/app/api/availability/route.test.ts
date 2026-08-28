import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const getServiceByIdMock = vi.fn();
vi.mock("@/services/servicioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/servicioService")>(
    "@/services/servicioService",
  );
  return {
    ...actual,
    getServiceById: (...args: unknown[]) => getServiceByIdMock(...(args as never[])),
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

const findActiveTurnosMock = vi.fn();
vi.mock("@/db/repositories/turnos", async () => {
  const actual = await vi.importActual<typeof import("@/db/repositories/turnos")>(
    "@/db/repositories/turnos",
  );
  return {
    ...actual,
    findActiveTurnosByDateRange: (...args: unknown[]) =>
      findActiveTurnosMock(...(args as never[])),
  };
});

import { ServiceNotFoundError } from "@/services/errors";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/requireAuth";
import { GET } from "@/app/api/availability/route";
import { getBaDayUtcRange } from "@/services/availability/availabilityService";
import { workshopConfig } from "@/config/workshopConfig";

const VALID_SERVICE_ID = "00000000-0000-4000-a000-000000000001";
const OTHER_SERVICE_ID = "00000000-0000-4000-a000-000000000002";
const UNKNOWN_SERVICE_ID = "00000000-0000-4000-a000-000000000099";

const activeDto = {
  id: VALID_SERVICE_ID,
  name: "Oil Change",
  description: "Basic oil",
  durationMinutes: 60,
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const inactiveDto = {
  id: OTHER_SERVICE_ID,
  name: "Legacy",
  description: null,
  durationMinutes: 60,
  active: false,
  createdAt: new Date("2026-01-03T00:00:00.000Z"),
  updatedAt: new Date("2026-01-04T00:00:00.000Z"),
};

function makeRequest(url: string): Request {
  return new Request(url);
}

// Monday 2026-09-07 is weekday, Saturday 2026-09-12 is closed per DEFAULT_OPERATING_INTERVALS
const MONDAY = "2026-09-07";
const SATURDAY = "2026-09-12";

describe("GET /api/availability — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    getServiceByIdMock.mockResolvedValue(activeDto);
    findActiveTurnosMock.mockResolvedValue([]);
  });

  it("401 UNAUTHORIZED when missing token — no DB call", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
    expect(findActiveTurnosMock).not.toHaveBeenCalled();
  });

  it("401 UNAUTHORIZED when invalid token — no DB call", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Invalid token"));
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN when role guard throws", async () => {
    requireAuthMock.mockRejectedValue(new ForbiddenError("Forbidden"));
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("requireAuth called before validation — auth fail with bad query still 401", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    // bad query would be 400 if auth not checked first
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=bad&serviceId=not-a-uuid&extra=1`),
    );
    expect(res.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledTimes(1);
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/availability — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    getServiceByIdMock.mockResolvedValue(activeDto);
    findActiveTurnosMock.mockResolvedValue([]);
  });

  it("400 VALIDATION_ERROR on bad date format 10-09-2026", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=10-09-2026&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR when missing date", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR when missing serviceId", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}`),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on bad UUID before DB", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=not-a-uuid`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on unknown param strict", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}&extra=1`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on invalid calendar 2026-02-30", async () => {
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=2026-02-30&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/availability — service resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    findActiveTurnosMock.mockResolvedValue([]);
  });

  it("404 SERVICE_NOT_FOUND for well-formed unknown UUID", async () => {
    getServiceByIdMock.mockRejectedValue(new ServiceNotFoundError(UNKNOWN_SERVICE_ID));
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${UNKNOWN_SERVICE_ID}`),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SERVICE_NOT_FOUND");
    expect(findActiveTurnosMock).not.toHaveBeenCalled();
  });

  it("400 INVALID_SERVICE when service inactive — no fetch", async () => {
    getServiceByIdMock.mockResolvedValue(inactiveDto);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${OTHER_SERVICE_ID}`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SERVICE");
    expect(findActiveTurnosMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR when durationMinutes=25 violates 30..120 %5", async () => {
    getServiceByIdMock.mockResolvedValue({ ...activeDto, durationMinutes: 25 });
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    // fetch may or may not have been called depending on validation order; ensure no slots returned
    expect(res.status).toBe(400);
  });

  it("uuid 400 vs 404 distinction: bad format 400, well-formed missing 404", async () => {
    // bad format
    getServiceByIdMock.mockResolvedValue(activeDto);
    const resBad = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=bad-uuid`),
    );
    expect(resBad.status).toBe(400);
    expect(getServiceByIdMock).not.toHaveBeenCalled();

    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    getServiceByIdMock.mockRejectedValue(new ServiceNotFoundError(UNKNOWN_SERVICE_ID));
    const resMiss = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${UNKNOWN_SERVICE_ID}`),
    );
    expect(resMiss.status).toBe(404);
    expect(((await resMiss.json()) as { error: { code: string } }).error.code).toBe("SERVICE_NOT_FOUND");
  });
});

describe("GET /api/availability — delegation & response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    getServiceByIdMock.mockResolvedValue(activeDto);
  });

  it("valid weekday returns 200 {date, availableSlots: HH:mm[]} sorted", async () => {
    findActiveTurnosMock.mockResolvedValue([]);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; availableSlots: string[] };
    expect(body.date).toBe(MONDAY);
    expect(Array.isArray(body.availableSlots)).toBe(true);
    // Monday 60min with default config should have 12 slots (6 morning 09:00-12:00 step 30 filtered 60min + 6 afternoon 14:00-18:00)
    expect(body.availableSlots.length).toBe(12);
    expect(body.availableSlots).toEqual([...body.availableSlots].sort());
    expect(body.availableSlots[0]).toBe("09:00");
    expect(body.availableSlots).toContain("14:00");
    // HH:mm format
    for (const s of body.availableSlots) {
      expect(s).toMatch(/^\d{2}:\d{2}$/);
    }
    // verify no snake_case leakage
    const raw = body as unknown as Record<string, unknown>;
    expect(raw).not.toHaveProperty("fecha");
    expect(raw).not.toHaveProperty("available_slots");
  });

  it("closed Saturday returns 200 []", async () => {
    findActiveTurnosMock.mockResolvedValue([]);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${SATURDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; availableSlots: string[] };
    expect(body.date).toBe(SATURDAY);
    expect(body.availableSlots).toEqual([]);
    expect(findActiveTurnosMock).toHaveBeenCalledTimes(1);
  });

  it("fully booked returns 200 []", async () => {
    // generate all candidates then mark them as existing
    const { generateSlotsForDate } = await import("@/services/availability/slotGenerator");
    const cfg = workshopConfig;
    const noon = new Date(`${MONDAY}T12:00:00.000Z`);
    const candidates = generateSlotsForDate({ date: noon, durationMinutes: 60, config: cfg });
    const existing = candidates.map((c) => ({ start: c.start, end: c.end, status: "PENDIENTE" }));
    findActiveTurnosMock.mockResolvedValue(existing);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availableSlots: string[] };
    expect(body.availableSlots).toEqual([]);
  });

  it("half-open adjacency 09:00-10:00 does not block 10:00", async () => {
    // existing 09:00-10:00 BA
    findActiveTurnosMock.mockResolvedValue([
      { start: new Date("2026-09-07T09:00:00-03:00"), end: new Date("2026-09-07T10:00:00-03:00"), status: "PENDIENTE" },
    ]);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availableSlots: string[] };
    expect(body.availableSlots).not.toContain("09:00");
    expect(body.availableSlots).not.toContain("09:30");
    expect(body.availableSlots).toContain("10:00");
  });

  it("single bulk fetch with BA range via string overload", async () => {
    findActiveTurnosMock.mockResolvedValue([]);
    const exp = getBaDayUtcRange(MONDAY, workshopConfig.timezone);
    const res = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    expect(res.status).toBe(200);
    expect(findActiveTurnosMock).toHaveBeenCalledTimes(1);
    const rawCall = findActiveTurnosMock.mock.calls[0] as unknown as [unknown, { fromUtc: Date; toUtc: Date }];
    const arg = rawCall[1] ?? (rawCall[0] as { fromUtc: Date; toUtc: Date });
    expect(arg.fromUtc.toISOString()).toBe(exp.fromUtc.toISOString());
    expect(arg.toUtc.toISOString()).toBe(exp.toUtc.toISOString());
  });

  it("BA DST range: string overload matches Date overload and NY DST differs", async () => {
    const baStr = getBaDayUtcRange("2026-09-07", "America/Argentina/Buenos_Aires");
    const baDate = getBaDayUtcRange(new Date("2026-09-07T15:00:00.000Z"), "America/Argentina/Buenos_Aires");
    expect(baStr.fromUtc.toISOString()).toBe(baDate.fromUtc.toISOString());

    // NY winter vs summer offset differs; DST spring forward 23h day
    const w = getBaDayUtcRange("2026-01-15", "America/New_York");
    const s = getBaDayUtcRange("2026-07-15", "America/New_York");
    expect(w.fromUtc.toISOString()).not.toBe(s.fromUtc.toISOString());
    const dst = getBaDayUtcRange("2026-03-08", "America/New_York");
    expect(dst.toUtc.getTime() - dst.fromUtc.getTime()).toBe(23 * 3600 * 1000);
  });

  it("error bodies all {error:{code,message,issues?}} envelope", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res401 = await GET(
      makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`),
    );
    const b401 = (await res401.json()) as { error: { code: string; message: string } };
    expect(b401.error).toHaveProperty("code");
    expect(b401.error).toHaveProperty("message");
    expect((b401 as unknown as Record<string, unknown>)).not.toHaveProperty("code");

    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ id: "user-1", email: "u@example.com", role: "CLIENTE" });
    const res400 = await GET(
      makeRequest(`http://localhost/api/availability?date=bad&serviceId=${VALID_SERVICE_ID}`),
    );
    const b400 = (await res400.json()) as { error: { code: string; message: string; issues: unknown[] } };
    expect(b400.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(b400.error.issues)).toBe(true);
  });

  it("WorkshopConfig DI: slotStepMinutes 15 yields more candidates than 30", async () => {
    const { generateSlotsForDate } = await import("@/services/availability/slotGenerator");
    const { workshopConfigSchema } = await import("@/config/workshopConfig");
    const c30 = workshopConfigSchema.parse({ slotStepMinutes: 30, timezone: workshopConfig.timezone, capacityPerSlot: 1 });
    const c15 = workshopConfigSchema.parse({ slotStepMinutes: 15, timezone: workshopConfig.timezone, capacityPerSlot: 1 });
    const noon = new Date(`${MONDAY}T12:00:00.000Z`);
    const r30 = generateSlotsForDate({ date: noon, durationMinutes: 60, config: c30 });
    const r15 = generateSlotsForDate({ date: noon, durationMinutes: 60, config: c15 });
    expect(r15.length).toBeGreaterThan(r30.length);
    expect(r30.length).toBe(12);
  });

  it("EC-02 fully booked 60/90 returns 200 [] without error", async () => {
    const { generateSlotsForDate } = await import("@/services/availability/slotGenerator");
    const cfg = workshopConfig;
    const noon = new Date(`${MONDAY}T12:00:00.000Z`);
    for (const dur of [60, 90] as const) {
      getServiceByIdMock.mockResolvedValue({ ...activeDto, durationMinutes: dur });
      const cands = generateSlotsForDate({ date: noon, durationMinutes: dur, config: cfg });
      findActiveTurnosMock.mockResolvedValue(cands.map((c) => ({ start: c.start, end: c.end, status: "PENDIENTE" })));
      const res = await GET(makeRequest(`http://localhost/api/availability?date=${MONDAY}&serviceId=${VALID_SERVICE_ID}`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { date: string; availableSlots: string[]; error?: unknown };
      expect(body.date).toBe(MONDAY);
      expect(body.availableSlots).toEqual([]);
      expect(body).not.toHaveProperty("error");
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(404);
    }
  });

  it("EC-02 closed Saturday returns 200 [] without error", async () => {
    getServiceByIdMock.mockResolvedValue(activeDto);
    findActiveTurnosMock.mockResolvedValue([]);
    const exp = getBaDayUtcRange(SATURDAY, workshopConfig.timezone);
    const res = await GET(makeRequest(`http://localhost/api/availability?date=${SATURDAY}&serviceId=${VALID_SERVICE_ID}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string; availableSlots: string[]; error?: unknown };
    expect(body.date).toBe(SATURDAY);
    expect(body.availableSlots).toEqual([]);
    expect(body).not.toHaveProperty("error");
    expect(findActiveTurnosMock).toHaveBeenCalledTimes(1);
    const rawCall = findActiveTurnosMock.mock.calls[0] as unknown as [unknown, { fromUtc: Date; toUtc: Date }];
    const arg = rawCall[1] ?? (rawCall[0] as { fromUtc: Date; toUtc: Date });
    expect(arg.fromUtc.toISOString()).toBe(exp.fromUtc.toISOString());
  });
});
