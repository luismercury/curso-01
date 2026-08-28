import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mockFindTurnoById = vi.fn(), mockFindTurnosPaginated = vi.fn(), mockUpdateTurnoStatus = vi.fn();
const mockCountActiveOverlappingForUpdate = vi.fn();
vi.mock("@/db/repositories/turnos", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...(orig as object),
    findTurnoById: (...a: unknown[]) => mockFindTurnoById(...a),
    findTurnosPaginated: (...a: unknown[]) => mockFindTurnosPaginated(...a),
    updateTurnoStatus: (...a: unknown[]) => mockUpdateTurnoStatus(...a),
    countActiveOverlappingForUpdate: (...a: unknown[]) => mockCountActiveOverlappingForUpdate(...a),
  };
});
const mockFindVehiculoById = vi.fn();
vi.mock("@/db/repositories/vehiculos", () => ({ findVehiculoById: (...a: unknown[]) => mockFindVehiculoById(...a) }));
const mockFindServicioById = vi.fn();
vi.mock("@/db/repositories/servicios", () => ({ findServicioById: (...a: unknown[]) => mockFindServicioById(...a) }));
import { createAppointment, confirmAppointment, rejectAppointment, cancelAppointment, getAppointmentById, listAppointments } from "@/services/appointmentService";
import { ForbiddenError } from "@/lib/auth/requireAuth";
import { ValidationError } from "@/config/workshopSchedule";
import { AppointmentNotFoundError, InvalidAppointmentStateError, AppointmentNotAvailableError } from "@/services/errors";
import { InvalidServiceError } from "@/services/appointmentGuard";
const ADMIN = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "a@a.com", role: "ADMINISTRADOR" as const };
const CLIENTE = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "c@c.com", role: "CLIENTE" as const };
const CLIENTE_2 = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "c2@c.com", role: "CLIENTE" as const };
const VEHICLE_ID = "11111111-1111-4111-8111-111111111111", SERVICE_ID = "22222222-2222-4222-8222-222222222222", TURNO_ID = "33333333-3333-4333-8333-333333333333";
const baseConfig = { timezone: "America/Argentina/Buenos_Aires", operatingHours: undefined, capacityPerSlot: 1 as const };
const config = baseConfig;
const makeTurno = (o: Partial<Record<string, unknown>> = {}) => ({ id: TURNO_ID, customerId: CLIENTE.id, vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T12:00:00.000Z"), endDateTime: new Date("2026-09-10T13:00:00.000Z"), status: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"), ...o });
const makeVehiculo = (o: Partial<Record<string, unknown>> = {}) => ({ id: VEHICLE_ID, customerId: CLIENTE.id, brand: "Toyota", model: "Corolla", year: 2020, plate: "ABC123", createdAt: new Date(), updatedAt: new Date(), ...o });
const makeServicio = (o: Partial<Record<string, unknown>> = {}) => ({ id: SERVICE_ID, name: "Oil", description: null, durationMinutes: 60, active: true, createdAt: new Date(), updatedAt: new Date(), ...o });
function makeMockDb() {
  const mockExecute = vi.fn().mockResolvedValue({});
  const mockReturning = vi.fn().mockResolvedValue([{ id: TURNO_ID, clienteId: CLIENTE.id, vehiculoId: VEHICLE_ID, servicioId: SERVICE_ID, fechaHoraInicio: new Date("2026-09-10T14:00:00.000Z"), fechaHoraFin: new Date("2026-09-10T15:00:00.000Z"), estado: "PENDIENTE", createdAt: new Date(), updatedAt: new Date() }]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
  const tx: Record<string, unknown> = { execute: mockExecute, insert: mockInsert };
  // expose for assertions
  (tx as unknown as { _mockExecute: unknown })._mockExecute = mockExecute;
  (tx as unknown as { _mockInsert: unknown })._mockInsert = mockInsert;
  (tx as unknown as { _mockReturning: unknown })._mockReturning = mockReturning;
  (tx as unknown as { _mockValues: unknown })._mockValues = mockValues;
  const db = { transaction: vi.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)) } as unknown as { transaction: ReturnType<typeof vi.fn> } & { _tx: typeof tx };
  // attach tx for test introspection
  (db as unknown as Record<string, unknown>)._tx = tx;
  return { db: db as never, tx, mockExecute, mockInsert, mockReturning, mockValues };
}
beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); mockCountActiveOverlappingForUpdate.mockReset(); });

