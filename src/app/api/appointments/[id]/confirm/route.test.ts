import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const confirmAppointmentMock = vi.fn();
vi.mock("@/services/appointmentService", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/appointmentService")
  >("@/services/appointmentService");
  return {
    ...actual,
    confirmAppointment: (...args: unknown[]) =>
      confirmAppointmentMock(...(args as never[])),
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
import {
  AppointmentNotFoundError,
  InvalidAppointmentStateError,
} from "@/services/errors";
import { PATCH } from "@/app/api/appointments/[id]/confirm/route";

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

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440001";
const UNKNOWN_UUID = "660e8400-e29b-41d4-a716-446655440099";
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

describe("PATCH /api/appointments/[id]/confirm — thin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(ADMIN);
    confirmAppointmentMock.mockResolvedValue(confirmedDTO);
  });

  it("401 UNAUTHORIZED when requireAuth rejects before UUID validation", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  it("401 takes precedence over 400 — unauthenticated with malformed UUID still 401", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(MALFORMED_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  it("403 FORBIDDEN when CLIENTE role via assertRole and service not called", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE);
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on malformed UUID with issues", async () => {
    const { req, context } = makePatchRequest(MALFORMED_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; issues?: unknown[] };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on empty id", async () => {
    const { req, context } = makePatchRequest("");
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(confirmAppointmentMock).not.toHaveBeenCalled();
  });

  it("404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError", async () => {
    confirmAppointmentMock.mockRejectedValue(
      new AppointmentNotFoundError(UNKNOWN_UUID),
    );
    const { req, context } = makePatchRequest(UNKNOWN_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("APPOINTMENT_NOT_FOUND");
    expect(confirmAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CONFIRMADO", "Cannot transition CONFIRMADO -> CONFIRMADO as ADMINISTRADOR"],
    ["RECHAZADO", "Cannot transition RECHAZADO -> CONFIRMADO as ADMINISTRADOR"],
    ["CANCELADO", "Cannot transition CANCELADO -> CONFIRMADO as ADMINISTRADOR"],
  ])(
    "409 INVALID_APPOINTMENT_STATE when already %s (wrong state)",
    async (fromStatus, msg) => {
      confirmAppointmentMock.mockRejectedValue(
        new InvalidAppointmentStateError(msg),
      );
      const { req, context } = makePatchRequest(VALID_UUID);
      const res = await PATCH(req, context);
      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("INVALID_APPOINTMENT_STATE");
      expect(confirmAppointmentMock).toHaveBeenCalledTimes(1);
      void fromStatus;
    },
  );

  it("409 INVALID_APPOINTMENT_STATE when now >= startDateTime with message 'El turno ya comenzó'", async () => {
    confirmAppointmentMock.mockRejectedValue(
      new InvalidAppointmentStateError("El turno ya comenzó"),
    );
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("INVALID_APPOINTMENT_STATE");
    expect(body.error.message).toBe("El turno ya comenzó");
    expect(confirmAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it("200 returns TurnoDTO camelCase with status CONFIRMADO on ADMIN + PENDIENTE future", async () => {
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof confirmedDTO &
      Record<string, unknown>;
    expect(json.id).toBe(confirmedDTO.id);
    expect(json.customerId).toBe(confirmedDTO.customerId);
    expect(json.vehicleId).toBe(confirmedDTO.vehicleId);
    expect(json.serviceId).toBe(confirmedDTO.serviceId);
    expect(json.startDateTime).toBeDefined();
    expect(json.endDateTime).toBeDefined();
    expect(json.status).toBe("CONFIRMADO");
    expect(json).toHaveProperty("customerId");
    expect(json).toHaveProperty("vehicleId");
    expect(json).toHaveProperty("serviceId");
    expect(json).toHaveProperty("startDateTime");
    expect(json).toHaveProperty("endDateTime");
    expect(json).toHaveProperty("status");
    expect(json).not.toHaveProperty("cliente_id");
    expect(json).not.toHaveProperty("vehiculo_id");
    expect(json).not.toHaveProperty("servicio_id");
    expect(json).not.toHaveProperty("estado");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(json).not.toHaveProperty("fecha_hora_fin");
  });

  it("INV-08 no snake_case leak in 200 DTO", async () => {
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).not.toHaveProperty("estado");
    expect(json).not.toHaveProperty("fecha_hora_inicio");
    expect(json).not.toHaveProperty("fecha_hora_fin");
    expect(json).not.toHaveProperty("cliente_id");
    expect(json).not.toHaveProperty("vehiculo_id");
    expect(json).not.toHaveProperty("servicio_id");
    expect(json).toHaveProperty("status");
  });

  it("passes DI config containing timezone and capacityPerSlot (INV-01/06)", async () => {
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    expect(confirmAppointmentMock).toHaveBeenCalledTimes(1);
    const calledArgs = confirmAppointmentMock.mock.calls[0] as unknown as [
      { db: unknown; config: { timezone: string; capacityPerSlot: number; operatingHours: unknown } },
      string,
      typeof ADMIN,
    ];
    expect(calledArgs[0].config).toHaveProperty("timezone");
    expect(calledArgs[0].config).toHaveProperty("capacityPerSlot");
    expect(typeof calledArgs[0].config.timezone).toBe("string");
    expect(typeof calledArgs[0].config.capacityPerSlot).toBe("number");
    expect(calledArgs[1]).toBe(VALID_UUID);
    expect(calledArgs[2]).toEqual(ADMIN);
  });
});
