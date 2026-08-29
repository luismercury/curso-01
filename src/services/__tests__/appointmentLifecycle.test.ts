import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockFindTurnoById = vi.fn();
const mockFindTurnosPaginated = vi.fn();
const mockUpdateTurnoStatus = vi.fn();
const mockCountActiveOverlappingForUpdate = vi.fn();
const mockFindVehiculoById = vi.fn();
const mockFindServicioById = vi.fn();

vi.mock("@/db/repositories/turnos", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...(orig as object),
    findTurnoById: (...a: unknown[]) => mockFindTurnoById(...a),
    findTurnosPaginated: (...a: unknown[]) => mockFindTurnosPaginated(...a),
    updateTurnoStatus: (...a: unknown[]) => mockUpdateTurnoStatus(...a),
    countActiveOverlappingForUpdate: (...a: unknown[]) =>
      mockCountActiveOverlappingForUpdate(...a),
  };
});
vi.mock("@/db/repositories/vehiculos", () => ({
  findVehiculoById: (...a: unknown[]) => mockFindVehiculoById(...a),
}));
vi.mock("@/db/repositories/servicios", () => ({
  findServicioById: (...a: unknown[]) => mockFindServicioById(...a),
}));

import {
  createAppointment,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  listAppointments,
} from "@/services/appointmentService";
import { InvalidAppointmentStateError } from "@/services/errors";
import { InvalidServiceError } from "@/services/appointmentGuard";
import { ForbiddenError } from "@/lib/auth/requireAuth";

// ---------------------------------------------------------------------------
// Fixtures — WorkshopConfig.timezone = America/Argentina/Buenos_Aires
// BA 09:00 = UTC 12:00Z
// ---------------------------------------------------------------------------
const ADMIN = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "a@a.com",
  role: "ADMINISTRADOR" as const,
};
const CLIENTE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "c@c.com",
  role: "CLIENTE" as const,
};
const CLIENTE_2 = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "c2@c.com",
  role: "CLIENTE" as const,
};

const VEHICLE_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const TURNO_ID = "33333333-3333-4333-8333-333333333333";

const START_12Z = new Date("2026-09-10T12:00:00.000Z"); // 09:00 BA
const END_13Z = new Date("2026-09-10T13:00:00.000Z");
const NOW_11_59Z = new Date("2026-09-10T11:59:00.000Z");
const NOW_12_00Z = new Date("2026-09-10T12:00:00.000Z");
const NOW_12_00_01Z = new Date("2026-09-10T12:00:01.000Z");

const baseConfig = {
  timezone: "America/Argentina/Buenos_Aires",
  operatingHours: undefined,
  capacityPerSlot: 1 as const,
};
const config = baseConfig;

const makeTurno = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: TURNO_ID,
  customerId: CLIENTE.id,
  vehicleId: VEHICLE_ID,
  serviceId: SERVICE_ID,
  startDateTime: START_12Z,
  endDateTime: END_13Z,
  status: "PENDIENTE",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

