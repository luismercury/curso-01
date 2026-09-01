import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function st(tree: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(tree, (_k, v) => {
    if (typeof v === "object" && v !== null) { if (seen.has(v)) return "[C]"; seen.add(v); }
    if (typeof v === "function") return `[fn ${(v as { name?: string }).name ?? ""}]`;
    return v;
  });
}

const A = vi.fn(), R = vi.fn((u: string) => { throw new Error(`NEXT_REDIRECT:${u}`); }), B = vi.fn(), L = vi.fn(), C = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (u: string) => R(u) }));
vi.mock("@/lib/auth/auth", () => ({ auth: () => A() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/workshopConfig", () => ({ getWorkshopConfig: (...a: unknown[]) => C(...(a as never[])) }));
vi.mock("@/services/appointmentService", () => ({
  getAppointmentById: (...a: unknown[]) => B(...(a as never[])),
  listAppointments: (...a: unknown[]) => L(...(a as never[])),
}));

const O = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID = "550e8400-e29b-41d4-a716-446655440000", FR = "660e8400-e29b-41d4-a716-446655440001", UN = "770e8400-e29b-41d4-a716-446655440099";
const SNAKE = "cliente_id vehiculo_id servicio_id fecha_hora_inicio fecha_hora_fin estado created_at updated_at fechaHoraInicio fechaHoraFin marca modelo anio patente".split(" ");
const u = (id: string) => ({ user: { id, email: `${id}@x.test`, role: "CLIENTE" as const } });
const d = (o: Record<string, unknown> = {}) => ({ id: UUID, customerId: O, vehicleId: "v", serviceId: "s", startDateTime: new Date("2026-09-10T12:30:00.000Z"), endDateTime: new Date("2026-09-10T13:00:00.000Z"), status: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"), ...o });
const ls = () => ({ data: [d({ id: "f" })], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
const cf = () => ({ timezone: "America/Argentina/Buenos_Aires", capacityPerSlot: 1, slotStepMinutes: 30 });
const load = async () => (await import("@/app/(customer)/appointments/page")).default;

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

const ok = () => { A.mockResolvedValueOnce(u(O)); C.mockResolvedValueOnce(cf()); L.mockResolvedValueOnce(ls()); };

describe("AppointmentsPage", () => {
  it("null session → redirect, no service calls", async () => {
    A.mockResolvedValueOnce(null);
    await expect((await load())({ searchParams: Promise.resolve({ confirmed: UUID }) })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(B).not.toHaveBeenCalled(); expect(L).not.toHaveBeenCalled();
  });

  it("valid owned → banner + Suspense + no snake (R1.1, R3.4)", async () => {
    ok(); B.mockResolvedValueOnce(d());
    const j = st(await (await load())({ searchParams: Promise.resolve({ confirmed: UUID }) }));
    expect(j).toContain("BookingConfirmationImpl");
    expect(j).toMatch(/Suspense|fallback/);
    expect(j).toContain("2026-09-10T12:30:00.000Z");
    for (const s of SNAKE) expect(j).not.toContain(s);
  });

  it.each([["not-a-uuid"], ["<script>alert(1)</script>"]])("invalid %s → no fetch, no banner, list renders", async (c) => {
    ok();
    const j = st(await (await load())({ searchParams: Promise.resolve({ confirmed: c }) }));
    expect(B).not.toHaveBeenCalled();
    expect(j).not.toContain("BookingConfirmationImpl");
    expect(j).toContain("appointments-list");
  });

  it("foreign UUID + error → banner absent, no leak (R1.3)", async () => {
    ok(); B.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const j = st(await (await load())({ searchParams: Promise.resolve({ confirmed: FR }) }));
    expect(j).not.toContain("BookingConfirmationImpl");
    expect(j).not.toContain(FR);
  });

  it("unknown UUID → banner absent (R1.4)", async () => {
    ok(); B.mockRejectedValueOnce(new Error("NOT_FOUND"));
    const j = st(await (await load())({ searchParams: Promise.resolve({ confirmed: UN }) }));
    expect(j).not.toContain("BookingConfirmationImpl");
    expect(j).not.toContain(UN);
  });

  it.each(["CANCELADO", "RECHAZADO"])("status=%s → banner absent (R3.1)", async (status) => {
    ok(); B.mockResolvedValueOnce(d({ status }));
    const j = st(await (await load())({ searchParams: Promise.resolve({ confirmed: UUID }) }));
    expect(j).not.toContain("BookingConfirmationImpl");
    expect(j).not.toContain(status);
  });
});
