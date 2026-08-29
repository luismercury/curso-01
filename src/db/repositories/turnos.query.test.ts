import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { findTurnosPaginated } from "@/db/repositories/turnos";
import { getBaDayUtcRange } from "@/services/availability/availabilityService";

function row(o: Record<string, unknown> = {}) {
  return { id: "11111111-1111-4111-8111-111111111111", clienteId: "22222222-2222-4222-8222-222222222222", vehiculoId: "33333333-3333-4333-8333-333333333333", servicioId: "44444444-4444-4444-8444-444444444444", fechaHoraInicio: new Date("2026-09-10T12:00:00Z"), fechaHoraFin: new Date("2026-09-10T13:00:00Z"), estado: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"), ...o };
}
function mockPaginated(total: number, rows: unknown[]) {
  let off: number | null = null;
  const where = vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn((n: number) => ({ offset: vi.fn((o: number) => { off = o; return Promise.resolve(rows); }) })) })) }));
  const countWhere = vi.fn(() => Promise.resolve([{ count: total }]));
  const select = vi.fn((f: unknown) => {
    const isCount = f && typeof f === "object" && "count" in (f as Record<string, unknown>);
    return { from: vi.fn(() => ({ where: isCount ? countWhere : where })) };
  });
  return { db: { select } as unknown, selectMock: select, getOff: () => off, countWhere, where };
}

describe("findTurnosPaginated T-033", () => {
  it("status contradiction before DB", async () => {
    const { db, selectMock } = mockPaginated(0, []);
    await expect(findTurnosPaginated(db as never, { status: "CANCELADO", now: new Date("2026-09-09T00:00:00Z") } as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(selectMock).not.toHaveBeenCalled();
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { status: "RECHAZADO", now: new Date() } as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { status: "CANCELADO", includeCancelled: true, now: new Date("2026-09-09T00:00:00Z") })).resolves.toBeDefined();
  });
  it("date vs from/to & dateRange vs from", async () => {
    const { db } = mockPaginated(0, []);
    await expect(findTurnosPaginated(db as never, { date: "2026-09-10", from: new Date(), now: new Date() } as never)).rejects.toThrow(/use date/);
    const dr = getBaDayUtcRange("2026-09-10", "America/Argentina/Buenos_Aires");
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { dateRange: dr, from: new Date(), now: new Date() } as never)).rejects.toThrow(/use date/);
  });
  it("from>to, offset negative", async () => {
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { from: new Date("2026-09-11T00:00:00Z"), to: new Date("2026-09-10T00:00:00Z"), now: new Date() } as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { offset: -1, now: new Date() } as never)).rejects.toThrow(/offset/);
  });
  it("BA 2026-09-10 03:00Z & DST 2026-03-08", () => {
    const { fromUtc, toUtc } = getBaDayUtcRange("2026-09-10", "America/Argentina/Buenos_Aires");
    expect(fromUtc.toISOString()).toBe("2026-09-10T03:00:00.000Z");
    expect(toUtc.toISOString()).toBe("2026-09-11T03:00:00.000Z");
    const d = getBaDayUtcRange("2026-03-08", "America/Argentina/Buenos_Aires");
    expect(d.toUtc.getTime() - d.fromUtc.getTime()).toBe(86400000);
  });
  it("pagination offset & limit/sort", async () => {
    const m1 = mockPaginated(25, [row()]);
    const r1 = await findTurnosPaginated(m1.db as never, { page: 2, limit: 20, now: new Date("2026-09-09T00:00:00Z") });
    expect(r1.pagination).toEqual({ page: 2, limit: 20, total: 25, totalPages: 2 });
    expect(m1.getOff()).toBe(20);
    const m2 = mockPaginated(25, [row()]);
    await findTurnosPaginated(m2.db as never, { offset: 20, now: new Date("2026-09-09T00:00:00Z") });
    expect(m2.getOff()).toBe(20);
    const m3 = mockPaginated(25, [row()]);
    await findTurnosPaginated(m3.db as never, { page: 2, limit: 10, offset: 999, now: new Date("2026-09-09T00:00:00Z") });
    expect(m3.getOff()).toBe(10);
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { limit: 0, now: new Date() } as never)).rejects.toThrow(/limit/);
    await expect(findTurnosPaginated(mockPaginated(0, []).db as never, { sort: "DROP" as never, now: new Date() } as never)).rejects.toThrow(/sort/);
  });
  it("date string via repo uses range", async () => {
    const { db } = mockPaginated(0, []);
    const r = await findTurnosPaginated(db as never, { date: "2026-09-10", now: new Date("2026-09-09T00:00:00Z") });
    expect(r.pagination.total).toBe(0);
  });
});
