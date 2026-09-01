/**
 * RSC page tests for `src/app/(customer)/appointments/new/page.tsx`
 * (T-041 PR1). Mirrors `services/page.test.tsx` and `vehicles/page.test.tsx`.
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

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));
vi.mock("@/lib/auth/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/services/servicioService", () => ({
  listServices: (...args: unknown[]) => mockList(...(args as never[])),
}));
vi.mock("@/config/workshopConfig", () => ({
  getWorkshopConfig: (...args: unknown[]) => mockConfig(...(args as never[])),
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
  });

  it("authenticated session -> getWorkshopConfig + listServices in parallel (Promise.all)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    await Page({ searchParams: Promise.resolve({}) });
    expect(mockConfig).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), {
      includeInactive: false,
    });
  });

  it("INV-08 — DTO is camelCase English, no snake/Spanish leak in rendered tree", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
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
      "created_at",
      "updated_at",
    ]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("valid ?serviceId= matching active service -> renders DateSelector shell, no 500", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    expect(json).toContain("Oil Change");
    // Form/date input rendered
    expect(json).toContain("appointments-new-form");
  });

  it("missing serviceId -> CTA to /services, no DateSelector (GWT 8)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    const json = stringifyTree(tree);
    expect(json).toContain("Select a service first");
    expect(json).toContain("/services");
    // DateSelector form must NOT render for missing serviceId.
    expect(json).not.toContain("appointments-new-form");
  });

  it("inactive ?serviceId= -> CTA to /services, no DateSelector (GWT 8)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: false })]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    expect(json).toContain("Select a service first");
    expect(json).not.toContain("appointments-new-form");
  });

  it("tampered ?date=garbage -> null selectedDate, no 500 (GWT 2)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "garbage" }),
    });
    expect(tree).toBeDefined();
    const json = stringifyTree(tree);
    expect(json).not.toContain("appointments-new-banner");
  });

  it("overflow ?date=2026-02-30 -> null selectedDate, no 500 (GWT 2)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-02-30" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("appointments-new-banner");
  });

  it("?date=2026-13-40 -> null selectedDate, no 500", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2026-13-40" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("appointments-new-banner");
  });

  it("past ?date=2020-01-01 -> null selectedDate, no banner (GWT past scenario)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2020-01-01" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("appointments-new-banner");
  });

  it("future-beyond-max ?date=2099-01-01 -> null selectedDate (max bound guard)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A, date: "2099-01-01" }),
    });
    const json = stringifyTree(tree);
    expect(json).not.toContain("appointments-new-banner");
  });

  it("valid ?date= + ?vehicleId= -> Continue href preserves both params (sibling preservation)", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
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
    expect(json).toContain("vehicleId=" + ID_V);
    expect(json).toContain("date=" + futureYmd);
    expect(json).toContain("serviceId=" + ID_A);
  });

  it("closedDows = [0, 6] derived from Mon-Fri default + Sat/Sun []", async () => {
    mockAuth.mockResolvedValueOnce(sessionUser(ID_A));
    mockConfig.mockResolvedValueOnce(defaultConfig());
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({
      searchParams: Promise.resolve({ serviceId: ID_A }),
    });
    const json = stringifyTree(tree);
    // The hint copy mentions "Sunday" + "Saturday" — only when closedDows
    // includes [0, 6].
    expect(json).toContain("Sunday");
    expect(json).toContain("Saturday");
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
