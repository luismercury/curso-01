/**
 * RSC page tests for `src/app/(customer)/appointments/new/page.tsx`
 * (T-041 PR1 + T-042 PR-A + T-043 PR1). Mirrors
 * `services/page.test.tsx` and `vehicles/page.test.tsx`.
 *
 * Covers GWT 1, 2, 8, 10 from `specs/date-selection/spec.md`:
 *   - Shell success — BA today + service resolution (GWT 1).
 *   - Tampered `?date=` fallback (GWT 2: regex, calendar overflow,
 *     past, beyond max).
 *   - Missing serviceId → CTA (GWT 8).
 *   - INV-08 DTO no-leak (camelCase, no `fecha` strings).
 *   - INV-03 auth null → redirect (defensive guard).
 *   - Parallel Promise.all calls (config + listServices issued).
 *   - `?vehicleId=` sibling preservation on Continue href.
 *   - `closedDows` derivation from operatingHours.
 *
 * T-043 PR1 deltas — added to the third describe block:
 *   - Vehicles list wire (Promise.all includes listVehiclesByCustomer).
 *   - Zero-vehicles CTA branch (`?vehicleId=` absent in rendered tree,
 *     `<Link href="/vehicles">` present).
 *   - Auth null still short-circuits before the vehicle fetch.
 *   - INV-08 vehicle no-leak (no `marca`/`patente`/`cliente_id`/
 *     `anio`/`modelo`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addBaDays, getTodayBaYmd } from "@/lib/validators/date";

/** Circular-safe JSON.stringify for RSC trees. The CTA branch uses
 *  `<Link>` (next/link server component) which has a self-referential
 *  `default` export; plain JSON.stringify crashes on those cycles. */
function stringifyTree(tree: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(tree, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    if (typeof value === "function") return `[fn ${(value as { name?: string }).name ?? ""}]`;
    return value;
  });
}

const mockAuth = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockList = vi.fn();
const mockConfig = vi.fn();
const mockFindActive = vi.fn();
const mockGetSlots = vi.fn();
const mockFormatSlots = vi.fn();
// T-043 PR1 — vehicles wire.
const mockListVehicles = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));
vi.mock("@/lib/auth/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/services/servicioService", () => ({
  listServices: (...args: unknown[]) => mockList(...(args as never[])),
}));
vi.mock("@/services/vehicleService", () => ({
  listVehiclesByCustomer: (...args: unknown[]) =>
    mockListVehicles(...(args as never[])),
}));
vi.mock("@/config/workshopConfig", () => ({
  getWorkshopConfig: (...args: unknown[]) => mockConfig(...(args as never[])),
}));
// T-042 — page.tsx now imports server-only modules for the conditional
// availability fetch. Mock them so vitest never loads the real
// `server-only` package, which throws outside a server context.
vi.mock("@/db/repositories/turnos", () => ({
  findActiveTurnosByDateRange: (...args: unknown[]) =>
    mockFindActive(...(args as never[])),
}));
vi.mock("@/services/availability/availabilityService", () => ({
  getAvailableSlotsForDate: (...args: unknown[]) =>
    mockGetSlots(...(args as never[])),
  FetchActiveTurnos: class {},
}));
vi.mock("@/services/availability/slotGenerator", () => ({
  formatSlotsAsHHmm: (slots: unknown, tz: unknown) =>
    mockFormatSlots(slots, tz),
}));

async function loadPage() {
  const mod = await import("@/app/(customer)/appointments/new/page");
  return mod.default;
}

const ID_A = "550e8400-e29b-41d4-a716-446655440000";
const ID_V = "770e8400-e29b-41d4-a716-446655440099";

function sessionUser(id: string) {
  return { user: { id, email: `${id}@x.test`, role: "CLIENTE" as const } };
}

function svcDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ID_A,
    name: "Oil Change",
    description: "Basic oil change",
    durationMinutes: 30,
    active: true,
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    ...overrides,
  };
}

/** Default Mon-Fri working hours; Sat/Sun closed. */
const defaultOperatingHours: Record<number, Array<{ start: string; end: string }>> = {
  0: [], // Sun closed
  1: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  2: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  3: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  4: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  5: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  6: [], // Sat closed
};

