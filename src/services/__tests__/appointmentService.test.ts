import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mockFindTurnoById = vi.fn(), mockFindTurnosPaginated = vi.fn(), mockUpdateTurnoStatus = vi.fn(), mockCreateTurno = vi.fn();
vi.mock("@/db/repositories/turnos", () => ({
  findTurnoById: (...a: unknown[]) => mockFindTurnoById(...a),
  findTurnosPaginated: (...a: unknown[]) => mockFindTurnosPaginated(...a),
  updateTurnoStatus: (...a: unknown[]) => mockUpdateTurnoStatus(...a),
  createTurno: (...a: unknown[]) => mockCreateTurno(...a),
}));
const mockFindVehiculoById = vi.fn();
vi.mock("@/db/repositories/vehiculos", () => ({ findVehiculoById: (...a: unknown[]) => mockFindVehiculoById(...a) }));
const mockFindServicioById = vi.fn();
vi.mock("@/db/repositories/servicios", () => ({ findServicioById: (...a: unknown[]) => mockFindServicioById(...a) }));
import { createAppointment, confirmAppointment, rejectAppointment, cancelAppointment, getAppointmentById, listAppointments } from "@/services/appointmentService";
import { ForbiddenError } from "@/lib/auth/requireAuth";
import { ValidationError } from "@/config/workshopSchedule";
import { AppointmentNotFoundError, InvalidAppointmentStateError } from "@/services/errors";
import { InvalidServiceError } from "@/services/appointmentGuard";
const ADMIN = { id: "admin-1", email: "a@a.com", role: "ADMINISTRADOR" as const };
const CLIENTE = { id: "cliente-1", email: "c@c.com", role: "CLIENTE" as const };
const CLIENTE_2 = { id: "cliente-2", email: "c2@c.com", role: "CLIENTE" as const };
const VEHICLE_ID = "11111111-1111-4111-8111-111111111111", SERVICE_ID = "22222222-2222-4222-8222-222222222222", TURNO_ID = "33333333-3333-4333-8333-333333333333";
const config = { timezone: "America/Argentina/Buenos_Aires", operatingHours: undefined };
const makeTurno = (o: Partial<Record<string, unknown>> = {}) => ({ id: TURNO_ID, customerId: CLIENTE.id, vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T12:00:00.000Z"), endDateTime: new Date("2026-09-10T13:00:00.000Z"), status: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"), ...o });
const makeVehiculo = (o: Partial<Record<string, unknown>> = {}) => ({ id: VEHICLE_ID, customerId: CLIENTE.id, brand: "Toyota", model: "Corolla", year: 2020, plate: "ABC123", createdAt: new Date(), updatedAt: new Date(), ...o });
const makeServicio = (o: Partial<Record<string, unknown>> = {}) => ({ id: SERVICE_ID, name: "Oil", description: null, durationMinutes: 60, active: true, createdAt: new Date(), updatedAt: new Date(), ...o });
beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("createAppointment R2", () => {
  it("rejects inactive → INVALID_SERVICE", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ active: false }));
    await expect(createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "INVALID_SERVICE" });
    expect(mockCreateTurno).not.toHaveBeenCalled();
  });
  it("rejects foreign → FORBIDDEN", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    mockFindServicioById.mockResolvedValue(makeServicio());
    await expect(createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("ADMIN bypasses foreign", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCreateTurno.mockResolvedValue(makeTurno({ customerId: CLIENTE_2.id }));
    const dto = await createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: ADMIN });
    expect(dto.customerId).toBe(CLIENTE_2.id);
  });
  it("rejects close-crossing 11:30+90>12:00 → VALIDATION_ERROR", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 90 }));
    const start = new Date("2026-09-10T14:30:00.000Z");
    await expect(createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: start, authUser: CLIENTE })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("allows inclusive 11:00+60==12:00", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 60 }));
    const start = new Date("2026-09-10T14:00:00.000Z");
    mockCreateTurno.mockResolvedValue(makeTurno({ startDateTime: start }));
    const dto = await createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: start, authUser: CLIENTE });
    expect(dto.startDateTime).toEqual(start);
  });
  it("skeleton does not throw APPOINTMENT_NOT_AVAILABLE", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCreateTurno.mockResolvedValue(makeTurno());
    await expect(createAppointment({ db: {} as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).resolves.toBeDefined();
  });
});

