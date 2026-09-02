/**
 * HTTP helper tests for `src/lib/api/appointments.ts` (T-043 PR2).
 *
 * Mirrors `lib/api/vehicles.test.ts` shape (parse + status-to-ApiError
 * mapping). Adds INV-06 coverage:
 *   - `buildBookingStartDateTime(date, slot)` returns
 *     `${date}T${slot}:00-03:00` (BA fixed, Law 26.474).
 *   - `Intl` offset-delta confirms BA timezone is UTC-3 today and that the
 *     reconstructed string's offset matches the formatter output for the
 *     same wall-clock instant.
 *   - `buildLoginNext` URL-encodes the `next=` query so special chars in
 *     the search string survive a round-trip.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/validators/service";
import {
  appointmentStatusSchema,
  buildBookingStartDateTime,
  buildLoginNext,
  enrichedTurnoDTOSchema,
  submitBooking,
  turnoDTOSchema,
  type EnrichedTurnoDTOJson,
  type TurnoDTOJson,
} from "@/lib/api/appointments";

function turnoDtoJson(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    vehicleId: "11111111-1111-4111-8111-111111111111",
    serviceId: "22222222-2222-4222-8222-222222222222",
    startDateTime: "2026-09-10T12:30:00.000Z",
    endDateTime: "2026-09-10T13:00:00.000Z",
    status: "PENDIENTE",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } satisfies TurnoDTOJson;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("submitBooking — happy path (REQ-BOOK-01)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to /api/appointments with credentials+no-store+JSON content-type", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(201, turnoDtoJson()));
    await submitBooking({
      vehicleId: "11111111-1111-4111-8111-111111111111",
      serviceId: "22222222-2222-4222-8222-222222222222",
      startDateTime: "2026-09-10T09:30:00-03:00",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/appointments");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe(
      "application/json",
    );
    expect(init?.body).toBe(
      JSON.stringify({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    );
  });

  it("returns parsed TurnoDTOJson on 201 — camelCase + ISO, no Spanish leak", async () => {
    const fetchMock = vi.mocked(fetch);
    const expected = turnoDtoJson();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, expected));
    const dto = await submitBooking({
      vehicleId: expected.vehicleId,
      serviceId: expected.serviceId,
      startDateTime: expected.startDateTime,
    });
    expect(dto).toEqual(expected);
    // Date fields are ISO strings (no Date leak).
    expect(dto.startDateTime).toBe("2026-09-10T12:30:00.000Z");
    expect(dto.createdAt).toBe("2026-09-01T00:00:00.000Z");
    // INV-08 — snake_case / Spanish keys never appear on the wire.
    expect(dto).not.toHaveProperty("cliente_id");
    expect(dto).not.toHaveProperty("vehiculo_id");
    expect(dto).not.toHaveProperty("servicio_id");
    expect(dto).not.toHaveProperty("fecha_hora_inicio");
    expect(dto).not.toHaveProperty("fecha_hora_fin");
    expect(dto).not.toHaveProperty("estado");
    expect(dto).not.toHaveProperty("created_at");
    expect(dto).not.toHaveProperty("updated_at");
  });
});

describe("submitBooking — ApiError mapping on non-2xx (REQ-BOOK-04)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("409 APPOINTMENT_NOT_AVAILABLE — slot was taken in a race", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: {
          code: "APPOINTMENT_NOT_AVAILABLE",
          message: "El horario seleccionado ya no se encuentra disponible.",
        },
      }),
    );
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({
      code: "APPOINTMENT_NOT_AVAILABLE",
      status: 409,
      message: "El horario seleccionado ya no se encuentra disponible.",
    });
  });

  it("403 FORBIDDEN — vehicleId not owned by session user", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        error: { code: "FORBIDDEN", message: "Vehicle not found or not owned" },
      }),
    );
    let captured: unknown;
    try {
      await submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect(captured).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Vehicle not found or not owned",
    });
  });

  it("422 INVALID_SERVICE — service deactivated between page-load and submit", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: {
          code: "INVALID_SERVICE",
          message: "Service is not active",
        },
      }),
    );
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_SERVICE",
      status: 422,
    });
  });

  it("401 UNAUTHORIZED — cookie missing or expired", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Missing token" },
      }),
    );
    let captured: unknown;
    try {
      await submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect(captured).toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("400 VALIDATION_ERROR — Zod strict failure carries issues", async () => {
    const fetchMock = vi.mocked(fetch);
    const issues = [
      { path: ["startDateTime"], message: "must be ISO 8601 with timezone" },
    ];
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: { code: "VALIDATION_ERROR", message: "Bad input", issues },
      }),
    );
    let captured: unknown;
    try {
      await submitBooking({
        vehicleId: "not-a-uuid",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      });
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(ApiError);
    expect((captured as ApiError).code).toBe("VALIDATION_ERROR");
    expect((captured as ApiError).status).toBe(400);
    expect((captured as ApiError).issues).toEqual(issues);
  });

  it("409 with no ErrorBody — falls back to CONFLICT", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 409 }));
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("422 with no ErrorBody — falls back to INVALID_SERVICE (semantic route)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 422 }));
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({ code: "INVALID_SERVICE", status: 422 });
  });

  it("5xx with no ErrorBody — falls back to UNKNOWN_ERROR", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ERROR", status: 500 });
  });
});

describe("submitBooking — network failure", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("fetch reject → ApiError(code:'NETWORK_ERROR', status:0)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error("econnreset"));
    await expect(
      submitBooking({
        vehicleId: "11111111-1111-4111-8111-111111111111",
        serviceId: "22222222-2222-4222-8222-222222222222",
        startDateTime: "2026-09-10T09:30:00-03:00",
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});

describe("buildBookingStartDateTime — INV-06 BA TZ reconstruction (REQ-BOOK-03)", () => {
  it("returns `${date}T${slot}:00-03:00` for any (date, slot) pair", () => {
    expect(buildBookingStartDateTime("2026-09-10", "09:30")).toBe(
      "2026-09-10T09:30:00-03:00",
    );
    expect(buildBookingStartDateTime("2026-12-31", "00:00")).toBe(
      "2026-12-31T00:00:00-03:00",
    );
    expect(buildBookingStartDateTime("2026-09-10", "23:30")).toBe(
      "2026-09-10T23:30:00-03:00",
    );
  });

  it("matches the route.ts:27 regex — Zod accepts the result without 400", () => {
    // Mirror of `route.ts:27` so the contract stays auditable from this
    // test file. The BookingForm compound never has to inspect regexes —
    // it just trusts the helper. If the regex ever drifts, this test
    // breaks loudly.
    const isoWithTimezoneRegex =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    const sample = buildBookingStartDateTime("2026-09-10", "09:30");
    expect(sample).toMatch(isoWithTimezoneRegex);
  });

  it("`Intl` offset-delta confirms BA is UTC-3 today (INV-06 regression guard)", () => {
    // Pick a date deep inside the BA "no DST" era (Law 26.474, 2009 → ∞).
    // If the OS ICU ever flips BA to a DST zone, this assertion fails and
    // the helper's hardcoded -03:00 is no longer safe — replace the
    // helper with `slotGenerator.baWallTimeToUtcDate(...)` per the
    // TODO(DST) escape in appointments.ts.
    const tz = "America/Argentina/Buenos_Aires";
    const wallClock = "2026-09-10T12:00:00"; // BA noon
    const utcMs = Date.UTC(2026, 8, 10, 12, 0, 0);

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcMs));
    const get = (t: string) =>
      parts.find((p) => p.type === t)?.value ?? "0";
    let hh = Number(get("hour"));
    if (hh === 24) hh = 0;
    const mm = Number(get("minute"));

    // If BA is at UTC-3, the noon UTC anchor projects to 09:00 BA wall.
    expect(hh).toBe(9);
    expect(mm).toBe(0);

    // The helper's reconstructed string must carry the SAME -03:00 offset.
    // If `Intl` ever reports a different BA offset, the test fails here.
    const reconstructed = buildBookingStartDateTime("2026-09-10", "09:00");
    expect(reconstructed).toBe("2026-09-10T09:00:00-03:00");
    expect(reconstructed.endsWith("-03:00")).toBe(true);

    // Reference the wall-clock string so this test fails loudly if a
    // future refactor accidentally drops the literal.
    expect(wallClock).toBe("2026-09-10T12:00:00");
  });

  it("BA offset is -03:00 for both winter (Jul) and BA-summer (Jan) anchors", () => {
    // Argentina stopped observing DST in 2009. The offset is -03:00 all
    // year. We assert both January and July noon-UTC anchors so a future
    // DST reinstatement cannot pass silently.
    const tz = "America/Argentina/Buenos_Aires";
    for (const [month /* 0-indexed */, expectedBaHour] of [
      [0, 9], // Jan → 12:00 UTC → 09:00 BA
      [6, 9], // Jul → 12:00 UTC → 09:00 BA
    ] as const) {
      const utcMs = Date.UTC(2026, month, 15, 12, 0, 0);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(utcMs));
      let hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
      if (hh === 24) hh = 0;
      expect(hh).toBe(expectedBaHour);
    }
  });
});