function defaultConfig(
  overrides: Partial<{
    timezone: string;
    capacityPerSlot: number;
    slotStepMinutes: number;
    operatingHours: Record<number, Array<{ start: string; end: string }>>;
  }> = {},
) {
  return {
    timezone: "America/Argentina/Buenos_Aires",
    capacityPerSlot: 1,
    slotStepMinutes: 30,
    operatingHours: defaultOperatingHours,
    ...overrides,
  };
}

describe("AppointmentsNewPage — RSC shell (T-041 PR1)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("null session -> redirect('/login'), no DB calls (INV-03 defensive)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(
      Page({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockConfig).not.toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
    expect(mockListVehicles).not.toHaveBeenCalled();
  });

  it("authenticated session -> getWorkshopConfig + listServices + listVehiclesByCustomer in parallel (Promise.all)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([]);
    const Page = await loadPage();
    await Page({ searchParams: Promise.resolve({}) });
    expect(mockConfig).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), {
      includeInactive: false,
    });
    // T-043 PR1: listVehiclesByCustomer also fired in parallel.
    expect(mockListVehicles).toHaveBeenCalledTimes(1);
    expect(mockListVehicles).toHaveBeenCalledWith(expect.anything(), ID_A);
  });

  it("INV-08 — DTO is camelCase English, no snake/Spanish leak in rendered tree", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    // durationMinutes value renders inline as a number (e.g. 30); the
    // camelCase key name itself is not in the visible tree — check the
    // forbidden Spanish/snake names instead. `serviceId` appears as a
    // hidden input name attr.
    expect(json).toContain("serviceId");
    expect(json).toContain("Oil Change");
    expect(json).toContain("30");
    for (const forbidden of [
      "nombre",
      "descripcion",
      "duracionMinutos",
      "activo",
      "fechaHoraInicio",
      "fechaHoraFin",
      "fecha",
      "cliente_id",
      "marca",
      "modelo",
      "anio",
      "patente",
      "created_at",
      "updated_at",
    ]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("valid ?serviceId= matching active service -> renders DateSelector compound, no 500", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    expect(json).toContain("Oil Change");
    // PR2: the page renders <DateSelector> (the compound function ref),
    // not the PR1 <form method=get> placeholder. The island renders the
    // input + banner + clear button — those are verified in detail by
    // DateSelector.test.tsx (jsdom project).
    expect(json).toContain("DateSelectorImpl");
    expect(json).toContain("DateSelectorInput");
    expect(json).toContain("DateSelectorSelectedBanner");
    expect(json).toContain("DateSelectorClearButton");
  });

  it("missing serviceId -> CTA to /services, no DateSelector (GWT 8)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    const json = stringifyTree(tree);
    expect(json).toContain("Select a service first");
    expect(json).toContain("/services");
    // DateSelector must NOT render for missing serviceId — no orphaned input.
    expect(json).not.toContain("DateSelectorImpl");
  });

  it("inactive ?serviceId= -> CTA to /services, no DateSelector (GWT 8)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: false })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    expect(json).toContain("Select a service first");
    expect(json).not.toContain("DateSelectorImpl");
  });

  it("tampered ?date=garbage -> null selectedDate, no 500 (GWT 2)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "garbage" }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    // Banner is hidden when date is null (tampered / past / overflow).
    expect(json).not.toContain("date-selector-banner");
  });

  it("overflow ?date=2026-02-30 -> null selectedDate, no 500 (GWT 2)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-02-30" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("date-selector-banner");
  });

  it("?date=2026-13-40 -> null selectedDate, no 500", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-13-40" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("date-selector-banner");
  });

  it("past ?date=2020-01-01 -> null selectedDate, no banner (GWT past scenario)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2020-01-01" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("date-selector-banner");
  });

  it("future-beyond-max ?date=2099-01-01 -> null selectedDate (max bound guard)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2099-01-01" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("date-selector-banner");
  });

  it("valid ?date= + ?vehicleId= -> DateSelector receives vehicleId + date as props (sibling preservation)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const futureYmd = addBaDays(getTodayBaYmd("America/Argentina/Buenos_Aires"), 7, "America/Argentina/Buenos_Aires");
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        vehicleId: ID_V,
        date: futureYmd,
      }),
    });
    const json = stringifyTree(tree);
    // PR2: the page no longer builds `continueHref` itself — it passes
    // the props through to the DateSelector compound. The island builds
    // the href and preserves siblings (covered in DateSelector.test.tsx).
    expect(json).toContain(ID_V);
    expect(json).toContain(futureYmd);
    expect(json).toContain(ID_A);
  });

  it("closedDows = [0, 6] derived from Mon-Fri default + Sat/Sun []", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    // PR2: the closedDows array `[0, 6]` is passed as a prop to the
    // DateSelector compound. It serializes as the JSON literal `[0,6]`
    // in the React element tree. The human-readable hint
    // "Closed: Sundays, Saturdays." is rendered inside the island and
    // verified by DateSelector.test.tsx (jsdom project).
    expect(json).toContain("[0,6]");
  });

  it("DB failure -> re-throws so error.tsx boundary catches", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockRejectedValueOnce(new Error("DB down"));
    const Page = await loadPage();
    await expect(
      Page({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
  });
});

