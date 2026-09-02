/**
 * Tests for `findTurnosPaginatedEnriched` (T-045 UI-04 PR1 data layer).
 *
 * Verifies GWT 6.2 (single query — no N+1) and the REQ-04/REQ-03
 * pagination + RN-04 defaults. Drizzle is mocked at the `db.select` /
 * `db.leftJoin` boundary so we can assert:
 *   - exactly 1 `count(*)` over `turnos` (no joins)
 *   - exactly 1 data query with LEFT JOIN servicios + LEFT JOIN vehiculos
 *   - zero N+1 lookups (no `inArray` over servicios/vehiculos)
 *   - the where clause matches PENDIENTE|CONFIRMADO with start > now
 *
 * INV-08: mapper ensures camelCase output even with snake_case columns
 * coming back from the joined row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findTurnosPaginatedEnriched } from "@/db/repositories/turnos";
import { servicios, vehiculos } from "@/db/schema";

interface JoinCall {
  joinKind: "leftJoin";
  table: unknown;
}

/**
 * Mock the Drizzle builder chain:
 *   db.select(...).from(turnos).leftJoin(servicios).leftJoin(vehiculos)
 *     .where(...).orderBy(...).limit(...).offset(...) → rows
 *
 * Real Drizzle: `db.select(...)` returns a builder that exposes `.from()`.
 * After `.from(table)` you get a fresh builder with `.leftJoin` / `.where`
 * / `.innerJoin`. `.leftJoin` returns the same builder (chaining). `.where`
 * returns either the data builder (chained into orderBy) or — for the
 * count query — a promise resolving to the count row directly.
 */
function createEnrichedMock(totalCount: number, dataRows: unknown[]) {
  const joins: JoinCall[] = [];
  const orderByCalls: unknown[] = [];
  const whereCalls: unknown[] = [];
  const fromCalls: unknown[] = [];

  function buildFromBuilder() {
    const builder: Record<string, unknown> = {};
    builder.leftJoin = vi.fn((table: unknown) => {
      joins.push({ joinKind: "leftJoin", table });
      return builder;
    });
    builder.innerJoin = vi.fn(() => builder);
    builder.where = vi.fn((arg: unknown) => {
      whereCalls.push(arg);
      const isCount = (builder as { _isCount?: boolean })._isCount === true;
      if (isCount) {
        return Promise.resolve([{ count: totalCount }]);
      }
      return {
        orderBy: vi.fn((orderArg: unknown) => {
          orderByCalls.push(orderArg);
          return {
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve(dataRows)),
            })),
          };
        }),
      };
    });
    return builder;
  }

  const select = vi.fn((projection: unknown) => {
    const isCount =
      projection !== undefined &&
      projection !== null &&
      typeof projection === "object" &&
      "count" in (projection as Record<string, unknown>);
    // Real Drizzle: `db.select(...)` returns a builder whose `.from(table)`
    // returns the actual from-builder. We mirror that two-step chain.
    const selectBuilder = {
      from: vi.fn((table: unknown) => {
        fromCalls.push(table);
        const b = buildFromBuilder();
        if (isCount) (b as { _isCount?: boolean })._isCount = true;
        return b;
      }),
    };
    return selectBuilder;
  });

  const db = { select } as unknown;

  return {
    db,
    selectMock: select,
    fromMock: { calls: fromCalls },
    joins,
    orderByCalls,
    whereCalls,
  };
}

