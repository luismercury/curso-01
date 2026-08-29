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
});
