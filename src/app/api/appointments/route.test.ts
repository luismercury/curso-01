import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const createAppointmentMock = vi.fn();
const listAppointmentsMock = vi.fn();
vi.mock("@/services/appointmentService", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/appointmentService")
  >("@/services/appointmentService");
  return {
    ...actual,
    createAppointment: (...args: unknown[]) =>
      createAppointmentMock(...(args as never[])),
    listAppointments: (...args: unknown[]) =>
      listAppointmentsMock(...(args as never[])),
  };
});

const requireAuthMock = vi.fn();
vi.mock("@/lib/auth/requireAuth", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/requireAuth")
  >("@/lib/auth/requireAuth");
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...(args as never[])),
  };
});

const getWorkshopConfigMock = vi.fn();
vi.mock("@/config/workshopConfig", async () => {
  const actual = await vi.importActual<
    typeof import("@/config/workshopConfig")
  >("@/config/workshopConfig");
  return {
    ...actual,
    getWorkshopConfig: (...args: unknown[]) => getWorkshopConfigMock(...(args as never[])),
  };
});

import { workshopConfig } from "@/config/workshopConfig";
import { DEFAULT_OPERATING_INTERVALS } from "@/config/workshopSchedule";

import {
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/auth/requireAuth";
import { ValidationError } from "@/config/workshopSchedule";
import { InvalidServiceError } from "@/services/appointmentGuard";
import { AppointmentNotAvailableError } from "@/services/errors";
import { GET, POST } from "@/app/api/appointments/route";

const CLIENTE = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "c@c.com", role: "CLIENTE" as const };
const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown, rawBody?: string): Request {
  if (rawBody !== undefined) {
    return new Request("http://localhost/api/appointments", {
      method: "POST",
      body: rawBody,
      headers: { "content-type": "application/json" },
    });
  }
  return new Request("http://localhost/api/appointments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const turnoDTO = {
  id: "33333333-3333-4333-8333-333333333333",
  customerId: CLIENTE.id,
  vehicleId: VEHICLE_ID,
  serviceId: SERVICE_ID,
  startDateTime: new Date("2026-09-10T13:00:00.000Z"),
  endDateTime: new Date("2026-09-10T14:00:00.000Z"),
  status: "PENDIENTE",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

// Default per-request mock: returns the frozen fallback so existing tests
// keep their pre-PR3 behavior (empty operatingHours → Mon-Fri DEFAULT, Sat/Sun []).
function setWorkshopConfigFallback() {
  getWorkshopConfigMock.mockResolvedValue(workshopConfig);
}

describe("POST /api/appointments — thin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(CLIENTE);
    createAppointmentMock.mockResolvedValue(turnoDTO);
    setWorkshopConfigFallback();
  });

  it("201 returns TurnoDTO camelCase on valid ISO with timezone", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as typeof turnoDTO & Record<string, unknown>;
    expect(json.id).toBe(turnoDTO.id);
    expect(json.customerId).toBe(turnoDTO.customerId);
    expect(json).toHaveProperty("startDateTime");
    expect(json).toHaveProperty("endDateTime");
    expect(json).toHaveProperty("status");
    expect(json).not.toHaveProperty("estado");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(createAppointmentMock).toHaveBeenCalledTimes(1);
    const calledArgs = createAppointmentMock.mock.calls[0] as unknown as [
      { config: { capacityPerSlot: number; timezone: string } },
      { vehicleId: string; serviceId: string; startDateTime: Date },
    ];
    // DI config carries capacityPerSlot and timezone (INV-01/06)
    expect(calledArgs[0].config).toHaveProperty("capacityPerSlot");
    expect(calledArgs[0].config).toHaveProperty("timezone");
    // UTC conversion: BA 10:00-03:00 => 13:00Z
    expect(calledArgs[1].startDateTime.toISOString()).toBe("2026-09-10T13:00:00.000Z");
  });

  it("201 with Z timezone also accepted", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T13:00:00.000Z",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("401 UNAUTHORIZED when requireAuth throws", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on Zod strict failure — missing field", async () => {
    const res = await POST(
      makeRequest({ vehicleId: VEHICLE_ID, serviceId: SERVICE_ID } as never),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; issues: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 on unknown strict field", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
        extra: "nope",
      } as never),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 when startDateTime without timezone (naive) — INV-06", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 on invalid JSON", async () => {
    const res = await POST(makeRequest(null, "not-json"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 on invalid uuid", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: "not-uuid",
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });

  it("409 APPOINTMENT_NOT_AVAILABLE mapped from service", async () => {
    createAppointmentMock.mockRejectedValue(
      new AppointmentNotAvailableError("El horario seleccionado ya no se encuentra disponible."),
    );
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("APPOINTMENT_NOT_AVAILABLE");
    expect(body.error.message).toBe("El horario seleccionado ya no se encuentra disponible.");
  });

  it("400 INVALID_SERVICE mapped", async () => {
    createAppointmentMock.mockRejectedValue(new InvalidServiceError('Servicio "X" is not active'));
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_SERVICE");
  });

  it("400 VALIDATION_ERROR mapped for ValidationError (e.g., 11:30+90>12:00)", async () => {
    createAppointmentMock.mockRejectedValue(new ValidationError("outside operating hours"));
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T11:30:00-03:00",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("403 FORBIDDEN mapped", async () => {
    createAppointmentMock.mockRejectedValue(new ForbiddenError("Not owner"));
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("no snake_case leak in 201 DTO (INV-08)", async () => {
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).not.toHaveProperty("cliente_id");
    expect(json).not.toHaveProperty("vehiculo_id");
    expect(json).not.toHaveProperty("servicio_id");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(json).not.toHaveProperty("estado");
  });
});

describe("GET /api/appointments — CLIENTE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(CLIENTE);
    listAppointmentsMock.mockResolvedValue({ data: [turnoDTO], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    setWorkshopConfigFallback();
  });
  const getReq = (u: string) => new Request(u, { method: "GET" });
  it("200 envelope + customerId injection", async () => {
    const r = await GET(getReq("http://localhost/api/appointments?status=PENDIENTE"));
    expect(r.status).toBe(200); const j = (await r.json()) as { data: unknown[]; pagination: unknown };
    expect(j).toHaveProperty("data"); expect(listAppointmentsMock).toHaveBeenCalledTimes(1);
    const a = listAppointmentsMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>, typeof CLIENTE];
    expect(a[2]).toEqual(CLIENTE); expect(a[1].status).toBe("PENDIENTE");
  });
  it("401 before 400", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const r = await GET(getReq("http://localhost/api/appointments?limit=101"));
    expect(r.status).toBe(401); expect(listAppointmentsMock).not.toHaveBeenCalled();
  });
  it("400 CANCELADO without flag", async () => {
    const r = await GET(getReq("http://localhost/api/appointments?status=CANCELADO"));
    expect(r.status).toBe(400); expect(((await r.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });
  it("400 date+from & limit 101", async () => {
    const r1 = await GET(getReq("http://localhost/api/appointments?date=2026-09-10&from=2026-09-10T00:00:00-03:00"));
    expect(r1.status).toBe(400);
    const r2 = await GET(getReq("http://localhost/api/appointments?limit=101"));
    expect(r2.status).toBe(400);
  });
  it("no snake leak camelCase", async () => {
    const r = await GET(getReq("http://localhost/api/appointments"));
    const j = (await r.json()) as { data: Record<string, unknown>[] };
    expect(j.data[0]).toHaveProperty("customerId"); expect(j.data[0]).not.toHaveProperty("cliente_id");
  });
  it("sort & pagination passthrough", async () => {
    await GET(getReq("http://localhost/api/appointments?sort=startAt:desc"));
    expect((listAppointmentsMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1].sort).toBe("startAt:desc");
    listAppointmentsMock.mockResolvedValue({ data: [], pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } });
    const r = await GET(getReq("http://localhost/api/appointments?page=2&limit=10&offset=999"));
    expect(r.status).toBe(200); const last = listAppointmentsMock.mock.calls.at(-1) as unknown as [unknown, Record<string, unknown>];
    expect(last[1].page).toBe(2); expect(last[1].offset).toBe(999);
  });

  // H-19 / Trace 2 — CLIENTE own pending reuses T-033; service contract: listAppointments
  // injects customerId=authUser.id for CLIENTE (mocked here, so we verify the route passes
  // parsed.query with status=PENDIENTE plus the CLIENTE authUser that the service would scope on).
  it("CLIENTE own pending 200 — status=PENDIENTE scopes customerId", async () => {
    const r = await GET(getReq("http://localhost/api/appointments?status=PENDIENTE"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j).toHaveProperty("data");
    expect(j.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(listAppointmentsMock).toHaveBeenCalledTimes(1);
    const args = listAppointmentsMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>, typeof CLIENTE];
    expect(args[1].status).toBe("PENDIENTE");
    // Route hands the CLIENTE authUser to the service, which is responsible for
    // injecting customerId=authUser.id per AppointmentService.listAppointments (§4.5).
    expect(args[2]).toEqual(CLIENTE);
    expect(args[2].role).toBe("CLIENTE");
    expect(args[2].id).toBe(CLIENTE.id);
    // INV-08 negative: no snake_case leak in DTO
    expect(j.data[0]).not.toHaveProperty("estado");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_inicio");
  });

  // H-19 / T-037 / Trace 2 — CLIENTE daily agenda via ?date=YYYY-MM-DD reuse.
  // Route forwards date+sort verbatim; service injects customerId=authUser.id (§4.5).
  it("agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037", async () => {
    const r = await GET(getReq("http://localhost/api/appointments?date=2026-09-10&sort=startAt:asc"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(listAppointmentsMock).toHaveBeenCalledTimes(1);
    const args = listAppointmentsMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>, typeof CLIENTE];
    expect(args[1]).toMatchObject({ date: "2026-09-10", sort: "startAt:asc" });
    // H-19 / §4.5: listAppointments injects customerId=authUser.id for CLIENTE
    expect(args[2]).toEqual(CLIENTE);
    expect(j.data).toHaveLength(1);
  });

  // H-11 / T-037 / Trace 3 — client agenda ?date= include* flags default false / each / both.
  it("agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037", async () => {
    const cases: Array<{ url: string; inc: boolean; rej: boolean }> = [
      { url: "?date=2026-09-10&page=1&limit=20&sort=startAt:asc", inc: false, rej: false },
      { url: "?date=2026-09-10&includeCancelled=true", inc: true, rej: false },
      { url: "?date=2026-09-10&includeRejected=true", inc: false, rej: true },
      { url: "?date=2026-09-10&includeCancelled=true&includeRejected=true", inc: true, rej: true },
    ];
    for (const c of cases) {
      await GET(getReq(`http://localhost/api/appointments${c.url}`));
      const args = listAppointmentsMock.mock.calls.at(-1) as unknown as [unknown, Record<string, unknown>, typeof CLIENTE];
      expect(args[1]).toMatchObject({ date: "2026-09-10", includeCancelled: c.inc, includeRejected: c.rej });
    }
    expect(listAppointmentsMock).toHaveBeenCalledTimes(4);
  });

  // INV-08/H-28 / T-037 / Trace 5 — client agenda ?date= no snake leak + envelope.
  it("agenda ?date= INV-08 no snake leak + H-28 envelope — T-037", async () => {
    const r = await GET(getReq("http://localhost/api/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j.data[0]).toMatchObject({ status: "PENDIENTE", customerId: CLIENTE.id });
    expect(j.data[0]).toHaveProperty("startDateTime");
    expect(j.data[0]).toHaveProperty("endDateTime");
    expect(j.data[0]).not.toHaveProperty("estado");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_inicio");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_fin");
    expect(j).toMatchObject({ pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });
});

// T-036b / H-05 reflection — patched schedule must reflect on next POST.
// Per spec/availability/spec.md "Creation outside patched interval rejected".
describe("POST /api/appointments — T-036b reflection (patched operatingHours)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(CLIENTE);
    createAppointmentMock.mockResolvedValue(turnoDTO);
  });

  it("getWorkshopConfig(db) called per request — passed through to createAppointment", async () => {
    setWorkshopConfigFallback();
    await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(getWorkshopConfigMock).toHaveBeenCalledTimes(1);
    expect(createAppointmentMock).toHaveBeenCalledTimes(1);
    const args = createAppointmentMock.mock.calls[0] as unknown as [
      { db: unknown; config: typeof workshopConfig },
      { vehicleId: string; serviceId: string; startDateTime: Date },
    ];
    // The route passes the resolved config from getWorkshopConfig — not the frozen fallback.
    // With the default mock returning workshopConfig, that's what flows through.
    expect(args[0].config).toEqual(workshopConfig);
  });

  it("patched narrow interval → start 11:00 + 60min → 400 VALIDATION_ERROR (outside interval)", async () => {
    // Patch Tuesday (dow=2) to 09:00-10:00 — request is for Tuesday 11:00 + 60min
    // ending at 12:00, which exceeds finIntervaloOperativo 10:00.
    const patchedHours = {
      1: [...DEFAULT_OPERATING_INTERVALS],
      2: [{ start: "09:00", end: "10:00" }],
      3: [...DEFAULT_OPERATING_INTERVALS],
      4: [...DEFAULT_OPERATING_INTERVALS],
      5: [...DEFAULT_OPERATING_INTERVALS],
      0: [],
      6: [],
    } as Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { start: string; end: string }[]>;
    getWorkshopConfigMock.mockResolvedValue({
      ...workshopConfig,
      operatingHours: patchedHours,
    });
    // Simulate createAppointment (the real path uses calculateEndAndValidate)
    // rejecting with the inclusive <= check failing for finIntervaloOperativo.
    createAppointmentMock.mockRejectedValue(
      new ValidationError(
        "fechaHoraFin 2026-09-08T14:00:00.000Z exceeds finIntervaloOperativo 2026-09-08T13:00:00.000Z",
      ),
    );

    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        // Tuesday 2026-09-08 at 11:00 BA = 14:00 UTC; duration 60 → end 15:00 UTC
        startDateTime: "2026-09-08T11:00:00-03:00",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/finIntervaloOperativo/);
    // createAppointment IS called (route must pass patched config) — service
    // throws ValidationError BEFORE countActiveOverlappingForUpdate (real impl),
    // which the route maps to 400. No FOR UPDATE happened inside the real impl.
    expect(createAppointmentMock).toHaveBeenCalledTimes(1);
    const args = createAppointmentMock.mock.calls[0] as unknown as [
      { config: { operatingHours: typeof patchedHours } },
      { startDateTime: Date },
    ];
    expect(args[0].config.operatingHours).toEqual(patchedHours);
    expect(args[1].startDateTime.toISOString()).toBe("2026-09-08T14:00:00.000Z");
  });

  it("patched interval fits → 201 — config flows through unchanged", async () => {
    const patchedHours = {
      1: [...DEFAULT_OPERATING_INTERVALS],
      2: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
      3: [...DEFAULT_OPERATING_INTERVALS],
      4: [...DEFAULT_OPERATING_INTERVALS],
      5: [...DEFAULT_OPERATING_INTERVALS],
      0: [],
      6: [],
    } as Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { start: string; end: string }[]>;
    getWorkshopConfigMock.mockResolvedValue({
      ...workshopConfig,
      operatingHours: patchedHours,
    });
    createAppointmentMock.mockResolvedValue(turnoDTO);
    const res = await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    expect(res.status).toBe(201);
    expect(createAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it("two consecutive POSTs re-call getWorkshopConfig (no global cache)", async () => {
    setWorkshopConfigFallback();
    await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T10:00:00-03:00",
      }),
    );
    await POST(
      makeRequest({
        vehicleId: VEHICLE_ID,
        serviceId: SERVICE_ID,
        startDateTime: "2026-09-10T11:00:00-03:00",
      }),
    );
    expect(getWorkshopConfigMock).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/appointments — T-036b reflection (per-request config)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(CLIENTE);
    listAppointmentsMock.mockResolvedValue({
      data: [turnoDTO],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("GET also calls getWorkshopConfig(db) per request — passed to listAppointments", async () => {
    setWorkshopConfigFallback();
    const r = await GET(new Request("http://localhost/api/appointments?status=PENDIENTE"));
    expect(r.status).toBe(200);
    expect(getWorkshopConfigMock).toHaveBeenCalledTimes(1);
    expect(listAppointmentsMock).toHaveBeenCalledTimes(1);
    const args = listAppointmentsMock.mock.calls[0] as unknown as [
      { db: unknown; config: typeof workshopConfig; now: Date },
      Record<string, unknown>,
      typeof CLIENTE,
    ];
    expect(args[0].config).toEqual(workshopConfig);
    expect(args[0].now).toBeInstanceOf(Date);
  });

  it("patched config flows through to listAppointments unchanged", async () => {
    const patchedHours = {
      1: [...DEFAULT_OPERATING_INTERVALS],
      2: [{ start: "10:00", end: "11:00" }],
      3: [...DEFAULT_OPERATING_INTERVALS],
      4: [...DEFAULT_OPERATING_INTERVALS],
      5: [...DEFAULT_OPERATING_INTERVALS],
      0: [],
      6: [],
    } as Record<0 | 1 | 2 | 3 | 4 | 5 | 6, { start: string; end: string }[]>;
    getWorkshopConfigMock.mockResolvedValue({
      ...workshopConfig,
      operatingHours: patchedHours,
    });
    const r = await GET(new Request("http://localhost/api/appointments?status=PENDIENTE"));
    expect(r.status).toBe(200);
    const args = listAppointmentsMock.mock.calls[0] as unknown as [
      { config: { operatingHours: typeof patchedHours } },
      Record<string, unknown>,
      typeof CLIENTE,
    ];
    expect(args[0].config.operatingHours).toEqual(patchedHours);
  });
});
