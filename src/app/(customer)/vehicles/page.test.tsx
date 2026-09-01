/**
 * RSC page tests for `src/app/(customer)/vehicles/page.tsx` (PR3).
 *
 * Pure node: mocks `auth()` and `redirect()` (Next navigation) plus the
 * service. Validates the INV-03 ownership golden rule and the
 * 401-before-403 precedence contract:
 *  - null session -> `redirect('/login')` is called, service is never invoked.
 *  - authenticated session -> service is called with the session user id.
 *  - Date objects are converted to ISO strings before reaching the client.
 *  - 401 (no session) takes precedence over any later 403 path: the redirect
 *    happens before the service has a chance to throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockList = vi.fn();

vi.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));
vi.mock("@/lib/auth/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/services/vehicleService", () => ({
  listVehiclesByCustomer: (...args: unknown[]) => mockList(...args),
}));
vi.mock("@/lib/validators/vehicle", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validators/vehicle")>("@/lib/validators/vehicle");
  return { ...actual, maxYear: () => 2026 };
});

async function loadPage() {
  const mod = await import("@/app/(customer)/vehicles/page");
  return mod.default;
}

function sessionUser(id: string) {
  return { user: { id, email: `${id}@x.test`, role: "CLIENTE" as const } };
}

describe("VehiclesPage — RSC shell (PR3)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("null session -> redirect('/login'), service never called (401 before any fetch)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockList).not.toHaveBeenCalled();
  });

  it("null session.user (no id) -> redirect('/login')", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: undefined } });
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockList).not.toHaveBeenCalled();
  });

  it("authenticated session -> service called with customerId from session.user.id", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([
      {
        id: "660e8400-e29b-41d4-a716-446655440002",
        customerId: id,
        brand: "Toyota",
        model: "Corolla",
        year: 2024,
        plate: "ABC123",
        createdAt: new Date("2026-08-25T13:00:00.000Z"),
        updatedAt: new Date("2026-08-25T14:30:00.000Z"),
      },
    ]);
    const Page = await loadPage();
    const tree = await Page();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), id);
    const serialized = JSON.stringify(tree);
    expect(serialized).toContain("2026-08-25T13:00:00.000Z");
    expect(serialized).toContain("2026-08-25T14:30:00.000Z");
    expect(serialized).not.toContain("marca");
    expect(serialized).not.toContain("patente");
    expect(serialized).not.toContain("cliente_id");
    expect(serialized).not.toContain("created_at");
    expect(serialized).toContain("brand");
    expect(serialized).toContain("plate");
    expect(serialized).toContain("customerId");
  });

  it("Date -> ISO serialization: createdAt is an ISO string on the rendered tree", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([
      {
        id: "660e8400-e29b-41d4-a716-446655440002",
        customerId: id,
        brand: "F",
        model: "M",
        year: 2024,
        plate: "ABC123",
        createdAt: new Date("2026-08-25T13:00:00.000Z"),
        updatedAt: new Date("2026-08-25T14:30:00.000Z"),
      },
    ]);
    const Page = await loadPage();
    const tree = await Page();
    const json = JSON.stringify(tree);
    expect(json).toMatch(/"createdAt":"2026-08-25T13:00:00\.000Z"/);
    expect(json).toMatch(/"updatedAt":"2026-08-25T14:30:00\.000Z"/);
    expect(json).not.toContain("\"createdAt\":{");
  });

  it("401-before-403 precedence: null session never reaches the service", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockList).not.toHaveBeenCalled();
  });

  it("service failure -> re-throws so error.tsx can render", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockRejectedValueOnce(new Error("DB down"));
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("Failed to load vehicles");
  });
});