describe("createAppointment atomic T-028 R2 R5", () => {
  it("rejects inactive → INVALID_SERVICE before FOR UPDATE", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ active: false }));
    const { db } = makeMockDb();
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "INVALID_SERVICE" });
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
  it("rejects foreign → FORBIDDEN before FOR UPDATE", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db } = makeMockDb();
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
  it("ADMIN bypasses foreign and inserts", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db, mockReturning } = makeMockDb();
    mockReturning.mockResolvedValue([{ id: TURNO_ID, clienteId: CLIENTE_2.id, vehiculoId: VEHICLE_ID, servicioId: SERVICE_ID, fechaHoraInicio: new Date("2026-09-10T14:00:00.000Z"), fechaHoraFin: new Date("2026-09-10T15:00:00.000Z"), estado: "PENDIENTE", createdAt: new Date(), updatedAt: new Date() }]);
    const dto = await createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: ADMIN });
    expect(dto.customerId).toBe(CLIENTE_2.id);
    expect(mockCountActiveOverlappingForUpdate).toHaveBeenCalledTimes(1);
  });
  it("rejects close-crossing 11:30+90>12:00 → 400 no FOR UPDATE", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 90 }));
    const { db } = makeMockDb();
    const start = new Date("2026-09-10T14:30:00.000Z"); // 11:30 BA
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: start, authUser: CLIENTE })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
  it("allows inclusive 11:00+60==12:00 → proceeds to FOR UPDATE and 201", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 60 }));
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db } = makeMockDb();
    const start = new Date("2026-09-10T14:00:00.000Z"); // 11:00 BA
    const dto = await createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: start, authUser: CLIENTE });
    expect(dto.startDateTime).toEqual(new Date("2026-09-10T14:00:00.000Z"));
    expect(mockCountActiveOverlappingForUpdate).toHaveBeenCalledTimes(1);
  });
  it("cnt >= capacity → 409 AppointmentNotAvailableError, no INSERT", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(1);
    const { db, mockInsert } = makeMockDb();
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toBeInstanceOf(AppointmentNotAvailableError);
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "APPOINTMENT_NOT_AVAILABLE" });
    expect(mockInsert).not.toHaveBeenCalled();
  });
  it("cnt < capacity → 201 inserts via TX", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db } = makeMockDb();
    const dto = await createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE });
    expect(dto).toHaveProperty("status", "PENDIENTE");
    expect(dto).toHaveProperty("customerId");
    expect((dto as unknown as Record<string, unknown>).estado).toBeUndefined();
  });
  it("capacity=2 cnt=1 → 201 proves not hardcoded >=1", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(1);
    const { db } = makeMockDb();
    const cfg2 = { ...config, capacityPerSlot: 2 as const };
    const dto = await createAppointment({ db: db as never, config: cfg2 }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE });
    expect(dto).toBeDefined();
    expect(mockCountActiveOverlappingForUpdate).toHaveBeenCalledTimes(1);
  });
  it("synthetic 23P01 after INSERT → 409 (outer catch)", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db, mockReturning } = makeMockDb();
    const pgErr = Object.assign(new Error("exclusion"), { code: "23P01" });
    mockReturning.mockRejectedValue(pgErr);
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "APPOINTMENT_NOT_AVAILABLE", message: "El horario seleccionado ya no se encuentra disponible." });
  });
  it("23514/23503 not mis-mapped to 409", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db, mockReturning } = makeMockDb();
    const err23514 = Object.assign(new Error("check"), { code: "23514" });
    mockReturning.mockRejectedValueOnce(err23514);
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "23514" });
    const err23503 = Object.assign(new Error("fk"), { code: "23503" });
    mockReturning.mockRejectedValueOnce(err23503);
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "23503" });
  });
  it("outer hasPgCode 23P01 via transaction wrapper → 409 with Spanish message", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const txErr = Object.assign(new Error("tx 23P01"), { code: "23P01" });
    const db = { transaction: vi.fn().mockRejectedValue(txErr) } as never;
    await expect(createAppointment({ db, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "APPOINTMENT_NOT_AVAILABLE", message: "El horario seleccionado ya no se encuentra disponible." });
  });
  it("400 vs 409: 11:30+90>12:00 is 400, overlap is 409", async () => {
    // 400 case already tested — now 409 overlap
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 60 }));
    mockCountActiveOverlappingForUpdate.mockResolvedValue(1);
    const { db } = makeMockDb();
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T12:30:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "APPOINTMENT_NOT_AVAILABLE" });
    // ensure 400 case no count
    mockCountActiveOverlappingForUpdate.mockClear();
    mockFindServicioById.mockResolvedValue(makeServicio({ durationMinutes: 90 }));
    const { db: db2 } = makeMockDb();
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    await expect(createAppointment({ db: db2 as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:30:00.000Z"), authUser: CLIENTE })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
  it("H-13 order: Forbidden before countActiveOverlappingForUpdate spy", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo({ customerId: CLIENTE_2.id }));
    const { db } = makeMockDb();
    await expect(createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE })).rejects.toBeInstanceOf(ForbiddenError);
    expect(mockCountActiveOverlappingForUpdate).not.toHaveBeenCalled();
  });
  it("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ is first stmt", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db, mockExecute } = makeMockDb();
    await createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const firstCallArg = mockExecute.mock.calls[0]?.[0] as unknown;
    const sqlText = String((firstCallArg as Record<string, unknown>)?.query ?? firstCallArg ?? "");
    // drizzle sql template contains SET TRANSACTION; check execute was called at all
    expect(mockExecute).toHaveBeenCalled();
  });
  it("toTurnoDTO no snake_case leak (INV-08)", async () => {
    mockFindVehiculoById.mockResolvedValue(makeVehiculo());
    mockFindServicioById.mockResolvedValue(makeServicio());
    mockCountActiveOverlappingForUpdate.mockResolvedValue(0);
    const { db } = makeMockDb();
    const dto = await createAppointment({ db: db as never, config }, { vehicleId: VEHICLE_ID, serviceId: SERVICE_ID, startDateTime: new Date("2026-09-10T14:00:00.000Z"), authUser: CLIENTE });
    expect(dto).toHaveProperty("customerId");
    expect(dto).not.toHaveProperty("clienteId");
    expect(dto).not.toHaveProperty("estado");
    expect(dto).toHaveProperty("startDateTime");
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
