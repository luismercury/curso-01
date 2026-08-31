// T-036b PR #2 — PATCH /api/admin/schedule route tests.
// Precedence (H-19 / T-036 admin patterns): 401 → 403 → 400 → 200.
// All DB and auth dependencies are mocked — repo behavior covered by
// src/db/__tests__/workshopSchedules.integration.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const upsertDayScheduleMock = vi.fn();
vi.mock("@/db/repositories/workshopSchedules", async () => {
  const actual =
    await vi.importActual<
      typeof import("@/db/repositories/workshopSchedules")
    >("@/db/repositories/workshopSchedules");
  return {
    ...actual,
    upsertDaySchedule: (...args: unknown[]) =>
      upsertDayScheduleMock(...(args as never[])),
  };
});

const requireAuthMock = vi.fn();
vi.mock("@/lib/auth/requireAuth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/requireAuth")>(
      "@/lib/auth/requireAuth",
    );
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...(args as never[])),
  };
});

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/requireAuth";
import { PATCH } from "@/app/api/admin/schedule/route";

const CLIENTE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "c@c.com",
  role: "CLIENTE" as const,
};
const ADMIN = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "a@a.com",
  role: "ADMINISTRADOR" as const,
};

function makeRequest(body: unknown, rawBody?: string): Request {
  return new Request("http://localhost/api/admin/schedule", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
  });
}

const VALID_BODY = {
  dayOfWeek: 1,
  openIntervals: [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" },
  ],
};