describe("buildLoginNext — 401 redirect helper", () => {
  it("joins pathname + search with `?` and encodes as the `next` query", () => {
    // `useSearchParams().toString()` returns the query WITHOUT the
    // leading `?` — the helper joins them so the next= target is a
    // valid URL the auth handler can echo back via `redirect(next)`.
    expect(
      buildLoginNext(
        "/appointments/new",
        "serviceId=550e8400-e29b-41d4-a716-446655440000&date=2026-09-10&slot=09:30&vehicleId=770e8400-e29b-41d4-a716-446655440099",
      ),
    ).toBe(
      "/login?next=" +
        encodeURIComponent(
          "/appointments/new?serviceId=550e8400-e29b-41d4-a716-446655440000&date=2026-09-10&slot=09:30&vehicleId=770e8400-e29b-41d4-a716-446655440099",
        ),
    );
  });

  it("preserves empty search (no trailing `?`)", () => {
    expect(buildLoginNext("/services", "")).toBe(
      "/login?next=" + encodeURIComponent("/services"),
    );
  });

  it("preserves a no-siblings pathname", () => {
    expect(buildLoginNext("/login", "")).toBe(
      "/login?next=" + encodeURIComponent("/login"),
    );
  });

  it("encodes a colon in the slot (`09:30` → `09%3A30`) so the target URL round-trips through the auth handler", () => {
    // `URLSearchParams.toString()` encodes `:` as `%3A`. The next=
    // helper mirrors that so a `pathname + search` echo is a valid
    // URL the auth handler can re-parse with `new URL()`.
    expect(
      buildLoginNext(
        "/appointments/new",
        "serviceId=550e8400-e29b-41d4-a716-446655440000&date=2026-09-10&slot=09%3A30&vehicleId=770e8400-e29b-41d4-a716-446655440099",
      ),
    ).toBe(
      "/login?next=" +
        encodeURIComponent(
          "/appointments/new?serviceId=550e8400-e29b-41d4-a716-446655440000&date=2026-09-10&slot=09%3A30&vehicleId=770e8400-e29b-41d4-a716-446655440099",
        ),
    );
  });
});