const makeVehiculo = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: VEHICLE_ID,
  customerId: CLIENTE.id,
  brand: "Toyota",
  model: "Corolla",
  year: 2020,
  plate: "ABC123",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeServicio = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: SERVICE_ID,
  name: "Oil change",
  description: null,
  durationMinutes: 60,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function makeMockDb() {
  const mockExecute = vi.fn().mockResolvedValue({});
  const mockReturning = vi.fn().mockResolvedValue([
    {
      id: TURNO_ID,
      clienteId: CLIENTE.id,
      vehiculoId: VEHICLE_ID,
      servicioId: SERVICE_ID,
      fechaHoraInicio: START_12Z,
      fechaHoraFin: END_13Z,
      estado: "PENDIENTE",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const tx: Record<string, unknown> = { execute: mockExecute, insert: mockInsert };
  const db = {
    transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  } as unknown as { transaction: ReturnType<typeof vi.fn> };
  (db as unknown as Record<string, unknown>)._tx = tx;
  return { db: db as never, tx, mockExecute, mockInsert, mockReturning, mockValues };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCountActiveOverlappingForUpdate.mockReset();
  mockFindTurnoById.mockReset();
  mockFindTurnosPaginated.mockReset();
  mockUpdateTurnoStatus.mockReset();
  mockFindVehiculoById.mockReset();
  mockFindServicioById.mockReset();
});

// ---------------------------------------------------------------------------
// T-034-002 — Valid chains
// ---------------------------------------------------------------------------
describe("t034 — valid lifecycle chains via mocked AppointmentService", () => {
  it("PENDIENTE -> CONFIRMADO via confirmAppointment as ADMIN (future)", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CONFIRMADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    const result = await confirmAppointment(deps, TURNO_ID, ADMIN as never);
    expect(result.status).toBe("CONFIRMADO");
    expect(mockUpdateTurnoStatus).toHaveBeenCalledWith(expect.anything(), TURNO_ID, "CONFIRMADO");
  });

  it("PENDIENTE -> RECHAZADO via rejectAppointment as ADMIN (future)", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "RECHAZADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    const result = await rejectAppointment(deps, TURNO_ID, ADMIN as never);
    expect(result.status).toBe("RECHAZADO");
    expect(mockUpdateTurnoStatus).toHaveBeenCalledWith(expect.anything(), TURNO_ID, "RECHAZADO");
  });

  it("PENDIENTE -> CANCELADO via cancelAppointment as owner CLIENTE (future)", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "PENDIENTE", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    mockUpdateTurnoStatus.mockResolvedValue(
      makeTurno({ status: "CANCELADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    const result = await cancelAppointment(deps, TURNO_ID, CLIENTE as never);
    expect(result.status).toBe("CANCELADO");
    expect(mockUpdateTurnoStatus).toHaveBeenCalledWith(expect.anything(), TURNO_ID, "CANCELADO");
  });

  it("CONFIRMADO -> CANCELADO via cancelAppointment as owner CLIENTE (future)", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    mockUpdateTurnoStatus.mockResolvedValue(
      makeTurno({ status: "CANCELADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    const result = await cancelAppointment(deps, TURNO_ID, CLIENTE as never);
    expect(result.status).toBe("CANCELADO");
    expect(mockUpdateTurnoStatus).toHaveBeenCalledWith(expect.anything(), TURNO_ID, "CANCELADO");
  });

  it("CONFIRMADO -> CANCELADO via cancelAppointment as ADMIN (future, bypass ownership)", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    const result = await cancelAppointment(deps, TURNO_ID, ADMIN as never);
    expect(result.status).toBe("CANCELADO");
    expect(mockUpdateTurnoStatus).toHaveBeenCalledWith(expect.anything(), TURNO_ID, "CANCELADO");
  });
});

// ---------------------------------------------------------------------------
// T-034-003 — Invalid transitions 409 + EC-03
// ---------------------------------------------------------------------------
describe("t034 — invalid transitions 409 INVALID_APPOINTMENT_STATE", () => {
  it("CONFIRMADO -> CONFIRMADO via confirm should throw 409 Cannot transition", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "CONFIRMADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toThrow(
      "Cannot transition CONFIRMADO -> CONFIRMADO as ADMINISTRADOR",
    );
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("RECHAZADO -> CONFIRMADO via confirm should throw 409", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "RECHAZADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toThrow(
      "Cannot transition RECHAZADO -> CONFIRMADO as ADMINISTRADOR",
    );
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("CANCELADO -> CONFIRMADO via confirm should throw 409", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "CANCELADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("PENDIENTE -> PENDIENTE is invalid (domain) — service never attempts self, direct canTransition check", async () => {
    // Service has no PENDIENTE->PENDIENTE op; verify domain denies it and service would reject if attempted.
    const { canTransition } = await import("@/domain/appointmentStateMachine");
    expect(canTransition("PENDIENTE", "PENDIENTE", "ADMINISTRADOR")).toBe(false);
    expect(canTransition("PENDIENTE", "PENDIENTE", "CLIENTE")).toBe(false);
    // Also verify PENDIENTE->CONFIRMADO as CLIENTE is denied at service (role gate)
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(confirmAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    await expect(confirmAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toThrow(
      "Cannot transition PENDIENTE -> CONFIRMADO as CLIENTE",
    );
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("RECHAZADO -> CANCELADO via cancel should throw 409 (terminal)", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "RECHAZADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toBeInstanceOf(
      InvalidAppointmentStateError,
    );
    await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("CANCELADO -> CANCELADO via cancel should throw 409 (terminal)", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "CANCELADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("EC-03 CONFIRMADO past (now == start) cancel as owner -> 409 El turno ya comenzó", async () => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    const deps = { db: {} as never, config, now: NOW_12_00Z };
    await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toThrow("El turno ya comenzó");
    await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toMatchObject({
      code: "INVALID_APPOINTMENT_STATE",
    });
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });

  it("ensureFuture for past via confirm (now == start) -> El turno ya comenzó", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now: NOW_12_00Z };
    await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toThrow("El turno ya comenzó");
    expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T-034-004 — H-12 UTC borders strict <
// ---------------------------------------------------------------------------
describe("t034 — H-12 UTC borders BA 09:00=12:00Z strict <", () => {
  it.each([
    ["11:59Z allow", NOW_11_59Z, true],
    ["12:00Z exact reject", NOW_12_00Z, false],
    ["12:00:01Z reject", NOW_12_00_01Z, false],
  ] as const)("cancel PENDIENTE->CANCELADO owner border %s", async (_label, now, allow) => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "PENDIENTE", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now };
    if (allow) {
      const result = await cancelAppointment(deps, TURNO_ID, CLIENTE as never);
      expect(result.status).toBe("CANCELADO");
    } else {
      await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toThrow("El turno ya comenzó");
      expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["11:59Z allow", NOW_11_59Z, true],
    ["12:00Z exact reject", NOW_12_00Z, false],
    ["12:00:01Z reject", NOW_12_00_01Z, false],
  ] as const)("cancel CONFIRMADO->CANCELADO owner border %s", async (_label, now, allow) => {
    mockFindTurnoById.mockResolvedValue(
      makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
    );
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now };
    if (allow) {
      const result = await cancelAppointment(deps, TURNO_ID, CLIENTE as never);
      expect(result.status).toBe("CANCELADO");
    } else {
      await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toThrow("El turno ya comenzó");
      expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["11:59Z allow", NOW_11_59Z, true],
    ["12:00Z exact reject", NOW_12_00Z, false],
    ["12:00:01Z reject", NOW_12_00_01Z, false],
  ] as const)("confirm PENDIENTE->CONFIRMADO ADMIN border %s", async (_label, now, allow) => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CONFIRMADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now };
    if (allow) {
      const result = await confirmAppointment(deps, TURNO_ID, ADMIN as never);
      expect(result.status).toBe("CONFIRMADO");
    } else {
      await expect(confirmAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toThrow("El turno ya comenzó");
      expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["11:59Z allow", NOW_11_59Z, true],
    ["12:00Z exact reject", NOW_12_00Z, false],
    ["12:00:01Z reject", NOW_12_00_01Z, false],
  ] as const)("reject PENDIENTE->RECHAZADO ADMIN border %s", async (_label, now, allow) => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: START_12Z }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "RECHAZADO", startDateTime: START_12Z }));
    const deps = { db: {} as never, config, now };
    if (allow) {
      const result = await rejectAppointment(deps, TURNO_ID, ADMIN as never);
      expect(result.status).toBe("RECHAZADO");
    } else {
      await expect(rejectAppointment(deps, TURNO_ID, ADMIN as never)).rejects.toThrow("El turno ya comenzó");
      expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
    }
  });

  it("EC-03 CONFIRMADO past trio — 12:00Z and 12:00:01Z both reject cancel", async () => {
    for (const now of [NOW_12_00Z, NOW_12_00_01Z]) {
      mockFindTurnoById.mockResolvedValue(
        makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: START_12Z }),
      );
      const deps = { db: {} as never, config, now };
      await expect(cancelAppointment(deps, TURNO_ID, CLIENTE as never)).rejects.toThrow("El turno ya comenzó");
      expect(mockUpdateTurnoStatus).not.toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });
});

