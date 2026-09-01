/**
 * RSC page tests for `src/app/(customer)/services/page.tsx` (PR3).
 * Mirrors `vehicles/page.test.tsx`. Validates the RSC shell + `toJson` + safeParse+find(active) contract.
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
vi.mock("@/services/servicioService", () => ({
  listServices: (...args: unknown[]) => mockList(...(args as never[])),
}));

async function loadPage() {
  const mod = await import("@/app/(customer)/services/page");
  return mod.default;
}

const ID_A = "550e8400-e29b-41d4-a716-446655440000";
const ID_B = "660e8400-e29b-41d4-a716-446655440001";

function sessionUser(id: string) {
  return { user: { id, email: `${id}@x.test`, role: "CLIENTE" as const } };
}

function svcDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ID_A, name: "Oil Change", description: "Basic oil change",
    durationMinutes: 30, active: true,
    createdAt: new Date("2026-08-25T13:00:00.000Z"),
    updatedAt: new Date("2026-08-25T14:30:00.000Z"),
    ...overrides,
  };
}

describe("ServicesPage — RSC shell (PR3)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("null session -> redirect('/login'), service never called (401 before any fetch)", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const Page = await loadPage();
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockList).not.toHaveBeenCalled();
  });

  it("authenticated session -> listServices called with (db,{includeInactive:false})", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    await Page({ searchParams: Promise.resolve({}) });
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), { includeInactive: false });
  });

  it("Date -> ISO serialization on rendered tree (INV-06)", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);
    expect(json).toMatch(/"createdAt":"2026-08-25T13:00:00\.000Z"/);
    expect(json).toMatch(/"updatedAt":"2026-08-25T14:30:00\.000Z"/);
    expect(json).not.toContain("\"createdAt\":{");
  });

  it("INV-08 — DTO is camelCase English, no snake/Spanish leak", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([svcDto()]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);
    expect(json).toContain("name");
    expect(json).toContain("durationMinutes");
    expect(json).toContain("active");
    for (const forbidden of ["nombre", "descripcion", "duracionMinutos", "activo", "cliente_id", "created_at", "updated_at", "fecha"]) {
      expect(json, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("ASC ordering — server-supplied order is preserved (page does not resort)", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([
      svcDto({ id: ID_B, name: "B", createdAt: new Date("2026-12-01T00:00:00.000Z") }),
      svcDto({ id: ID_A, name: "A", createdAt: new Date("2026-01-01T00:00:00.000Z") }),
    ]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);
    expect(json.indexOf(`"id":"${ID_B}"`)).toBeLessThan(json.indexOf(`"id":"${ID_A}"`));
  });

  it("valid ?serviceId= matching active service — does not crash, renders", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({ serviceId: ID_A }) });
    expect(tree).toBeDefined();
    expect(JSON.stringify(tree)).toContain(ID_A);
  });

  it("tampered ?serviceId=garbage — does not crash, no selection propagation", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([svcDto({ id: ID_A, active: true })]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({ serviceId: "garbage" }) });
    expect(tree).toBeDefined();
    expect(JSON.stringify(tree)).toContain(ID_A); // list still rendered
  });

  it("empty list — renders 'No services available'", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockResolvedValueOnce([]);
    const Page = await loadPage();
    const tree = await Page({ searchParams: Promise.resolve({}) });
    expect(JSON.stringify(tree)).toContain("No services available");
  });

  it("service failure -> re-throws so error.tsx can render", async () => {
    const id = "770e8400-e29b-41d4-a716-4466554400aa";
    mockAuth.mockResolvedValueOnce(sessionUser(id));
    mockList.mockRejectedValueOnce(new Error("DB down"));
    const Page = await loadPage();
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("Failed to load services");
  });
});