describe("PATCH /api/admin/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue(ADMIN);
    // upsertDaySchedule returns TimeInterval[] (the real repo unwraps via rowToIntervals).
    upsertDayScheduleMock.mockImplementation(
      async (_db: unknown, _dow: number, intervals: unknown) =>
        intervals as Array<{ start: string; end: string }>,
    );
  });

  // ── Precedence: 401 wins over 400 ────────────────────────────────────
  it("401 missing JWT — auth fails before parse even with valid body", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError("Missing token"));
    const r = await PATCH(makeRequest(VALID_BODY));
    expect(r.status).toBe(401);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe(
      "UNAUTHORIZED",
    );
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("401 wins over 400 — invalid body and no token → 401", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError("Missing token"));
    const r = await PATCH(
      makeRequest({ dayOfWeek: 1, openIntervals: [{ start: "25:00", end: "26:00" }] }),
    );
    expect(r.status).toBe(401);
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  // ── Precedence: 403 wins over 400 ────────────────────────────────────
  it("403 CLIENTE — role fails before parse even with valid body", async () => {
    requireAuthMock.mockResolvedValueOnce(CLIENTE);
    const r = await PATCH(makeRequest(VALID_BODY));
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe(
      "FORBIDDEN",
    );
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("403 wins over 400 — invalid body and CLIENTE → 403 not 400", async () => {
    requireAuthMock.mockResolvedValueOnce(CLIENTE);
    const r = await PATCH(
      makeRequest({ dayOfWeek: 1, openIntervals: [{ start: "25:00", end: "26:00" }] }),
    );
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe(
      "FORBIDDEN",
    );
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  // ── 400 validation errors (admin path) ────────────────────────────────
  it("400 overlap — superRefine catches overlapping intervals", async () => {
    const r = await PATCH(
      makeRequest({
        dayOfWeek: 2,
        openIntervals: [
          { start: "09:00", end: "12:00" },
          { start: "11:30", end: "14:00" },
        ],
      }),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: { code: string; issues?: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 start>=end — superRefine catches inverted intervals", async () => {
    const r = await PATCH(
      makeRequest({
        dayOfWeek: 2,
        openIntervals: [{ start: "12:00", end: "09:00" }],
      }),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: { code: string; issues?: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body.error.issues)).toMatch(/start must be before end/);
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 unsorted — superRefine catches unsorted intervals", async () => {
    const r = await PATCH(
      makeRequest({
        dayOfWeek: 2,
        openIntervals: [
          { start: "14:00", end: "18:00" },
          { start: "09:00", end: "12:00" },
        ],
      }),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: { code: string; issues?: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body.error.issues)).toMatch(/sorted by start/);
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 invalid HH:mm — regex catches 25:00 / 99:99", async () => {
    const r = await PATCH(
      makeRequest({
        dayOfWeek: 1,
        openIntervals: [{ start: "25:00", end: "26:00" }],
      }),
    );
    expect(r.status).toBe(400);
    expect(
      ((await r.json()) as { error: { code: string } }).error.code,
    ).toBe("VALIDATION_ERROR");
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 dayOfWeek out of range — 7 / -1 rejected", async () => {
    for (const bad of [7, -1, 1.5]) {
      const r = await PATCH(makeRequest({ dayOfWeek: bad, openIntervals: [] }));
      expect(r.status).toBe(400);
      expect(
        ((await r.json()) as { error: { code: string } }).error.code,
      ).toBe("VALIDATION_ERROR");
    }
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 extra field — strict mode rejects unknown keys", async () => {
    const r = await PATCH(
      makeRequest({
        dayOfWeek: 1,
        openIntervals: [],
        snake: "no-leak",
      }),
    );
    expect(r.status).toBe(400);
    expect(
      ((await r.json()) as { error: { code: string } }).error.code,
    ).toBe("VALIDATION_ERROR");
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  it("400 invalid JSON — malformed body rejected", async () => {
    const r = await PATCH(makeRequest(undefined, "{not-json"));
    expect(r.status).toBe(400);
    expect(
      ((await r.json()) as { error: { code: string } }).error.code,
    ).toBe("VALIDATION_ERROR");
    expect(upsertDayScheduleMock).not.toHaveBeenCalled();
  });

  // ── 200 happy path + idempotency ─────────────────────────────────────
  it("200 ADMIN persists — returns camelCase body matching input", async () => {
    const r = await PATCH(makeRequest(VALID_BODY));
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      dayOfWeek: number;
      openIntervals: { start: string; end: string }[];
    };
    expect(body.dayOfWeek).toBe(1);
    expect(body.openIntervals).toEqual(VALID_BODY.openIntervals);
    expect(upsertDayScheduleMock).toHaveBeenCalledTimes(1);
    expect(upsertDayScheduleMock).toHaveBeenCalledWith(
      expect.anything(),
      1,
      VALID_BODY.openIntervals,
    );
  });

  it("200 idempotent repatch — same payload twice produces same row", async () => {
    const r1 = await PATCH(makeRequest(VALID_BODY));
    const r2 = await PATCH(makeRequest(VALID_BODY));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(upsertDayScheduleMock).toHaveBeenCalledTimes(2);
    expect(upsertDayScheduleMock.mock.calls[0]).toEqual(
      upsertDayScheduleMock.mock.calls[1],
    );
    const b1 = (await r1.json()) as { openIntervals: unknown };
    const b2 = (await r2.json()) as { openIntervals: unknown };
    expect(b1.openIntervals).toEqual(b2.openIntervals);
    expect(b1.openIntervals).toEqual(VALID_BODY.openIntervals);
  });

  it("200 closed day — empty intervals allowed (Sat/Sun etc.)", async () => {
    const r = await PATCH(makeRequest({ dayOfWeek: 0, openIntervals: [] }));
    expect(r.status).toBe(200);
    const body = (await r.json()) as { openIntervals: unknown[] };
    expect(body.openIntervals).toEqual([]);
    expect(upsertDayScheduleMock).toHaveBeenCalledWith(
      expect.anything(),
      0,
      [],
    );
  });

  // ── INV-08: no snake_case leak ───────────────────────────────────────
  it("INV-08 response keys — dayOfWeek / openIntervals only, no snake_case", async () => {
    const r = await PATCH(makeRequest(VALID_BODY));
    const body = (await r.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("dayOfWeek");
    expect(body).toHaveProperty("openIntervals");
    expect(body).not.toHaveProperty("day_of_week");
    expect(body).not.toHaveProperty("open_intervals");
  });

  // ── H-19 precedence: all-in-one 401 → 403 → 400 ─────────────────────
  it("H-19 precedence — same valid body yields 401, 403, 200 in order", async () => {
    // 401
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError("Missing token"));
    const r401 = await PATCH(makeRequest(VALID_BODY));
    expect(r401.status).toBe(401);
    // 403
    requireAuthMock.mockResolvedValueOnce(CLIENTE);
    const r403 = await PATCH(makeRequest(VALID_BODY));
    expect(r403.status).toBe(403);
    // 200 (admin)
    const r200 = await PATCH(makeRequest(VALID_BODY));
    expect(r200.status).toBe(200);
    expect(upsertDayScheduleMock).toHaveBeenCalledTimes(1);
  });

  // ── Auth throw that is not UnauthorizedError / ForbiddenError rethrows ─
  it("rethrows unexpected auth error — does not silently swallow", async () => {
    requireAuthMock.mockRejectedValueOnce(new Error("unexpected"));
    await expect(PATCH(makeRequest(VALID_BODY))).rejects.toThrow("unexpected");
  });
});