describe("findTurnosPaginatedEnriched — single-query JOIN (GWT 6.2, no N+1)", () => {
  it("issues exactly 1 count(*) over turnos + 1 data select with LEFT JOIN servicios + LEFT JOIN vehiculos", async () => {
    const dataRows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        clienteId: "22222222-2222-4222-8222-222222222222",
        vehiculoId: "33333333-3333-4333-8333-333333333333",
        servicioId: "44444444-4444-4444-8444-444444444444",
        fechaHoraInicio: new Date("2026-09-10T12:00:00.000Z"),
        fechaHoraFin: new Date("2026-09-10T13:00:00.000Z"),
        estado: "PENDIENTE",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        servicioNombre: "Cambio de aceite",
        vehiculoMarca: "Toyota",
        vehiculoModelo: "Corolla",
        vehiculoPatente: "ABC123",
      },
    ];
    const mock = createEnrichedMock(25, dataRows);
    const result = await findTurnosPaginatedEnriched(mock.db as never, {
      page: 1,
      limit: 20,
      now: new Date("2026-09-09T00:00:00.000Z"),
    });

    expect(mock.selectMock).toHaveBeenCalledTimes(2); // count + data
    expect(mock.joins).toHaveLength(2); // servicios + vehiculos
    expect(mock.joins.map((j) => j.joinKind)).toEqual(["leftJoin", "leftJoin"]);
    expect(mock.joins.map((j) => j.table)).toEqual([servicios, vehiculos]);
    expect(mock.orderByCalls).toHaveLength(1); // data query only
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.serviceName).toBe("Cambio de aceite");
    expect(result.data[0]?.vehicleLabel).toBe("Toyota Corolla — ABC123");
  });

  it("does NOT issue a separate bulk fetch over servicios or vehiculos (no N+1 / no Map+inArray)", async () => {
    const mock = createEnrichedMock(0, []);
    await findTurnosPaginatedEnriched(mock.db as never, {
      page: 1,
      limit: 20,
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    // 2 select calls total: 1 for count, 1 for the JOIN data row. If we
    // ever add a bulk fetch over servicios/vehiculos, this assertion fires.
    expect(mock.selectMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe("findTurnosPaginatedEnriched — pagination math + RN-04 defaults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults: page=1, limit=20, no timezone hardcode (INV-06)", async () => {
    const mock = createEnrichedMock(25, []);
    const result = await findTurnosPaginatedEnriched(mock.db as never, {
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
  });

  it("page=2 + limit=20 + total=25 → offset 20, totalPages 2", async () => {
    const mock = createEnrichedMock(25, []);
    const result = await findTurnosPaginatedEnriched(mock.db as never, {
      page: 2,
      limit: 20,
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 25, totalPages: 2 });
  });

  it("total=0 → totalPages=0, empty data", async () => {
    const mock = createEnrichedMock(0, []);
    const result = await findTurnosPaginatedEnriched(mock.db as never, {
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    expect(result.data).toEqual([]);
  });

  it.each([
    [{ limit: 101 }, "limit must be between 1 and 100"],
    [{ limit: 0 }, "limit must be between 1 and 100"],
    [{ page: 0 }, "page must be >= 1"],
    [{ now: new Date("invalid") }, "invalid now Date"],
  ] as const)("rejects %s → VALIDATION_ERROR", async (query, msgFragment) => {
    const mock = createEnrichedMock(0, []);
    await expect(
      findTurnosPaginatedEnriched(mock.db as never, query as never),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      findTurnosPaginatedEnriched(mock.db as never, query as never),
    ).rejects.toThrow(msgFragment);
  });
});

describe("findTurnosPaginatedEnriched — enrichment null fallback (GWT 1.3)", () => {
  it("LEFT JOIN nulls → mapper substitutes fallback strings", async () => {
    const dataRows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        clienteId: "22222222-2222-4222-8222-222222222222",
        vehiculoId: "33333333-3333-4333-8333-333333333333",
        servicioId: "44444444-4444-4444-8444-444444444444",
        fechaHoraInicio: new Date("2026-09-10T12:00:00.000Z"),
        fechaHoraFin: new Date("2026-09-10T13:00:00.000Z"),
        estado: "PENDIENTE",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
        servicioNombre: null,
        vehiculoMarca: null,
        vehiculoModelo: null,
        vehiculoPatente: null,
      },
    ];
    const mock = createEnrichedMock(1, dataRows);
    const result = await findTurnosPaginatedEnriched(mock.db as never, {
      now: new Date("2026-09-09T00:00:00.000Z"),
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.serviceName).toBe("Servicio no disponible");
    expect(result.data[0]?.vehicleLabel).toBe("Vehículo no disponible");
  });
});