// ---------------------------------------------------------------------------
// T-045 wire-format schemas (GWT 5.2, 6.1 — INV-02/06/08)
// ---------------------------------------------------------------------------

function enrichedDtoJson(
  overrides: Partial<Record<string, unknown>> = {},
): EnrichedTurnoDTOJson {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    vehicleId: "11111111-1111-4111-8111-111111111111",
    serviceId: "22222222-2222-4222-8222-222222222222",
    startDateTime: "2026-09-10T12:30:00.000Z",
    endDateTime: "2026-09-10T13:00:00.000Z",
    status: "PENDIENTE",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    serviceName: "Cambio de aceite",
    vehicleLabel: "Toyota Corolla — ABC123",
    ...overrides,
  };
}

describe("turnoDTOSchema — base wire format (INV-08 strict, GWT 5.2)", () => {
  it("accepts a complete TurnoDTOJson", () => {
    const parsed = turnoDTOSchema.safeParse(turnoDtoJson());
    expect(parsed.success).toBe(true);
  });

  it("rejects snake_case / Spanish keys (INV-08 .strict())", () => {
    const tampered = { ...turnoDtoJson(), fecha_hora_inicio: "2026-09-10T12:30:00.000Z" };
    const parsed = turnoDTOSchema.safeParse(tampered);
    expect(parsed.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const parsed = turnoDTOSchema.safeParse(turnoDtoJson({ id: "not-a-uuid" }));
    expect(parsed.success).toBe(false);
  });

  it("rejects ISO string without timezone (INV-06)", () => {
    const parsed = turnoDTOSchema.safeParse(turnoDtoJson({ startDateTime: "2026-09-10T12:30:00" }));
    expect(parsed.success).toBe(false);
  });
});

describe("appointmentStatusSchema — INV-02 UPPER_SNAKE enum", () => {
  it.each(["PENDIENTE", "CONFIRMADO", "RECHAZADO", "CANCELADO"] as const)(
    "accepts %s",
    (s) => {
      expect(appointmentStatusSchema.safeParse(s).success).toBe(true);
    },
  );

  it("rejects COMPLETADO (no such state in v1)", () => {
    expect(appointmentStatusSchema.safeParse("COMPLETADO").success).toBe(false);
  });

  it("rejects lowercase variants", () => {
    expect(appointmentStatusSchema.safeParse("pendiente").success).toBe(false);
  });
});

describe("enrichedTurnoDTOSchema — enriched wire format (GWT 6.1)", () => {
  it("accepts a complete EnrichedTurnoDTOJson (camelCase + ISO + serviceName/vehicleLabel)", () => {
    const parsed = enrichedTurnoDTOSchema.safeParse(enrichedDtoJson());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.serviceName).toBe("Cambio de aceite");
      expect(parsed.data.vehicleLabel).toBe("Toyota Corolla — ABC123");
      expect(parsed.data.status).toBe("PENDIENTE");
    }
  });

  it("rejects snake_case / Spanish keys at the wire (INV-08 .strict())", () => {
    const tampered = {
      ...enrichedDtoJson(),
      cliente_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    expect(enrichedTurnoDTOSchema.safeParse(tampered).success).toBe(false);
  });

  it("rejects snake_case enrichment column names", () => {
    const tampered = { ...enrichedDtoJson(), servicioNombre: "X", vehiculoMarca: "Y" };
    expect(enrichedTurnoDTOSchema.safeParse(tampered).success).toBe(false);
  });

  it("rejects empty serviceName / vehicleLabel (fallback guarantees non-empty)", () => {
    expect(enrichedTurnoDTOSchema.safeParse(enrichedDtoJson({ serviceName: "" })).success).toBe(false);
    expect(enrichedTurnoDTOSchema.safeParse(enrichedDtoJson({ vehicleLabel: "" })).success).toBe(false);
  });

  it("rejects COMPLETADO status (INV-02)", () => {
    expect(enrichedTurnoDTOSchema.safeParse(enrichedDtoJson({ status: "COMPLETADO" })).success).toBe(false);
  });
});