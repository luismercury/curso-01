import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/db", () => ({ db: {} }));

const cancelAppointmentMock = vi.fn();
vi.mock("@/services/appointmentService", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/appointmentService")
  >("@/services/appointmentService");
  return {
    ...actual,
    cancelAppointment: (...args: unknown[]) =>
      cancelAppointmentMock(...(args as never[])),
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
import { PATCH } from "@/app/api/appointments/[id]/cancel/route";

const ADMIN = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "admin@example.com",
  role: "ADMINISTRADOR" as const,
};
const CLIENTE_OWNER = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "owner@example.com",
  role: "CLIENTE" as const,
};
const CLIENTE_NON_OWNER = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "other@example.com",
  role: "CLIENTE" as const,
};

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440001";
const UNKNOWN_UUID = "660e8400-e29b-41d4-a716-446655440099";
const MALFORMED_UUID = "not-a-uuid";

const canceledDTOOwnerPending = {
  id: VALID_UUID,
  customerId: CLIENTE_OWNER.id,
  vehicleId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  startDateTime: new Date("2026-09-10T12:00:00.000Z"),
  endDateTime: new Date("2026-09-10T13:00:00.000Z"),
  status: "CANCELADO" as const,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-10T13:05:00.000Z"),
};

const canceledDTOAdminConfirmado = {
  id: VALID_UUID,
  customerId: CLIENTE_OWNER.id,
  vehicleId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  startDateTime: new Date("2026-09-10T12:00:00.000Z"),
  endDateTime: new Date("2026-09-10T13:00:00.000Z"),
  status: "CANCELADO" as const,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-10T13:05:00.000Z"),
};

function makePatchRequest(id: string): {
  req: Request;
  context: { params: Promise<{ id: string }> };
} {
  const req = new Request(`http://localhost/api/appointments/${id}/cancel`, {
    method: "PATCH",
  });
  const context = { params: Promise.resolve({ id }) };
  return { req, context };
}

describe("PATCH /api/appointments/[id]/cancel — thin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(CLIENTE_OWNER);
    cancelAppointmentMock.mockResolvedValue(canceledDTOOwnerPending);
  });

  it("401 UNAUTHORIZED when requireAuth rejects before service (valid UUID)", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it("401 takes precedence over 400 — unauthenticated with malformed UUID still 401", async () => {
    requireAuthMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const { req, context } = makePatchRequest(MALFORMED_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it("403 ownership-first — non-owner CLIENTE future PENDIENTE (even now>=start) before time guard", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE_NON_OWNER);
    cancelAppointmentMock.mockRejectedValue(new ForbiddenError("Not owner"));
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
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
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it("400 VALIDATION_ERROR on empty id", async () => {
    const { req, context } = makePatchRequest("");
    const res = await PATCH(req, context);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(cancelAppointmentMock).not.toHaveBeenCalled();
  });

  it("404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError", async () => {
    cancelAppointmentMock.mockRejectedValue(
      new AppointmentNotFoundError(UNKNOWN_UUID),
    );
    const { req, context } = makePatchRequest(UNKNOWN_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("APPOINTMENT_NOT_FOUND");
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["RECHAZADO", "Cannot transition RECHAZADO -> CANCELADO as CLIENTE"],
    ["CANCELADO", "Cannot transition CANCELADO -> CANCELADO as CLIENTE"],
  ])(
    "409 INVALID_APPOINTMENT_STATE when terminal %s (wrong state)",
    async (fromStatus, msg) => {
      cancelAppointmentMock.mockRejectedValue(
        new InvalidAppointmentStateError(msg),
      );
      const { req, context } = makePatchRequest(VALID_UUID);
      const res = await PATCH(req, context);
      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("INVALID_APPOINTMENT_STATE");
      expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
      void fromStatus;
    },
  );

  it("409 INVALID_APPOINTMENT_STATE when now == 09:00:00-03:00 (12:00Z) with message 'El turno ya comenzó'", async () => {
    cancelAppointmentMock.mockRejectedValue(
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
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it("409 INVALID_APPOINTMENT_STATE when now == 09:00:01-03:00 (12:00:01Z) with message 'El turno ya comenzó'", async () => {
    cancelAppointmentMock.mockRejectedValue(
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
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it("200 returns TurnoDTO camelCase with status CANCELADO on owner CLIENTE + PENDIENTE future (08:59 allow)", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE_OWNER);
    cancelAppointmentMock.mockResolvedValue(canceledDTOOwnerPending);
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof canceledDTOOwnerPending &
      Record<string, unknown>;
    expect(json.id).toBe(canceledDTOOwnerPending.id);
    expect(json.customerId).toBe(canceledDTOOwnerPending.customerId);
    expect(json.vehicleId).toBe(canceledDTOOwnerPending.vehicleId);
    expect(json.serviceId).toBe(canceledDTOOwnerPending.serviceId);
    expect(json.startDateTime).toBeDefined();
    expect(json.endDateTime).toBeDefined();
    expect(json.status).toBe("CANCELADO");
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

  it("200 ADMIN CONFIRMADO → CANCELADO any owner succeeds", async () => {
    requireAuthMock.mockResolvedValue(ADMIN);
    cancelAppointmentMock.mockResolvedValue(canceledDTOAdminConfirmado);
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof canceledDTOAdminConfirmado &
      Record<string, unknown>;
    expect(json.status).toBe("CANCELADO");
    expect(json.customerId).toBeDefined();
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
  });

  it("INV-08 no snake_case leak in 200 DTO", async () => {
    requireAuthMock.mockResolvedValue(CLIENTE_OWNER);
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

  it("passes DI config containing timezone, operatingHours and capacityPerSlot (INV-01/06) + DI spy", async () => {
    requireAuthMock.mockResolvedValue(ADMIN);
    cancelAppointmentMock.mockResolvedValue(canceledDTOAdminConfirmado);
    const { req, context } = makePatchRequest(VALID_UUID);
    const res = await PATCH(req, context);
    expect(res.status).toBe(200);
    expect(cancelAppointmentMock).toHaveBeenCalledTimes(1);
    const calledArgs = cancelAppointmentMock.mock.calls[0] as unknown as [
      { db: unknown; config: { timezone: string; capacityPerSlot: number; operatingHours: unknown } },
      string,
      typeof ADMIN,
    ];
    expect(calledArgs[0].config).toHaveProperty("timezone");
    expect(calledArgs[0].config).toHaveProperty("operatingHours");
    expect(calledArgs[0].config).toHaveProperty("capacityPerSlot");
    expect(typeof calledArgs[0].config.timezone).toBe("string");
    expect(typeof calledArgs[0].config.capacityPerSlot).toBe("number");
    expect(calledArgs[1]).toBe(VALID_UUID);
    expect(calledArgs[2]).toEqual(ADMIN);
  });
});
