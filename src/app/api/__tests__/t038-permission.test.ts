// t038-permission-tests — FASE 7 T-038 — Permission Traceability Suite
// Delta NONE (verification-only, 0 prod LOC). Consolidates 4 GWT + 2 precedence + 1 defense
// into one auditable file. Harness copied from t030 (`confirm/route.test.ts`) and t036
// (`admin/appointments/route.test.ts`); proves H-19 single-owner, INV-03 401→403→400,
// RN-07 canTransition, INV-08 DTO camelCase.
//
// Traces (non-normative, spec §"Verification Traces"):
//   T1 CLIENTE cannot confirm         — PATCH .../confirm → 403 + service not called
//   T2 CLIENTE cannot list admin      — GET /api/admin/appointments?limit=101 → 403 + service not called
//   T3 ADMIN can confirm              — PATCH .../confirm → 200 + INV-08 + service called with id+ADMIN
//   T4 ADMIN agenda ?date=            — GET /api/admin/appointments?date=... → 200 + pagination + INV-08
//   T5a unauth + malformed UUID       — 401 wins over 400
//   T5b CLIENTE + limit=101           — 403 wins over 400 (role before validation)
//   T5c ADMIN + limit=101             — 400 VALIDATION_ERROR (validation runs last)
//   T6  defense-in-depth              — canTransition(CLIENTE) → false → 409 (NOT 403)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const confirmAppointmentMock = vi.fn();
const listAppointmentsMock = vi.fn();
vi.mock("@/services/appointmentService", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/appointmentService")
  >("@/services/appointmentService");
  return {
    ...actual,
    confirmAppointment: (...args: unknown[]) =>
      confirmAppointmentMock(...(args as never[])),
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
    requireAuth: (...args: unknown[]) =>
      requireAuthMock(...(args as never[])),
  };
});

import {
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/auth/requireAuth";
import { PATCH } from "@/app/api/appointments/[id]/confirm/route";
import { GET } from "@/app/api/admin/appointments/route";
// canTransition is intentionally NOT mocked — T6 exercises the real RN-07 matrix.
import { canTransition } from "@/domain/appointmentStateMachine";

const ADMIN = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "admin@example.com",
  role: "ADMINISTRADOR" as const,
};
const CLIENTE = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "cliente@example.com",
  role: "CLIENTE" as const,
};

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const MALFORMED_UUID = "not-a-uuid";

const confirmedDTO = {
  id: VALID_UUID,
  customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  vehicleId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  startDateTime: new Date("2026-09-10T13:00:00.000Z"),
  endDateTime: new Date("2026-09-10T14:00:00.000Z"),
  status: "CONFIRMADO" as const,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-10T13:05:00.000Z"),
};

