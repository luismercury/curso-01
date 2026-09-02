import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * JSON-tree serializer for the page's React tree. Used by the T-044
 * banner tests to assert that the banner / list structure is present
 * without going through `@testing-library/react` (which can't render
 * async RSC components). Function components show up as
 * `[fn ComponentName]` — assertions on rendered text must run through
 * the AppointmentList unit tests instead, because the page-test JSON
 * stops at the compound boundary.
 */
function st(tree: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(tree, (_k, v) => {
    if (typeof v === "object" && v !== null) { if (seen.has(v)) return "[C]"; seen.add(v); }
    if (typeof v === "function") return `[fn ${(v as { name?: string }).name ?? ""}]`;
    return v;
  });
}

const A = vi.fn(), R = vi.fn((u: string) => { throw new Error(`NEXT_REDIRECT:${u}`); }), B = vi.fn(), LE = vi.fn(), C = vi.fn();
const routerPush = vi.fn();
let mockSearch = new URLSearchParams();
vi.mock("next/navigation", () => ({
  redirect: (u: string) => R(u),
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mockSearch,
  usePathname: () => "/appointments",
}));
vi.mock("@/lib/auth/auth", () => ({ auth: () => A() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/workshopConfig", () => ({ getWorkshopConfig: (...a: unknown[]) => C(...(a as never[])) }));
vi.mock("@/services/appointmentService", () => ({
  getAppointmentById: (...a: unknown[]) => B(...(a as never[])),
  listAppointmentsEnriched: (...a: unknown[]) => LE(...(a as never[])),
}));

const O = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID = "550e8400-e29b-41d4-a716-446655440000", FR = "660e8400-e29b-41d4-a716-446655440001", UN = "770e8400-e29b-41d4-a716-446655440099";
const SNAKE = "cliente_id vehiculo_id servicio_id fecha_hora_inicio fecha_hora_fin estado created_at updated_at fechaHoraInicio fechaHoraFin marca modelo anio patente servicio_nombre vehiculo_marca vehiculo_modelo vehiculo_patente".split(" ");
const u = (id: string) => ({ user: { id, email: `${id}@x.test`, role: "CLIENTE" as const } });
const d = (o: Record<string, unknown> = {}) => ({ id: UUID, customerId: O, vehicleId: "v", serviceId: "s", startDateTime: new Date("2026-09-10T12:30:00.000Z"), endDateTime: new Date("2026-09-10T13:00:00.000Z"), status: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"), ...o });
// Enriched DTO returned by `listAppointmentsEnriched` mock — already
// mapped by the data layer (serviceName + vehicleLabel are set). The
// page pipes this through `toEnrichedJson` which serializes Date → ISO
// before crossing RSC → client.
const ed = (o: Record<string, unknown> = {}) => ({
  id: "550e8400-e29b-41d4-a716-446655440010",
  customerId: O,
  vehicleId: "v",
  serviceId: "s",
  startDateTime: new Date("2026-09-10T12:30:00.000Z"),
  endDateTime: new Date("2026-09-10T13:00:00.000Z"),
  status: "PENDIENTE",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  serviceName: "Cambio de aceite",
  vehicleLabel: "Toyota Corolla — AB123CD",
  ...o,
});
/**
 * Enriched-list result builder. Splits `data` and `pagination` cleanly
 * — a previous version spread `o` inside `pagination`, which let
 * `data: []` sneak in as a pagination key and corrupted assertions.
 */
const els = (o: { data?: ReturnType<typeof ed>[]; pagination?: Record<string, number> } = {}) => ({
  data: o.data ?? [ed()],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1, ...o.pagination },
});
const cf = () => ({ timezone: "America/Argentina/Buenos_Aires", capacityPerSlot: 1, slotStepMinutes: 30 });
const load = async () => (await import("@/app/(customer)/appointments/page")).default;

beforeEach(() => { vi.clearAllMocks(); mockSearch = new URLSearchParams(); });
afterEach(() => vi.clearAllMocks());

const ok = () => { A.mockResolvedValueOnce(u(O)); C.mockResolvedValueOnce(cf()); LE.mockResolvedValueOnce(els()); };

describe("AppointmentsPage — T-044 banner (preserved from PR1 stack)", () => {
  it("null session → redirect, no service calls", async () => {
    A.mockResolvedValueOnce(null);
    await expect((await load())({ searchParams: Promise.resolve({ confirmed: UUID }) })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(B).not.toHaveBeenCalled(); expect(LE).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// T-045 PR2d — surface integration (R1.1 / R1.3 / R3.1 / R4.1 / R4.2 / R5.x).
//
// These tests assert on the page-level contract (mock calls, structure,
// data flow). Compound-internal rendering (Intl BA date, badge aria-label,
// "Pagina X de Y", "appointments-empty") is covered by the AppointmentList
// unit suite (`AppointmentList.test.tsx`) which uses RTL to actually
// mount the compound.
//
// Forced-fragmentation note (T-045 PR2 chain):
// PR2a/PR2b/PR2c delivered Root + Card + Badge + Pagination + CSS via
// the AppointmentList compound. PR2d wires them into the page by
// switching the data layer from `listAppointments` to
// `listAppointmentsEnriched`, routing `?page&limit` through
// `parseAppointmentsQuery` (REQ-04 clamp-on-parse), and serializing
// every Date through `toEnrichedJson` before RSC → client crosses.
// ---------------------------------------------------------------------------

describe("AppointmentsPage — T-045 PR2 enrichment", () => {
  it("R1.1 — page pipes enrichedJson camelCase + ISO into the AppointmentList.Root props", async () => {
    ok();
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    // serviceName + vehicleLabel visible as Card props (compound ref)
    expect(j).toContain("Cambio de aceite");
    expect(j).toContain("Toyota Corolla");
    expect(j).toContain("AB123CD");
    // ISO string preserved across RSC → client
    expect(j).toContain("2026-09-10T12:30:00.000Z");
    // ol present in the page-level JSX (rendered by the page, not the compound)
    expect(j).toContain("appointments-list");
    expect(j).toContain("AppointmentListRoot");
  });

  it("R1.3 — fallback strings reach the compound props unchanged", async () => {
    ok();
    LE.mockReset();
    LE.mockResolvedValueOnce(
      els({
        data: [ed({ serviceName: "Servicio no disponible", vehicleLabel: "Vehículo no disponible" })],
        pagination: { total: 1, totalPages: 1 },
      }),
    );
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    expect(j).toContain("Servicio no disponible");
    expect(j).toContain("Vehículo no disponible");
  });

  it("R3.1 — empty enriched list → page renders AppointmentList.Empty (no <ol>)", async () => {
    ok();
    LE.mockReset();
    LE.mockResolvedValueOnce(els({ data: [], pagination: { total: 0, totalPages: 0 } }));
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    // Empty is a function component; its data-testid is rendered inside
    // it, not visible in the JSON tree. The page DOES NOT render the
    // <ol> when appointments.length === 0 (guarded in page.tsx), so
    // appointments-list must be absent.
    expect(j).not.toContain("appointments-list");
    expect(j).toContain("AppointmentListRoot");
  });

  it("R4.1 — pagination envelope (page=2 totalPages=2) is passed through to AppointmentList.Root", async () => {
    ok();
    LE.mockReset();
    LE.mockResolvedValueOnce(els({ pagination: { page: 2, total: 25, totalPages: 2 } }));
    const j = st(await (await load())({ searchParams: Promise.resolve({ page: "2" }) }));
    // Pagination is in the props of AppointmentListRoot
    expect(j).toMatch(/"pagination":\{"page":2,"limit":20,"total":25,"totalPages":2\}/);
    // Pagination component is rendered alongside the ol
    expect(j).toContain("AppointmentListPagination");
  });

  it("R4.2 — ?page=0&limit=101 → clamp to page=1 limit=20 (parseAppointmentsQuery)", async () => {
    ok();
    await (await load())({ searchParams: Promise.resolve({ page: "0", limit: "101" }) });
    expect(LE).toHaveBeenCalledWith(
      expect.objectContaining({ db: {} }),
      { page: 1, limit: 20 },
      expect.objectContaining({ id: O, role: "CLIENTE" }),
    );
  });

  it("R4.2 — ?page=abc&limit=-1 → clamp to defaults (page=1 limit=20)", async () => {
    ok();
    await (await load())({ searchParams: Promise.resolve({ page: "abc", limit: "-1" }) });
    expect(LE).toHaveBeenCalledWith(
      expect.anything(),
      { page: 1, limit: 20 },
      expect.anything(),
    );
  });

  it("R4.2 — valid ?page=2&limit=10 → forwarded verbatim", async () => {
    ok();
    await (await load())({ searchParams: Promise.resolve({ page: "2", limit: "10" }) });
    expect(LE).toHaveBeenCalledWith(
      expect.anything(),
      { page: 2, limit: 10 },
      expect.anything(),
    );
  });

  it("R5.1 — null session → no enriched call, no snake leak", async () => {
    A.mockResolvedValueOnce(null);
    await expect((await load())({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(LE).not.toHaveBeenCalled();
  });

  it("R5.2 — rendered output is free of snake_case / Spanish DB keys (INV-08)", async () => {
    ok();
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    for (const s of SNAKE) expect(j).not.toContain(s);
  });

  it("R5.3 — RSC → client crosses with ISO strings only (INV-06)", async () => {
    ok();
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    expect(j).toContain("2026-09-10T12:30:00.000Z");
  });

  it("INV-03 — page forwards `authUser` (CLIENTE) to listAppointmentsEnriched", async () => {
    ok();
    await (await load())({ searchParams: Promise.resolve({}) });
    const call = LE.mock.calls[0] ?? [];
    expect(call[1]).toEqual({ page: 1, limit: 20 });
    expect(call[2]).toMatchObject({ id: O, role: "CLIENTE" });
  });

  it("INV-06 — page forwards `WorkshopConfig.timezone` to AppointmentList.Root", async () => {
    ok();
    const j = st(await (await load())({ searchParams: Promise.resolve({}) }));
    expect(j).toContain('"timezone":"America/Argentina/Buenos_Aires"');
  });
});