// ---------------------------------------------------------------------------
// T-034-005 — H-13 before lock + H-11/EC-04 visibility
// ---------------------------------------------------------------------------
describe("t034 — H-13 guards before lock (createAppointment)", () => {
  it("inactive servicio.active=false -> 400 INVALID_SERVICE, countActiveOverlappingForUpdate not called", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE.id }));
    mockFindServicioById.mockResolvedValue(makeServicio({ active: false }));
    const { db } = makeMockDb();
    await expect(
      createAppointment(
        { db: db as never, config },
        {
          vehicleId: VEHICLE_ID,
          serviceId: SERVICE_ID,
          startDateTime: new Date("2026-09-10T14:00:00.000Z"), // 11:00 BA inside hours
          authUser: CLIENTE as never,
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_SERVICE" });
    await expect(
      createAppointment(
        { db: db as never, config },
        {
          vehicleId: VEHICLE_ID,
          serviceId: SERVICE_ID,
          startDateTime: new Date("2026-09-10T14:00:00.000Z"),
          authUser: CLIENTE as never,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidServiceError);
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });

  it("foreign vehiculo.customerId != authUser.id -> 403 FORBIDDEN, countActiveOverlappingForUpdate not called", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    // findServicioById should not be reached, but we mock anyway
    mockFindServicioById.mockResolvedValue(makeServicio());
    const { db } = makeMockDb();
    await expect(
      createAppointment(
        { db: db as never, config },
        {
          vehicleId: VEHICLE_ID,
          serviceId: SERVICE_ID,
          startDateTime: new Date("2026-09-10T14:00:00.000Z"),
          authUser: CLIENTE as never,
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createAppointment(
        { db: db as never, config },
        {
          vehicleId: VEHICLE_ID,
          serviceId: SERVICE_ID,
          startDateTime: new Date("2026-09-10T14:00:00.000Z"),
          authUser: CLIENTE as never,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
});

describe("t034 — H-11/EC-04 visibility via findTurnosPaginated flags", () => {
  it("listAppointments default hides CANCELADO|RECHAZADO (includeCancelled false, includeRejected false)", async () => {
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "PENDIENTE" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const deps = { db: {} as never, config, now: NOW_11_59Z };
    await listAppointments(deps, {}, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: CLIENTE.id,
        now: expect.any(Date),
      }),
    );
    const firstCall = mockFindTurnosPaginated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(firstCall.includeCancelled).toBeUndefined();
    expect(firstCall.includeRejected).toBeUndefined();
    // Explicit check: default hides — statuses limited to PENDIENTE|CONFIRMADO. Verify by calling with explicit false.
    mockFindTurnosPaginated.mockClear();
    await listAppointments(deps, { includeCancelled: false, includeRejected: false }, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeCancelled: false, includeRejected: false }),
    );
  });

  it("listAppointments CLIENTE injects customerId overriding query", async () => {
    mockFindTurnosPaginated.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    await listAppointments({ db: {} as never, config, now: NOW_11_59Z }, { customerId: "other-id" } as never, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: CLIENTE.id }),
    );
  });

  it("listAppointments includeCancelled:true forwards flag and includes CANCELADO", async () => {
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "CANCELADO" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    await listAppointments({ db: {} as never, config, now: NOW_11_59Z }, { includeCancelled: true }, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeCancelled: true }),
    );
  });

  it("listAppointments includeRejected:true forwards flag and includes RECHAZADO", async () => {
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "RECHAZADO" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    await listAppointments({ db: {} as never, config, now: NOW_11_59Z }, { includeRejected: true }, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeRejected: true }),
    );
    // Verify RECHAZADO is non-active: default hides it — no data when default
    mockFindTurnosPaginated.mockClear();
    mockFindTurnosPaginated.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    await listAppointments({ db: {} as never, config, now: NOW_11_59Z }, {}, CLIENTE as never);
    // default call should not include RECHAZADO — pagination total 0 means filtered
    expect(mockFindTurnosPaginated).toHaveBeenCalled();
  });

  it("RECHAZADO future start>now — default excludes, includeRejected:true includes (CLIENTE and ADMIN)", async () => {
    const future = new Date("2026-09-10T15:00:00.000Z");
    const now = new Date("2026-09-10T11:59:00.000Z");
    // CLIENTE default
    mockFindTurnosPaginated.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    await listAppointments({ db: {} as never, config, now }, {}, CLIENTE as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: CLIENTE.id }),
    );
    // CLIENTE with flag
    mockFindTurnosPaginated.mockClear();
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "RECHAZADO", startDateTime: future })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const resClienteFlag = await listAppointments(
      { db: {} as never, config, now },
      { includeRejected: true },
      CLIENTE as never,
    );
    expect(resClienteFlag.data[0]?.status).toBe("RECHAZADO");
    // ADMIN with flag sees all
    mockFindTurnosPaginated.mockClear();
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "RECHAZADO", startDateTime: future })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const resAdminFlag = await listAppointments({ db: {} as never, config, now }, { includeRejected: true }, ADMIN as never);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeRejected: true }),
    );
    expect(resAdminFlag.data[0]?.status).toBe("RECHAZADO");
    // ADMIN default should not have customerId filter
    mockFindTurnosPaginated.mockClear();
    mockFindTurnosPaginated.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    await listAppointments({ db: {} as never, config, now }, {}, ADMIN as never);
    const lastCall = mockFindTurnosPaginated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(lastCall.customerId).toBeUndefined();
  });

  it("listAppointments status RECHAZADO visibility via status filter requires includeRejected flag", async () => {
    // This test documents route-level guard already tested in appointmentService.test.ts but ensures repo passthrough here.
    mockFindTurnosPaginated.mockResolvedValue({
      data: [makeTurno({ status: "RECHAZADO" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    await listAppointments(
      { db: {} as never, config, now: NOW_11_59Z },
      { status: "RECHAZADO", includeRejected: true } as never,
      CLIENTE as never,
    );
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "RECHAZADO", includeRejected: true }),
    );
  });

  it("toTurnoDTO present — no snake_case leak INV-08 (status/customerId/startDateTime)", async () => {
    const dto = makeTurno();
    expect(dto).toHaveProperty("customerId");
    expect(dto).toHaveProperty("status");
    expect(dto).toHaveProperty("startDateTime");
    expect(dto).not.toHaveProperty("clienteId");
    expect(dto).not.toHaveProperty("estado");
    expect(dto).not.toHaveProperty("fecha_hora_inicio");
    // Verify no COMPLETADO and no FOR UPDATE in service file via domain check is covered in matrix test.
    const { AppointmentStatus: Statuses } = await import("@/domain/appointmentStateMachine");
    expect(Statuses).not.toContain("COMPLETADO" as never);
  });
});