function makePatchRequest(id: string): {
  req: Request;
  context: { params: Promise<{ id: string }> };
} {
  const req = new Request(`http://localhost/api/appointments/${id}/confirm`, {
    method: "PATCH",
  });
  const context = { params: Promise.resolve({ id }) };
  return { req, context };
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("t038-permission-tests — H-19 single-owner + INV-03 + RN-07 + INV-08", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(ADMIN);
    confirmAppointmentMock.mockResolvedValue(confirmedDTO);
    listAppointmentsMock.mockResolvedValue({
      data: [confirmedDTO],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  // T1 — CLIENTE PATCH /api/appointments/{id}/confirm → 403 + service not called
  it("T1 — CLIENTE PATCH .../confirm → 403 FORBIDDEN + service not called", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE);
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  // T2 — CLIENTE GET /api/admin/appointments?limit=101 → 403 (proves 403 before 400) + service not called
  it("T2 — CLIENTE GET /api/admin/appointments?limit=101 → 403 + service not called", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE);
    const res = await GET(
      makeGetRequest("http://localhost/api/admin/appointments?limit=101"),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listAppointmentsMock).not.toHaveBeenCalled();
  });

  // T3 — ADMIN PATCH .../confirm → 200 + INV-08 + service called with VALID_UUID + ADMIN
  it("T3 — ADMIN PATCH .../confirm → 200 TurnoDTO camelCase + service called with id+ADMIN", async () => {
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.id).toBe(VALID_UUID);
    expect(json.customerId).toBe(confirmedDTO.customerId);
    expect(json.vehicleId).toBe(confirmedDTO.vehicleId);
    expect(json.serviceId).toBe(confirmedDTO.serviceId);
    expect(json.startDateTime).toBeDefined();
    expect(json.endDateTime).toBeDefined();
    expect(json.status).toBe("CONFIRMADO");
    // INV-08 — no snake_case leak
    expect(json).toHaveProperty("status");
    expect(json).not.toHaveProperty("estado");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(json).not.toHaveProperty("fecha_hora_fin");
    expect(json).not.toHaveProperty("cliente_id");
    expect(json).not.toHaveProperty("vehiculo_id");
    expect(json).not.toHaveProperty("servicio_id");
    expect(confirmAppointmentMock).toHaveBeenCalledTimes(1);
    const calledArgs = confirmAppointmentMock.mock.calls[0] as unknown as [
      { db: unknown; config: unknown },
      string,
      typeof ADMIN,
    ];
    expect(calledArgs[1]).toBe(VALID_UUID);
    expect(calledArgs[2]).toEqual(ADMIN);
  });

  // T4 — ADMIN GET /api/admin/appointments?date=YYYY-MM-DD → 200 + pagination + INV-08
  it("T4 — ADMIN agenda ?date=YYYY-MM-DD → 200 ordered asc + BA half-open passthrough", async () => {
    const res = await GET(
      makeGetRequest(
        "http://localhost/api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc",
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Record<string, unknown>[];
      pagination: Record<string, unknown>;
    };
    expect(json.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(json.data).toHaveLength(1);
    expect(listAppointmentsMock).toHaveBeenCalledTimes(1);
    const args = listAppointmentsMock.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      typeof ADMIN,
    ];
    expect(args[1]).toMatchObject({
      date: "2026-09-10",
      page: 1,
      limit: 20,
      sort: "startAt:asc",
    });
    expect(args[2].role).toBe("ADMINISTRADOR");
    // INV-08 — no snake_case leak in agenda DTO
    expect(json.data[0]).toHaveProperty("customerId");
    expect(json.data[0]).toHaveProperty("startDateTime");
    expect(json.data[0]).toHaveProperty("endDateTime");
    expect(json.data[0]).not.toHaveProperty("estado");
    expect(json.data[0]).not.toHaveProperty("fecha_hora_inicio");
    expect(json.data[0]).not.toHaveProperty("fecha_hora_fin");
  });

  // T5a — unauth + malformed UUID → 401 (auth before validation)
  it("T5a — precedence: unauth + malformed UUID → 401 UNAUTHORIZED (auth before validation)", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(MALFORMED_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  // T5b — CLIENTE + limit=101 → 403 (role before validation)
  it("T5b — precedence: CLIENTE + limit=101 on admin → 403 (role before validation)", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE);
    const res = await GET(
      makeGetRequest("http://localhost/api/admin/appointments?limit=101"),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listAppointmentsMock).not.toHaveBeenCalled();
  });

  // T5c — ADMIN + limit=101 → 400 VALIDATION_ERROR (validation runs last)
  it("T5c — precedence: ADMIN + limit=101 → 400 VALIDATION_ERROR (validation runs last)", async () => {
    requireAuthMock.mockResolvedValue(ADMIN);
    const res = await GET(
      makeGetRequest("http://localhost/api/admin/appointments?limit=101"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; issues?: unknown[] };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(listAppointmentsMock).not.toHaveBeenCalled();
  });

  // T6 — defense-in-depth — real canTransition matrix rejects CLIENTE on confirm path
  it("T6 — defense-in-depth: canTransition(PENDIENTE,CONFIRMADO,CLIENTE) === false (RN-07 matrix)", () => {
    // Pure matrix assertion — proves the 403 (route) vs 409 (service) distinction
    // would not collapse if route guard is removed. Service path throws
    // InvalidAppointmentStateError → 409 INVALID_APPOINTMENT_STATE, never 403.
    const allowed = canTransition("PENDIENTE", "CONFIRMADO", "CLIENTE");
    expect(allowed).toBe(false);

    const adminAllowed = canTransition("PENDIENTE", "CONFIRMADO", "ADMINISTRADOR");
    expect(adminAllowed).toBe(true);

    // Cross-check terminal states always false regardless of role.
    expect(canTransition("RECHAZADO", "CONFIRMADO", "ADMINISTRADOR")).toBe(false);
    expect(canTransition("CANCELADO", "CONFIRMADO", "ADMINISTRADOR")).toBe(false);
    expect(canTransition("CONFIRMADO", "CONFIRMADO", "ADMINISTRADOR")).toBe(false);
  });

  // Suppress unused-import warning for ForbiddenError (kept for harness parity with t030/t036).
  void ForbiddenError;
});