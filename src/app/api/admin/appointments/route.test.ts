// H-19 anchor: T-036 admin pending view reuses T-033 filter via `?status=PENDIENTE`. T-033 archived 2026-08-28; delta NONE.
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
const listMock = vi.fn();
vi.mock("@/services/appointmentService", async () => {
  const a = await vi.importActual<typeof import("@/services/appointmentService")>("@/services/appointmentService");
  return { ...a, listAppointments: (...x: unknown[]) => listMock(...(x as never[])) };
});
const authMock = vi.fn();
vi.mock("@/lib/auth/requireAuth", async () => {
  const a = await vi.importActual<typeof import("@/lib/auth/requireAuth")>("@/lib/auth/requireAuth");
  return { ...a, requireAuth: (...x: unknown[]) => authMock(...(x as never[])) };
});
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/requireAuth";
import { GET } from "@/app/api/admin/appointments/route";
const CLIENTE = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "c@c.com", role: "CLIENTE" as const };
const ADMIN = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "a@a.com", role: "ADMINISTRADOR" as const };
const dto = { id: "33333333-3333-4333-8333-333333333333", customerId: CLIENTE.id, vehicleId: "11111111-1111-4111-8111-111111111111", serviceId: "22222222-2222-4222-8222-222222222222", startDateTime: new Date("2026-09-10T13:00:00Z"), endDateTime: new Date("2026-09-10T14:00:00Z"), status: "PENDIENTE", createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z") };

describe("GET /api/admin/appointments", () => {
  beforeEach(() => { vi.clearAllMocks(); authMock.mockResolvedValue(ADMIN); listMock.mockResolvedValue({ data: [dto], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }); });
  it("ADMIN 200 sees all", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments", { method: "GET" }));
    expect(r.status).toBe(200); const j = (await r.json()) as { data: unknown[]; pagination: unknown };
    expect(j).toHaveProperty("data"); expect(listMock).toHaveBeenCalledTimes(1);
    expect((listMock.mock.calls[0] as unknown as [unknown, unknown, typeof ADMIN])[2].role).toBe("ADMINISTRADOR");
  });
  it("CLIENTE =>403", async () => {
    authMock.mockResolvedValue(CLIENTE);
    const r = await GET(new Request("http://localhost/api/admin/appointments", { method: "GET" }));
    expect(r.status).toBe(403); expect(((await r.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN"); expect(listMock).not.toHaveBeenCalled();
  });
  it("unauth 401", async () => {
    authMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const r = await GET(new Request("http://localhost/api/admin/appointments", { method: "GET" }));
    expect(r.status).toBe(401); expect(listMock).not.toHaveBeenCalled();
  });
  it("401 before 400", async () => {
    authMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const r = await GET(new Request("http://localhost/api/admin/appointments?limit=101", { method: "GET" }));
    expect(r.status).toBe(401);
  });
  it("400 on bad query", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments?status=CANCELADO", { method: "GET" }));
    expect(r.status).toBe(400); expect(((await r.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });
  it("filter passthrough", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments?status=CANCELADO&includeCancelled=true&sort=desc", { method: "GET" }));
    expect(r.status).toBe(200); const q = (listMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1];
    expect(q.status).toBe("CANCELADO"); expect(q.includeCancelled).toBe(true); expect(q.sort).toBe("desc");
  });
  it("CLIENTE with invalid limit still 403 not 400", async () => {
    authMock.mockResolvedValue(CLIENTE);
    const r = await GET(new Request("http://localhost/api/admin/appointments?limit=101", { method: "GET" }));
    expect(r.status).toBe(403);
  });
  it("no snake leak", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments", { method: "GET" }));
    const j = (await r.json()) as { data: Record<string, unknown>[] };
    expect(j.data[0]).toHaveProperty("customerId"); expect(j.data[0]).not.toHaveProperty("cliente_id");
  });

  // H-19 / Trace 1 — admin pending view reuses T-033 filter; pagination H-28; INV-08 camelCase.
  it("ADMIN pending view — status=PENDIENTE 200", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc", { method: "GET" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j).toHaveProperty("data");
    expect(j.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(listMock).toHaveBeenCalledTimes(1);
    const args = listMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>, typeof ADMIN];
    expect(args[1].status).toBe("PENDIENTE");
    expect(args[1].sort).toBe("startAt:asc");
    expect(args[2].role).toBe("ADMINISTRADOR");
    // INV-08 negative: no snake_case leak in DTO
    expect(j.data[0]).not.toHaveProperty("estado");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_inicio");
  });

  // H-19 / Traces 3+4 — precedence 401→403→400 with status=PENDIENTE&limit=101.
  it("pending precedence — 401→403→400 with status=PENDIENTE&limit=101", async () => {
    const url = "http://localhost/api/admin/appointments?status=PENDIENTE&limit=101";
    // 401 wins over 400: unauth returns 401 before validation
    authMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const r401 = await GET(new Request(url, { method: "GET" }));
    expect(r401.status).toBe(401);
    expect(((await r401.json()) as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    // 403 wins over 400: CLIENTE on admin returns 403 before validation
    authMock.mockResolvedValue(CLIENTE);
    const r403 = await GET(new Request(url, { method: "GET" }));
    expect(r403.status).toBe(403);
    expect(((await r403.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    // ADMIN with limit=101 reaches Zod validation → 400 VALIDATION_ERROR
    authMock.mockResolvedValue(ADMIN);
    const r400 = await GET(new Request(url, { method: "GET" }));
    expect(r400.status).toBe(400);
    expect(((await r400.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    // listMock only reachable for ADMIN 200 path (none in this precedence test)
    expect(listMock).not.toHaveBeenCalled();
  });

  // H-19 / T-037 / Trace 1 — admin agenda via ?date=YYYY-MM-DD reuse (H-27+H-28).
  // Daily agenda = T-033 paginated query with `date` filter; BA half-open + gt(now)
  // applied in findTurnosPaginated via getBaDayUtcRange (asserted via date pass-through).
  it("agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc", { method: "GET" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(listMock).toHaveBeenCalledTimes(1);
    const args = listMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>, typeof ADMIN];
    expect(args[1]).toMatchObject({ date: "2026-09-10", page: 1, limit: 20, sort: "startAt:asc" });
    expect(args[2].role).toBe("ADMINISTRADOR");
    expect(j.data).toHaveLength(1);
  });

  // H-11 / T-037 / Trace 3 — agenda ?date= include* flags default false / each / both.
  it("agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037", async () => {
    const cases: Array<{ url: string; inc: boolean; rej: boolean }> = [
      { url: "?date=2026-09-10&page=1&limit=20&sort=startAt:asc", inc: false, rej: false },
      { url: "?date=2026-09-10&includeCancelled=true", inc: true, rej: false },
      { url: "?date=2026-09-10&includeRejected=true", inc: false, rej: true },
      { url: "?date=2026-09-10&includeCancelled=true&includeRejected=true", inc: true, rej: true },
    ];
    for (const c of cases) {
      await GET(new Request(`http://localhost/api/admin/appointments${c.url}`, { method: "GET" }));
      const args = listMock.mock.calls.at(-1) as unknown as [unknown, Record<string, unknown>, typeof ADMIN];
      expect(args[1]).toMatchObject({ date: "2026-09-10", includeCancelled: c.inc, includeRejected: c.rej });
    }
    expect(listMock).toHaveBeenCalledTimes(4);
  });

  // T-037 / Trace 4 — agenda ?date=&limit=101 precedence 401→403→400 (mirrors T-036 pattern).
  it("agenda ?date=&limit=101 precedence 401→403→400 — T-037", async () => {
    const url = "http://localhost/api/admin/appointments?date=2026-09-10&limit=101";
    authMock.mockRejectedValue(new UnauthorizedError("Missing token"));
    const r401 = await GET(new Request(url, { method: "GET" }));
    expect(r401.status).toBe(401);
    expect(((await r401.json()) as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
    authMock.mockResolvedValue(CLIENTE);
    const r403 = await GET(new Request(url, { method: "GET" }));
    expect(r403.status).toBe(403);
    expect(((await r403.json()) as { error: { code: string } }).error.code).toBe("FORBIDDEN");
    authMock.mockResolvedValue(ADMIN);
    const r400 = await GET(new Request(url, { method: "GET" }));
    expect(r400.status).toBe(400);
    expect(((await r400.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(listMock).not.toHaveBeenCalled();
  });

  // INV-08/H-28 / T-037 / Trace 5 — agenda ?date= no snake leak + envelope.
  it("agenda ?date= INV-08 no snake leak + H-28 envelope — T-037", async () => {
    const r = await GET(new Request("http://localhost/api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc", { method: "GET" }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: Record<string, unknown>[]; pagination: Record<string, unknown> };
    expect(j.data[0]).toMatchObject({ status: "PENDIENTE", customerId: CLIENTE.id });
    expect(j.data[0]).toHaveProperty("startDateTime");
    expect(j.data[0]).toHaveProperty("endDateTime");
    expect(j.data[0]).not.toHaveProperty("estado");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_inicio");
    expect(j.data[0]).not.toHaveProperty("fecha_hora_fin");
    expect(j).toMatchObject({ pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });
});
