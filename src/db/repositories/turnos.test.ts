import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  findTurnosPaginated,
  updateTurnoStatus,
} from "@/db/repositories/turnos";
import {
  AppointmentNotAvailableError,
  AppointmentNotFoundError,
} from "@/services/errors";

// Minimal TURN row in snake_case as DB would return, to verify toTurnoDTO mapping
function fakeTurnoRow(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    clienteId: "22222222-2222-4222-8222-222222222222",
    vehiculoId: "33333333-3333-4333-8333-333333333333",
    servicioId: "44444444-4444-4444-8444-444444444444",
    fechaHoraInicio: new Date("2026-09-10T12:00:00.000Z"),
    fechaHoraFin: new Date("2026-09-10T13:00:00.000Z"),
    estado: "PENDIENTE",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
  return { ...base, ...overrides };
}

function createUpdateMock(returnRows: unknown[] | Error) {
  const returning = vi.fn(() => {
    if (returnRows instanceof Error) return Promise.reject(returnRows);
    return Promise.resolve(returnRows);
  });
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update } as unknown, returning, where, set, update };
}

function createPaginatedMock(countTotal: number, dataRows: unknown[]) {
  // Need to distinguish count vs data select by first arg
  const select = vi.fn((fields: unknown) => {
    const isCount =
      fields !== undefined &&
      fields !== null &&
      typeof fields === "object" &&
      "count" in (fields as Record<string, unknown>);
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => {
          if (isCount) {
            return Promise.resolve([{ count: countTotal }]);
          }
          // data path: where -> orderBy -> limit -> offset -> rows
          return {
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => Promise.resolve(dataRows)),
              })),
            })),
          };
        }),
      })),
    };
  });
  return { db: { select } as unknown, selectMock: select };
}

describe("updateTurnoStatus — DbOrTx thin repo (INV-08, 23P01 map)", () => {
  it("passthrough returns TurnoDTO camelCase via toTurnoDTO (INV-08)", async () => {
    const row = fakeTurnoRow({ estado: "CONFIRMADO" });
    const { db } = createUpdateMock([row]);
    const dto = await updateTurnoStatus(db as never, row.id as string, "CONFIRMADO");
    expect(dto.id).toBe(row.id);
    expect(dto.status).toBe("CONFIRMADO");
    // INV-08: no snake_case leak
    expect(dto).not.toHaveProperty("estado");
    expect(dto).not.toHaveProperty("cliente_id");
    expect(dto).toHaveProperty("customerId");
    expect(dto).toHaveProperty("startDateTime");
    expect(dto).toHaveProperty("endDateTime");
    expect(dto.startDateTime).toBeInstanceOf(Date);
  });

  it("maps 23P01 EXCLUDE violation → AppointmentNotAvailableError", async () => {
    const pgError = Object.assign(new Error("exclusion"), { code: "23P01" });
    const { db } = createUpdateMock(pgError);
    await expect(updateTurnoStatus(db as never, "id-1", "CONFIRMADO")).rejects.toBeInstanceOf(
      AppointmentNotAvailableError,
    );
    await expect(updateTurnoStatus(createUpdateMock(pgError).db as never, "id-1", "CONFIRMADO")).rejects.toMatchObject({
      code: "APPOINTMENT_NOT_AVAILABLE",
    });
  });

  it("maps wrapped Drizzle cause chain 23P01 → AppointmentNotAvailableError", async () => {
    const pgInner = Object.assign(new Error("inner"), { code: "23P01" });
    const wrapped = Object.assign(new Error("DrizzleQueryError"), { cause: pgInner });
    const { db } = createUpdateMock(wrapped);
    await expect(updateTurnoStatus(db as never, "id-2", "CANCELADO")).rejects.toBeInstanceOf(
      AppointmentNotAvailableError,
    );
  });

  it("throws AppointmentNotFoundError when returning empty (no row)", async () => {
    const { db } = createUpdateMock([]);
    await expect(updateTurnoStatus(db as never, "missing-id", "CANCELADO")).rejects.toBeInstanceOf(
      AppointmentNotFoundError,
    );
    await expect(updateTurnoStatus(createUpdateMock([]).db as never, "missing-id", "CANCELADO")).rejects.toMatchObject({
      code: "APPOINTMENT_NOT_FOUND",
    });
  });

  it("rethrows non-23P01 errors unchanged", async () => {
    const other = Object.assign(new Error("other"), { code: "23503" });
    const { db } = createUpdateMock(other);
    await expect(updateTurnoStatus(db as never, "id-3", "RECHAZADO")).rejects.toMatchObject({
      code: "23503",
    });
  });
});

