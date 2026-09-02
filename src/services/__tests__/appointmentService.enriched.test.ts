/**
 * Tests for `listAppointmentsEnriched` (T-045 UI-04 PR1 data layer).
 *
 * INV-03 ownership defense: a CLIENTE MUST NOT be able to read another
 * customer's appointments via tampered `?customerId=`. The service
 * injects `authUser.id` into the query and drops whatever the caller
 * supplied — the IDOR regression test for this lives here.
 *
 * ADMINISTRADOR keeps the caller-supplied `customerId` (used by the
 * admin pending query filter) — also covered.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFindTurnosPaginatedEnriched = vi.fn();
vi.mock("@/db/repositories/turnos", async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...(orig as object),
    findTurnosPaginatedEnriched: (...a: unknown[]) =>
      mockFindTurnosPaginatedEnriched(...a),
  };
});

import { listAppointmentsEnriched } from "@/services/appointmentService";

const CLIENTE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "c@c.com",
  role: "CLIENTE" as const,
};
const OTHER_CLIENTE = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "c2@c.com",
  role: "CLIENTE" as const,
};
const ADMIN = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "a@a.com",
  role: "ADMINISTRADOR" as const,
};

const baseConfig = {
  timezone: "America/Argentina/Buenos_Aires",
  operatingHours: undefined,
  capacityPerSlot: 1 as const,
};
const FIXED_NOW = new Date("2026-09-09T00:00:00.000Z");

function makeDb() {
  return { transaction: vi.fn() } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindTurnosPaginatedEnriched.mockResolvedValue({
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

describe("listAppointmentsEnriched — INV-03 customerId injection (IDOR defense)", () => {
  it("CLIENTE: drops caller-supplied customerId, injects authUser.id", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { customerId: OTHER_CLIENTE.id, page: 1, limit: 20 }, // tampered
      CLIENTE,
    );
    expect(mockFindTurnosPaginatedEnriched).toHaveBeenCalledTimes(1);
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.customerId).toBe(CLIENTE.id); // session id, NOT other
    expect(callArg.customerId).not.toBe(OTHER_CLIENTE.id);
  });

  it("CLIENTE: missing customerId → injected authUser.id (default path)", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { page: 1, limit: 20 },
      CLIENTE,
    );
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.customerId).toBe(CLIENTE.id);
  });

  it("ADMINISTRADOR: keeps caller-supplied customerId (admin tooling path)", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { customerId: OTHER_CLIENTE.id, page: 1, limit: 20 },
      ADMIN,
    );
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.customerId).toBe(OTHER_CLIENTE.id);
  });

  it("ADMINISTRADOR: missing customerId → no filter (all customers)", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { page: 1, limit: 20 },
      ADMIN,
    );
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.customerId).toBeUndefined();
  });
});

describe("listAppointmentsEnriched — clock + passthrough", () => {
  it("forwards deps.now to the repo (deterministic pagination now filter)", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { page: 1, limit: 20 },
      CLIENTE,
    );
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.now).toBe(FIXED_NOW);
  });

  it("falls back to new Date() when deps.now is omitted", async () => {
    const db = makeDb();
    const before = new Date();
    await listAppointmentsEnriched(
      { db, config: baseConfig },
      { page: 1, limit: 20 },
      CLIENTE,
    );
    const after = new Date();
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    const now = callArg.now as Date;
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(now.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("forwards page + limit verbatim (validator clamps upstream)", async () => {
    const db = makeDb();
    await listAppointmentsEnriched(
      { db, config: baseConfig, now: FIXED_NOW },
      { page: 3, limit: 50 },
      CLIENTE,
    );
    const callArg = mockFindTurnosPaginatedEnriched.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(callArg.page).toBe(3);
    expect(callArg.limit).toBe(50);
  });

  it("returns the enriched result shape unchanged", async () => {
    const enrichedRow = {
      id: "11111111-1111-4111-8111-111111111111",
      customerId: CLIENTE.id,
      vehicleId: "33333333-3333-4333-8333-333333333333",
      serviceId: "44444444-4444-4444-8444-444444444444",
      startDateTime: new Date("2026-09-10T12:00:00.000Z"),
      endDateTime: new Date("2026-09-10T13:00:00.000Z"),
      status: "PENDIENTE",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      serviceName: "Cambio de aceite",
      vehicleLabel: "Toyota Corolla — ABC123",
    };
    mockFindTurnosPaginatedEnriched.mockResolvedValueOnce({
      data: [enrichedRow],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const result = await listAppointmentsEnriched(
      { db: makeDb(), config: baseConfig, now: FIXED_NOW },
      { page: 1, limit: 20 },
      CLIENTE,
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.serviceName).toBe("Cambio de aceite");
    expect(result.data[0]?.vehicleLabel).toBe("Toyota Corolla — ABC123");
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });
});