describe("confirm/reject R1", () => {
  it.each([
    ["confirm ADMIN allowed", "CONFIRMADO", ADMIN, true],
    ["confirm CLIENTE denied", "CONFIRMADO", CLIENTE, false],
    ["reject ADMIN allowed", "RECHAZADO", ADMIN, true],
    ["reject CLIENTE denied", "RECHAZADO", CLIENTE, false],
  ] as const)("%s", async (_l, target, authUser, ok) => {
    const future = new Date("2026-09-10T12:00:00.000Z"), now = new Date("2026-09-10T11:00:00.000Z");
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: future }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: target, startDateTime: future }));
    const fn = target === "CONFIRMADO" ? confirmAppointment : rejectAppointment;
    if (ok) expect((await fn({ db: {} as never, config, now }, TURNO_ID, authUser as never)).status).toBe(target);
    else await expect(fn({ db: {} as never, config, now }, TURNO_ID, authUser as never)).rejects.toMatchObject({ code: "INVALID_APPOINTMENT_STATE" });
  });
  it("confirm fails when now>=start → El turno ya comenzó", async () => {
    const start = new Date("2026-09-10T12:00:00.000Z");
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: start }));
    await expect(confirmAppointment({ db: {} as never, config, now: start }, TURNO_ID, ADMIN)).rejects.toThrow("El turno ya comenzó");
  });
  it("unknown id → 404", async () => {
    mockFindTurnoById.mockResolvedValue(null);
    await expect(confirmAppointment({ db: {} as never, config, now: new Date("2026-09-09T00:00:00.000Z") }, TURNO_ID, ADMIN)).rejects.toMatchObject({ code: "APPOINTMENT_NOT_FOUND" });
  });
});

describe("cancel R4 borders + ownership-first", () => {
  const start = new Date("2026-09-10T12:00:00.000Z");
  it.each([["08:59 allow", "2026-09-10T11:59:00.000Z", true], ["09:00:00 reject", "2026-09-10T12:00:00.000Z", false], ["09:00:01 reject", "2026-09-10T12:00:01.000Z", false]] as const)("border %s", async (_l, nowIso, allow) => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", startDateTime: start }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO", startDateTime: start }));
    const deps = { db: {} as never, config, now: new Date(nowIso) };
    if (allow) expect((await cancelAppointment(deps, TURNO_ID, CLIENTE)).status).toBe("CANCELADO");
    else await expect(cancelAppointment(deps, TURNO_ID, CLIENTE)).rejects.toThrow("El turno ya comenzó");
  });
  it("non-owner → FORBIDDEN before time guard", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "PENDIENTE", customerId: CLIENTE.id, startDateTime: start }));
    await expect(cancelAppointment({ db: {} as never, config, now: new Date("2026-09-10T13:00:00.000Z") }, TURNO_ID, CLIENTE_2)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("owner and ADMIN allowed CONFIRMADO→CANCELADO future", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: new Date("2026-09-10T15:00:00.000Z") }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO" }));
    await expect(cancelAppointment({ db: {} as never, config, now: new Date("2026-09-10T11:00:00.000Z") }, TURNO_ID, CLIENTE)).resolves.toBeDefined();
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "CONFIRMADO", customerId: CLIENTE.id, startDateTime: new Date("2026-09-10T15:00:00.000Z") }));
    mockUpdateTurnoStatus.mockResolvedValue(makeTurno({ status: "CANCELADO" }));
    await expect(cancelAppointment({ db: {} as never, config, now: new Date("2026-09-10T11:00:00.000Z") }, TURNO_ID, ADMIN)).resolves.toBeDefined();
  });
  it("terminal → INVALID_APPOINTMENT_STATE", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ status: "RECHAZADO", startDateTime: new Date("2026-09-10T15:00:00.000Z") }));
    await expect(cancelAppointment({ db: {} as never, config, now: new Date("2026-09-10T11:00:00.000Z") }, TURNO_ID, CLIENTE)).rejects.toBeInstanceOf(InvalidAppointmentStateError);
  });
});