describe("AppointmentsNewPage — T-042 availability fetch + render", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("valid ?serviceId= + valid ?date= -> fetches slots, renders AvailabilitySlots with primitives", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true, durationMinutes: 60 })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T13:00:00.000Z") },
      { start: new Date("2026-09-09T12:30:00.000Z"), end: new Date("2026-09-09T13:30:00.000Z") },
    ]);
    mockFormatSlots.mockImplementation(
      (slots: Array<{ start: Date }>) =>
        slots.map((s) => {
          const hh = String(s.start.getUTCHours()).padStart(2, "0");
          const mm = String(s.start.getUTCMinutes()).padStart(2, "0");
          return `${hh}:${mm}`;
        }),
    );
    const Page = await loadPage();
    const futureYmd = addBaDays(
      getTodayBaYmd("America/Argentina/Buenos_Aires"),
      7,
      "America/Argentina/Buenos_Aires",
    );
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: futureYmd }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    // AvailabilitySlots compound is rendered (Grid + Empty + SelectedBanner).
    expect(json).toContain("AvailabilitySlotsImpl");
    expect(json).toContain("AvailabilitySlotsGrid");
    expect(json).toContain("AvailabilitySlotsEmpty");
    expect(json).toContain("AvailabilitySlotsSelectedBanner");
    // Domain call invoked exactly once with the noon anchor and the
    // WorkshopConfig-shaped `config` slice.
    expect(mockGetSlots).toHaveBeenCalledTimes(1);
    const slotsCall = mockGetSlots.mock.calls[0]?.[0] as {
      date: Date;
      durationMinutes: number;
      config: { timezone: string; slotStepMinutes: number; capacityPerSlot: number };
      fetchActiveTurnos: unknown;
    };
    expect(slotsCall.date.toISOString()).toBe(`${futureYmd}T12:00:00.000Z`);
    expect(slotsCall.durationMinutes).toBe(60);
    expect(slotsCall.config.timezone).toBe("America/Argentina/Buenos_Aires");
    expect(slotsCall.config.slotStepMinutes).toBe(30);
    expect(slotsCall.config.capacityPerSlot).toBe(1);
    // Adapter wiring is a one-line delegate to the repository — assert the
    // page passes a callable fetchActiveTurnos without depending on the
    // mocked availabilityService to invoke it.
    expect(typeof slotsCall.fetchActiveTurnos).toBe("function");
    // INV-08 — primitive props cross to the client island only. Mocked
    // formatSlotsAsHHmm produces UTC strings; the page propagates them
    // verbatim to AvailabilitySlots so the assertion matches the mock.
    expect(json).toContain("12:00");
    expect(json).toContain("12:30");
    for (const forbidden of [
      "fechaHoraInicio",
      "fechaHoraFin",
      "fecha",
      "cliente_id",
      "duracionMinutos",
      "marca",
      "modelo",
      "anio",
      "patente",
    ]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("tampered ?date= -> null selectedDate -> no domain call (GWT Tampered)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true, durationMinutes: 60 })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-02-30" }),
    });
    const json = stringifyTree(tree);
    expect(json).toContain("DateSelectorImpl");
    expect(json).not.toContain("AvailabilitySlotsImpl");
    expect(mockFindActive).not.toHaveBeenCalled();
    expect(mockGetSlots).not.toHaveBeenCalled();
  });

  it("inactive ?serviceId= -> no domain call (GWT Tampered inactive)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: false })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: addBaDays(getTodayBaYmd("America/Argentina/Buenos_Aires"), 7, "America/Argentina/Buenos_Aires"),
      }),
    });
    const json = stringifyTree(tree);
    expect(json).toContain("Select a service first");
    expect(json).not.toContain("AvailabilitySlotsImpl");
    expect(mockFindActive).not.toHaveBeenCalled();
    expect(mockGetSlots).not.toHaveBeenCalled();
  });

  it("closed Sunday -> getAvailableSlotsForDate returns [] (GWT Closed)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true, durationMinutes: 60 })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    mockGetSlots.mockResolvedValueOnce([]);
    mockFormatSlots.mockReturnValueOnce([]);
    const Page = await loadPage();
    // 2026-09-06 is a Sunday — closed under default operatingHours.
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-09-06" }),
    });
    expect(tree).toBeDefined();
    // Domain still called; the empty-grid resolution happens inside the
    // island (`Empty` chooses "Closed on Sunday" copy because
    // closedDows.includes(getBaDow(Sunday))).
    expect(mockGetSlots).toHaveBeenCalledTimes(1);
    const json = stringifyTree(tree);
    expect(json).toContain("AvailabilitySlotsImpl");
    // Empty island receives `slots=[]` — copy resolved client-side.
    expect(json).toContain("[0,6]");
  });

  it("valid 90min duration -> 11:30+90>12:00 rejected by domain (INV-05)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true, durationMinutes: 90 })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    mockFindActive.mockResolvedValueOnce([]);
    // Domain filters out the 11:30 slot because 11:30 + 90min exceeds 12:00.
    // We mirror the pure core by returning only the slots that survive.
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T13:30:00.000Z") },
    ]);
    mockFormatSlots.mockImplementationOnce(
      (slots: Array<{ start: Date }>) =>
        slots.map((s) => {
          const hh = String(s.start.getUTCHours()).padStart(2, "0");
          const mm = String(s.start.getUTCMinutes()).padStart(2, "0");
          return `${hh}:${mm}`;
        }),
    );
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-09-09" }),
    });
    expect(mockGetSlots).toHaveBeenCalledTimes(1);
    const call = mockGetSlots.mock.calls[0]?.[0] as { durationMinutes: number };
    expect(call.durationMinutes).toBe(90);
    const json = stringifyTree(tree);
    expect(json).toContain("AvailabilitySlotsImpl");
    // The mocked domain returned exactly one slot (12:00Z = 09:00 BA
    // wall). formatSlotsAsHHmm is also mocked and emits UTC strings, so
    // the value crossing the boundary is the verbatim mock output. The
    // assertion verifies the page propagates the format result to the
    // client island without mutation — INV-08 primitive-only contract.
    expect(json).toContain("12:00");
  });

  it("auth still gates the availability fetch (INV-03)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(
      Page({
        searchParams: Promise.resolve({
          serviceId: ID_A,
          date: addBaDays(
            getTodayBaYmd("America/Argentina/Buenos_Aires"),
            7,
            "America/Argentina/Buenos_Aires",
          ),
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockFindActive).not.toHaveBeenCalled();
    expect(mockGetSlots).not.toHaveBeenCalled();
    expect(mockFormatSlots).not.toHaveBeenCalled();
    expect(mockListVehicles).not.toHaveBeenCalled();
  });
});