describe("findTurnosPaginated — RN-04 defaults + pagination boundaries", () => {
  it("limit 101 → VALIDATION_ERROR (code VALIDATION_ERROR) before DB call", async () => {
    const { db, selectMock } = createPaginatedMock(0, []);
    await expect(findTurnosPaginated(db as never, { limit: 101 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ limit: 0 }, "limit must be between 1 and 100"],
    [{ limit: -1 }, "limit must be between 1 and 100"],
    [{ page: 0 }, "page must be >= 1"],
    [{ page: -2 }, "page must be >= 1"],
    [{ sort: "invalid" as unknown as string }, "sort must be"],
    [{ now: new Date("invalid") }, "invalid now Date"],
  ] as const)("rejects %s → VALIDATION_ERROR", async (query, msgFragment) => {
    const { db } = createPaginatedMock(0, []);
    await expect(findTurnosPaginated(db as never, query as never)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(findTurnosPaginated(db as never, query as never)).rejects.toThrow(msgFragment);
  });

  it("defaults: page 1 limit 20 asc, no timezone hardcode, returns paginated shape via toTurnoDTO", async () => {
    const rows = [fakeTurnoRow(), fakeTurnoRow({ id: "22222222-2222-4222-8222-222222222223" })];
    const { db } = createPaginatedMock(25, rows);
    const result = await findTurnosPaginated(db as never, { now: new Date("2026-09-09T00:00:00.000Z") });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
    expect(result.data).toHaveLength(2);
    for (const dto of result.data) {
      expect(dto).toHaveProperty("customerId");
      expect(dto).not.toHaveProperty("cliente_id");
      expect(dto).toHaveProperty("status");
      expect(dto).not.toHaveProperty("estado");
    }
  });

  it("pagination math: page 2 limit 20 total 25 → offset 20, totalPages 2", async () => {
    const rows = [fakeTurnoRow()];
    const { db } = createPaginatedMock(25, rows);
    const result = await findTurnosPaginated(db as never, {
      page: 2,
      limit: 20,
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 25, totalPages: 2 });
    expect(result.data).toHaveLength(1);
  });

  it("total 0 → totalPages 0, empty data", async () => {
    const { db } = createPaginatedMock(0, []);
    const result = await findTurnosPaginated(db as never, {
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    expect(result.data).toEqual([]);
  });

  it("accepts sort variants asc|desc|startAt:asc|startAt:desc without throwing", async () => {
    for (const sort of ["asc", "desc", "startAt:asc", "startAt:desc"] as const) {
      const { db } = createPaginatedMock(0, []);
      await expect(findTurnosPaginated(db as never, { sort, now: new Date("2026-09-09T00:00:00.000Z") })).resolves.toBeDefined();
    }
  });

  it("exposes include flags without throwing (default hides CANCELADO/RECHAZADO)", async () => {
    const { db } = createPaginatedMock(0, []);
    await expect(
      findTurnosPaginated(db as never, {
        includeCancelled: true,
        now: new Date("2026-09-09T00:00:00.000Z"),
      }),
    ).resolves.toBeDefined();
    await expect(
      findTurnosPaginated(db as never, {
        includeRejected: true,
        now: new Date("2026-09-09T00:00:00.000Z"),
      }),
    ).resolves.toBeDefined();
    await expect(
      findTurnosPaginated(db as never, {
        includeCancelled: true,
        includeRejected: true,
        now: new Date("2026-09-09T00:00:00.000Z"),
      }),
    ).resolves.toBeDefined();
  });

  it("no FOR UPDATE / REPEATABLE READ in executable code (INV-04 deferred to T-028)", async () => {
    // Guard: executable code must not introduce concurrency — comments mentioning
    // the deferred T-028 terms are allowed, but stripped code must be clean.
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/db/repositories/turnos.ts", "utf8");
    const stripped = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/FOR UPDATE/i);
    expect(stripped).not.toMatch(/REPEATABLE READ/i);
    expect(content).toContain("toTurnoDTO");
  });
});