describe("getById/list R3+R5", () => {
  it("getById owner allowed, non-owner FORBIDDEN, ADMIN bypass", async () => {
    mockFindTurnoById.mockResolvedValue(makeTurno({ customerId: CLIENTE.id }));
    await expect(getAppointmentById({ db: {} as never, config }, TURNO_ID, CLIENTE)).resolves.toBeDefined();
    mockFindTurnoById.mockResolvedValue(makeTurno({ customerId: CLIENTE.id }));
    await expect(getAppointmentById({ db: {} as never, config }, TURNO_ID, CLIENTE_2)).rejects.toBeInstanceOf(ForbiddenError);
    mockFindTurnoById.mockResolvedValue(makeTurno({ customerId: CLIENTE.id }));
    await expect(getAppointmentById({ db: {} as never, config }, TURNO_ID, ADMIN)).resolves.toBeDefined();
  });
  it("getById 404", async () => {
    mockFindTurnoById.mockResolvedValue(null);
    await expect(getAppointmentById({ db: {} as never, config }, TURNO_ID, ADMIN)).rejects.toMatchObject({ code: "APPOINTMENT_NOT_FOUND" });
  });
  it("list delegates RN-04 defaults pagination", async () => {
    mockFindTurnosPaginated.mockResolvedValue({ data: [makeTurno(), makeTurno({ id: "x" })], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } });
    const r = await listAppointments({ db: {} as never, config }, {}, CLIENTE);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerId: CLIENTE.id }));
    expect(r.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });
  it("list ADMIN respects flags", async () => {
    mockFindTurnosPaginated.mockResolvedValue({ data: [], pagination: { page: 2, limit: 20, total: 25, totalPages: 2 } });
    const r = await listAppointments({ db: {} as never, config }, { page: 2, limit: 20, includeCancelled: true, sort: "startAt:desc" }, ADMIN);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ page: 2, limit: 20, includeCancelled: true, sort: "startAt:desc" }));
    expect(r.pagination.total).toBe(25);
  });
  it("list CLIENTE overrides customerId", async () => {
    mockFindTurnosPaginated.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    await listAppointments({ db: {} as never, config }, { customerId: "other-id" } as never, CLIENTE);
    expect(mockFindTurnosPaginated).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerId: CLIENTE.id }));
  });
  it("DTO camelCase no snake leak INV-08", async () => {
    const dto = makeTurno();
    mockFindTurnoById.mockResolvedValue(dto);
    mockFindTurnosPaginated.mockResolvedValue({ data: [dto], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const viaGet = await getAppointmentById({ db: {} as never, config }, TURNO_ID, ADMIN);
    expect(viaGet).toHaveProperty("customerId"); expect(viaGet).not.toHaveProperty("estado"); expect(viaGet).not.toHaveProperty("fecha_hora_inicio");
    const viaList = await listAppointments({ db: {} as never, config }, {}, ADMIN);
    expect(viaList.data[0]).toHaveProperty("status"); expect(viaList.data[0]).not.toHaveProperty("estado");
  });
  it("limit:101 propagates VALIDATION_ERROR", async () => {
    mockFindTurnosPaginated.mockRejectedValue(new ValidationError("limit must be between 1 and 100"));
    await expect(listAppointments({ db: {} as never, config }, { limit: 101 }, ADMIN)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("R6 shapes", () => {
  it("codes correct", () => {
    expect(new InvalidAppointmentStateError().code).toBe("INVALID_APPOINTMENT_STATE");
    expect(new AppointmentNotFoundError("x").code).toBe("APPOINTMENT_NOT_FOUND");
    expect(new ForbiddenError().code).toBe("FORBIDDEN");
    expect(new ValidationError("x").code).toBe("VALIDATION_ERROR");
    expect(new InvalidServiceError().code).toBe("INVALID_SERVICE");
  });
});