/** Vehicle DTO factory — mirrors `vehDto` helper used in
 *  `vehicles/page.test.tsx`. Returns the `VehiculoDTO` shape (Spanish
 *  DB-style keys) so we exercise the page's `toVehicleJson` mapper
 *  inside the test (INV-08 transformation is part of the wire). */
function vehDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ID_V,
    customerId: "990e8400-e29b-41d4-a716-446655440077",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    plate: "AB123CD",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AppointmentsNewPage — T-043 PR1 vehicles wire", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("authenticated + vehicles → renders VehicleSelector with primitive props only", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([vehDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    // The VehicleSelector compound renders the statics the page wires
    // (List / SelectedBanner / ClearButton). The Empty static is NOT
    // rendered on the page — the 0-vehicle CTA is owned by the page
    // itself, not by the compound.
    expect(json).toContain("VehicleSelectorImpl");
    expect(json).toContain("VehicleSelectorList");
    expect(json).toContain("VehicleSelectorSelectedBanner");
    expect(json).toContain("VehicleSelectorClearButton");
    expect(json).not.toContain("VehicleSelectorEmpty");
    // Vehicles fetch fired exactly once with the session user id
    // (design D1 — server-direct, no /api hop).
    expect(mockListVehicles).toHaveBeenCalledTimes(1);
    expect(mockListVehicles).toHaveBeenCalledWith(expect.anything(), ID_A);
  });

  it("zero vehicles → CTA to /vehicles, no DateSelector, no AvailabilitySlots (GWT Zero vehicles)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    // The CTA branch must surface the booking-empty-vehicles testid
    // (the page-level CTA) and a link to /vehicles.
    expect(json).toContain("booking-empty-vehicles");
    expect(json).toContain("/vehicles");
    expect(json).toContain("Add a vehicle to book");
    // The booking flow must NOT proceed — DateSelector / AvailabilitySlots
    // / VehicleSelector compounds all stay absent.
    expect(json).not.toContain("DateSelectorImpl");
    expect(json).not.toContain("AvailabilitySlotsImpl");
    expect(json).not.toContain("VehicleSelectorImpl");
  });

  it("zero vehicles → no availability fetch (saves the bulk round-trip)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([]);
    const Page = await loadPage();
    await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-10", // user already picked a date, but no vehicles
      }),
    });
    // 0-vehicles CTA branch returns BEFORE the availability fetch —
    // the page must not call into the domain adapter for nothing.
    expect(mockGetSlots).not.toHaveBeenCalled();
    expect(mockFindActive).not.toHaveBeenCalled();
  });

  it("auth null → redirect('/login') short-circuits BEFORE the vehicles fetch (INV-03)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(
      Page({
        searchParams: Promise.resolve({ serviceId: ID_A }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockListVehicles).not.toHaveBeenCalled();
    expect(mockConfig).not.toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
  });

  it("INV-08 — vehicles wire does not leak marca/modelo/anio/patente/cliente_id through the rendered tree", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    // `listVehiclesByCustomer` (mocked) returns the post-mapped
    // `VehiculoDTO[]` — camelCase English, `Date` for timestamps. The
    // page's `toVehicleJson` mapper emits `VehicleDTOJson` (camelCase
    // English + ISO strings). Both stages keep the keys in camelCase
    // English — the Spanish/snake_case names must never surface.
    mockListVehicles.mockResolvedValueOnce([
      {
        id: ID_V,
        customerId: "990e8400-e29b-41d4-a716-446655440077",
        brand: "Toyota",
        model: "Corolla",
        year: 2020,
        plate: "AB123CD",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    // Spanish / snake_case vehicle keys must NOT appear in the rendered
    // tree. The page maps them to camelCase English via `toVehicleJson`.
    for (const forbidden of [
      "marca",
      "modelo",
      "anio",
      "patente",
      "cliente_id",
    ]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
    // English camelCase keys DO appear as prop names in the React
    // element tree (the page passes them to the VehicleSelector island).
    expect(json).toContain("brand");
    expect(json).toContain("model");
    expect(json).toContain("year");
    expect(json).toContain("plate");
    expect(json).toContain("customerId");
    // Date → ISO conversion happened at the page boundary.
    expect(json).toContain("2026-01-01T00:00:00.000Z");
  });
});

describe("AppointmentsNewPage — T-043 PR2 BookingForm compose (all 4 selections)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("all 4 valid (service + date + slot + vehicle) → BookingForm is composed with primitive props", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([
      svcDto({ id: ID_A, active: true, durationMinutes: 30 }),
    ]);
    // Vehicle's customerId must match the session user id (INV-03
    // ownership) so the page's `isOwner(vehicle, userId)` re-check
    // accepts it. The default vehDto() factory uses a different id
    // — override here.
    mockListVehicles.mockResolvedValueOnce([
      vehDto({ id: ID_V, customerId: ID_A }),
    ]);
    // Domain returns one bookable slot so selectedSlot resolves.
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T12:30:00.000Z") },
    ]);
    mockFormatSlots.mockReturnValueOnce(["09:00"]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-09",
        slot: "09:00",
        vehicleId: ID_V,
      }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    // The page composes the BookingForm compound with the four
    // primitive props + the two display labels (serviceName + vehicleLabel).
    expect(json).toContain("BookingFormImpl");
    expect(json).toContain("BookingFormSummary");
    expect(json).toContain("BookingFormSubmit");
    expect(json).toContain("BookingFormErrorBanner");
    // The service name and vehicle label cross the boundary as plain
    // strings (INV-08 — never `cliente_id` / `fecha*` / `estado`).
    expect(json).toContain("Oil Change");
    // `brand model (year) — plate` shape — the page composes the
    // vehicleLabel string before passing it across.
    expect(json).toContain("Toyota Corolla (2020)");
    expect(json).toContain("AB123CD");
    // The primitive UUIDs propagate to the island.
    expect(json).toContain(ID_A);
    expect(json).toContain(ID_V);
  });

  it("missing slot → BookingForm NOT composed (only 3 of 4 resolve)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([
      vehDto({ id: ID_V, customerId: ID_A }),
    ]);
    mockGetSlots.mockResolvedValueOnce([]);
    mockFormatSlots.mockReturnValueOnce([]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-09",
        vehicleId: ID_V,
      }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("BookingFormImpl");
    expect(json).not.toContain("BookingFormSummary");
    expect(json).not.toContain("BookingFormSubmit");
  });

  it("tampered slot (`25:00`) → BookingForm NOT composed (slotSchema rejects)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([
      vehDto({ id: ID_V, customerId: ID_A }),
    ]);
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T12:30:00.000Z") },
    ]);
    mockFormatSlots.mockReturnValueOnce(["09:00"]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-09",
        slot: "25:00", // tampered — slotSchema rejects
        vehicleId: ID_V,
      }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("BookingFormImpl");
  });

  it("foreign ?vehicleId= → BookingForm NOT composed (isOwner fails)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    // vehicles list only contains the user's own vehicle — the deep-link
    // asks for a foreign UUID that does NOT exist in `vehicles`, so
    // `isOwner` fails on the page side too.
    mockListVehicles.mockResolvedValueOnce([
      vehDto({ id: ID_V, customerId: ID_A }),
    ]);
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T12:30:00.000Z") },
    ]);
    mockFormatSlots.mockReturnValueOnce(["09:00"]);
    const FOREIGN_VEHICLE = "999e8400-e29b-41d4-a716-446655440999";
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-09",
        slot: "09:00",
        vehicleId: FOREIGN_VEHICLE,
      }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("BookingFormImpl");
  });

  it("INV-08 — BookingForm compose keeps the no-leak invariant (no snake/Spanish)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    mockListVehicles.mockResolvedValueOnce([
      vehDto({ id: ID_V, customerId: ID_A }),
    ]);
    mockGetSlots.mockResolvedValueOnce([
      { start: new Date("2026-09-09T12:00:00.000Z"), end: new Date("2026-09-09T12:30:00.000Z") },
    ]);
    mockFormatSlots.mockReturnValueOnce(["09:00"]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({
        serviceId: ID_A,
        date: "2026-09-09",
        slot: "09:00",
        vehicleId: ID_V,
      }),
    });
    const json = stringifyTree(tree);
    // Snake_case + Spanish forbidden names must never surface in the
    // rendered tree — neither on the VehicleSelector compound (PR1)
    // nor on the BookingForm compound (PR2).
    for (const forbidden of [
      "marca",
      "modelo",
      "anio",
      "patente",
      "cliente_id",
      "vehiculo_id",
      "servicio_id",
      "fecha_hora_inicio",
      "fecha_hora_fin",
      "estado",
      "created_at",
      "updated_at",
      "fechaHoraInicio",
      "fechaHoraFin",
    ]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });
});
