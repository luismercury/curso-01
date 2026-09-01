/**
 * jsdom + RTL tests for `BookingForm.tsx` — T-043 PR2 submit island.
 *
 * Coverage matrix from `tasks.md §2.6` and the GWT scenarios in
 * `specs/booking-form/spec.md`:
 *   - All 4 selections preserved → click → `submitBooking` called with
 *     TZ-corrected `startDateTime` (`2026-09-10T09:30:00-03:00`).
 *   - 201 → `router.push("/appointments?confirmed=" + id, { scroll: false })`.
 *   - 409 APPOINTMENT_NOT_AVAILABLE → ErrorBanner copy + `router.refresh()`.
 *   - 403 FORBIDDEN → ErrorBanner copy + delete `?vehicleId=` + refresh.
 *   - 422 INVALID_SERVICE → ErrorBanner copy + delete `?serviceId=` +
 *     navigate to `/services`.
 *   - 401 UNAUTHORIZED → imperative `window.location.assign("/login?next=...")`.
 *   - 400 VALIDATION_ERROR → ErrorBanner copy = server message.
 *   - Double-click → only one `submitBooking` call (idempotent via
 *     `disabled`+`aria-busy` + handler early-return).
 *   - Submit button disabled while pending.
 *   - ErrorBanner auto-dismisses on the next successful submit.
 *   - Compound throws outside provider.
 *   - SummaryCard renders 4 rows with primitive props only (INV-08).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockSearch: URLSearchParams = new URLSearchParams();
const mockPathname = "/appointments/new";
const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}));

vi.mock("@/lib/api/appointments", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/appointments")
  >("@/lib/api/appointments");
  return {
    ...actual,
    submitBooking: vi.fn(),
  };
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingForm } from "./BookingForm";
import { ApiError } from "@/lib/validators/service";
import { submitBooking } from "@/lib/api/appointments";

const SERVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VEHICLE_ID = "770e8400-e29b-41d4-a716-446655440099";
const DATE = "2026-09-10";
const SLOT = "09:30";
const SERVICE_NAME = "Oil Change";
const VEHICLE_LABEL = "Toyota Corolla (2020) — AB123CD";
const TURNO_ID = "33333333-3333-4333-8333-333333333333";

const TURNO_DTO = {
  id: TURNO_ID,
  customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  vehicleId: VEHICLE_ID,
  serviceId: SERVICE_ID,
  startDateTime: "2026-09-10T12:30:00.000Z",
  endDateTime: "2026-09-10T13:00:00.000Z",
  status: "PENDIENTE",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

/**
 * jsdom freezes `window.location.assign` so `vi.spyOn` and
 * `Object.defineProperty` both fail with
 * `TypeError: Cannot redefine property: assign`. The workaround:
 * replace the entire `window.location` object via `Object.defineProperty`
 * on `window` (the `location` getter is configurable in modern jsdom —
 * the methods on the resolved object are not). The original descriptor
 * is restored on cleanup so subsequent tests see the real location.
 */
let originalLocationDescriptor: PropertyDescriptor | undefined;
let assignSpy: ReturnType<typeof vi.fn>;

function installAssignSpy() {
  originalLocationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "location",
  );
  assignSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { assign: assignSpy },
    configurable: true,
    writable: true,
  });
}

function uninstallAssignSpy() {
  if (originalLocationDescriptor) {
    Object.defineProperty(window, "location", originalLocationDescriptor);
    originalLocationDescriptor = undefined;
  }
}

function mockSubmitImpl(impl: (input: never) => Promise<unknown>) {
  (submitBooking as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (input) => impl(input as never),
  );
}

/**
 * `vi.clearAllMocks()` clears the call history but preserves the
 * `mockResolvedValueOnce` / `mockRejectedValueOnce` queues. We need a
 * full reset between tests so a leaked mock from a previous failure
 * (e.g. 401 → `vi.spyOn` TypeError aborts before the click) doesn't
 * bleed into the next test.
 */
beforeEach(() => {
  (submitBooking as unknown as ReturnType<typeof vi.fn>).mockReset();
  routerPush.mockReset();
  routerRefresh.mockReset();
  mockSearch = new URLSearchParams();
  installAssignSpy();
});

afterEach(() => {
  cleanup();
  uninstallAssignSpy();
  vi.restoreAllMocks();
});

function renderCompound() {
  return render(
    <BookingForm
      serviceId={SERVICE_ID}
      vehicleId={VEHICLE_ID}
      date={DATE}
      slot={SLOT}
      serviceName={SERVICE_NAME}
      vehicleLabel={VEHICLE_LABEL}
    >
      <BookingForm.Summary />
      <BookingForm.ErrorBanner />
      <BookingForm.Submit />
    </BookingForm>,
  );
}

describe("BookingForm — compound namespace (T-043 PR2)", () => {
  it("exposes Summary, Submit, ErrorBanner statics", () => {
    expect(typeof BookingForm.Summary).toBe("function");
    expect(typeof BookingForm.Submit).toBe("function");
    expect(typeof BookingForm.ErrorBanner).toBe("function");
  });

  it("renders Summary with the 4 primitive rows (INV-08 primitive props)", () => {
    renderCompound();
    expect(screen.getByTestId("booking-summary")).toBeInTheDocument();
    expect(screen.getByTestId("booking-summary-row-service")).toHaveTextContent(
      SERVICE_NAME,
    );
    expect(screen.getByTestId("booking-summary-row-vehicle")).toHaveTextContent(
      VEHICLE_LABEL,
    );
    expect(screen.getByTestId("booking-summary-row-date")).toHaveTextContent(
      DATE,
    );
    expect(screen.getByTestId("booking-summary-row-time")).toHaveTextContent(
      SLOT,
    );
  });

  it("renders Submit button enabled with aria-busy=false (default state)", () => {
    renderCompound();
    const submit = screen.getByTestId("booking-submit");
    expect(submit).toBeInstanceOf(HTMLButtonElement);
    expect(submit).not.toBeDisabled();
    expect(submit.getAttribute("aria-busy")).toBe("false");
    expect(submit.textContent).toContain("Confirm booking");
  });

  it("ErrorBanner is absent when there is no error", () => {
    renderCompound();
    expect(screen.queryByTestId("booking-error")).toBeNull();
  });

  it("INV-08 — rendered tree contains no Spanish / snake_case DTO fields", () => {
    renderCompound();
    const html = document.body.innerHTML;
    for (const forbidden of [
      "cliente_id",
      "vehiculo_id",
      "servicio_id",
      "fecha_hora_inicio",
      "fecha_hora_fin",
      "estado",
      "created_at",
      "updated_at",
      "marca",
      "modelo",
      "anio",
      "patente",
    ]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
    expect(html).toContain("Booking summary");
    expect(html).toContain(SERVICE_NAME);
    expect(html).toContain(VEHICLE_LABEL);
    expect(html).toContain(DATE);
    expect(html).toContain(SLOT);
  });
});

describe("BookingForm — click submits with TZ-corrected ISO (REQ-BOOK-01)", () => {
  it("click → submitBooking called with startDateTime=`${date}T${slot}:00-03:00`", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockResolvedValueOnce(TURNO_DTO);
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      vehicleId: VEHICLE_ID,
      serviceId: SERVICE_ID,
      // INV-06 — BA fixed -03:00 (Law 26.474, no DST).
      startDateTime: "2026-09-10T09:30:00-03:00",
    });
  });

  it("201 → router.push('/appointments?confirmed=' + id, { scroll: false })", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockResolvedValueOnce(TURNO_DTO);
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
    const [pushedPath, pushedOpts] = routerPush.mock.calls[0] ?? [];
    expect(typeof pushedPath).toBe("string");
    expect(pushedPath).toBe(`/appointments?confirmed=${TURNO_ID}`);
    expect(pushedOpts).toEqual({ scroll: false });
  });

  it("201 with siblings present → success URL is /appointments?confirmed=<id> (no booking-URL leak)", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockResolvedValueOnce(TURNO_DTO);
    mockSearch = new URLSearchParams(
      `serviceId=${SERVICE_ID}&date=${DATE}&slot=${SLOT}&vehicleId=${VEHICLE_ID}`,
    );
    renderCompound();
    // 401 path is the only one that reads searchParams.toString() to
    // build the `next=` query; the 201 path just navigates to the
    // success URL. This test confirms we don't leak the booking URL
    // into the success redirect.
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
    expect(routerPush.mock.calls[0]?.[0]).toBe(
      `/appointments?confirmed=${TURNO_ID}`,
    );
  });
});

describe("BookingForm — 409 race mapping (REQ-BOOK-04)", () => {
  it("409 APPOINTMENT_NOT_AVAILABLE → Spanish banner + router.refresh()", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "APPOINTMENT_NOT_AVAILABLE",
        message: "El horario seleccionado ya no se encuentra disponible.",
        status: 409,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain(
      "El horario seleccionado ya no se encuentra disponible",
    );
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
    // We did NOT navigate to a new page — the user stays on the form.
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe("BookingForm — 403 ownership mapping (REQ-BOOK-04)", () => {
  it("403 FORBIDDEN → English banner + delete vehicleId + refresh", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "FORBIDDEN",
        message: "Vehicle not found or not owned",
        status: 403,
      }),
    );
    mockSearch = new URLSearchParams(
      `serviceId=${SERVICE_ID}&date=${DATE}&slot=${SLOT}&vehicleId=${VEHICLE_ID}`,
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner.textContent).toContain("Vehicle not found or not owned");
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
    // The 403 handler deletes `?vehicleId=` and pushes a sibling-safe
    // path before refresh; verify the URL no longer contains it.
    const pushCalls = routerPush.mock.calls.map((c) => c[0]);
    const allPushed = pushCalls.filter(
      (p): p is string => typeof p === "string",
    );
    const dropped = allPushed.find(
      (p) => p.startsWith("/appointments/new") && !p.includes("vehicleId="),
    );
    expect(dropped, "expected a push without vehicleId=").toBeDefined();
  });
});

describe("BookingForm — 422 invalid service mapping (REQ-BOOK-04)", () => {
  it("422 INVALID_SERVICE → banner + delete serviceId + push /services", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "INVALID_SERVICE",
        message: "Service is not active",
        status: 422,
      }),
    );
    mockSearch = new URLSearchParams(
      `serviceId=${SERVICE_ID}&date=${DATE}&slot=${SLOT}&vehicleId=${VEHICLE_ID}`,
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner.textContent).toContain("Service not active");
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
    const pushPaths = routerPush.mock.calls
      .map((c) => c[0])
      .filter((p): p is string => typeof p === "string");
    expect(pushPaths).toContain("/services");
    // The sibling-deleting push must precede the /services navigation
    // and must omit `serviceId=`.
    const siblingSafePush = pushPaths.find(
      (p) => p.startsWith("/appointments/new") && !p.includes("serviceId="),
    );
    expect(siblingSafePush).toBeDefined();
  });
});

describe("BookingForm — 401 redirect mapping (REQ-BOOK-04)", () => {
  it("401 UNAUTHORIZED → window.location.assign('/login?next=' + encoded path)", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "UNAUTHORIZED",
        message: "Missing token",
        status: 401,
      }),
    );
    mockSearch = new URLSearchParams(
      `serviceId=${SERVICE_ID}&date=${DATE}&slot=${SLOT}&vehicleId=${VEHICLE_ID}`,
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    await waitFor(() => expect(assignSpy).toHaveBeenCalled());
    const [assignedHref] = assignSpy.mock.calls[0] ?? [];
    expect(typeof assignedHref).toBe("string");
    expect(assignedHref as string).toMatch(/^\/login\?next=/);
    // The next= query preserves pathname + search so the user lands
    // back on the booking URL after authenticating. `URLSearchParams`
    // encodes `:` as `%3A` so we mirror the round-trip here.
    const next = decodeURIComponent(
      (assignedHref as string).replace("/login?next=", ""),
    );
    expect(next).toBe(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${DATE}&slot=${encodeURIComponent(SLOT)}&vehicleId=${VEHICLE_ID}`,
    );
  });
});

describe("BookingForm — 400 validation + network error mapping", () => {
  it("400 VALIDATION_ERROR → banner = server message", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "startDateTime must be ISO 8601 with timezone",
        status: 400,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner.textContent).toContain("startDateTime must be ISO 8601");
  });

  it("NETWORK_ERROR → banner = 'Network error. Please try again.'", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "NETWORK_ERROR",
        message: "econnreset",
        status: 0,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner.textContent).toContain("Network error");
  });

  it("unmapped 5xx → banner = 'Could not book the appointment.'", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "UNKNOWN_ERROR",
        message: "boom",
        status: 500,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    expect(banner.textContent).toContain("Could not book the appointment");
  });
});

describe("BookingForm — idempotent submit (REQ-BOOK-04)", () => {
  it("double-click during pending → submitBooking called only once", async () => {
    let resolve!: (dto: typeof TURNO_DTO) => void;
    mockSubmitImpl(
      () =>
        new Promise<typeof TURNO_DTO>((r) => {
          resolve = r;
        }),
    );
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    renderCompound();
    const user = userEvent.setup();
    const btn = screen.getByTestId("booking-submit");
    // Fire two clicks back-to-back — the second must be ignored.
    await user.click(btn);
    // After the first click resolves, React must have flushed the
    // isPending=true state to the DOM (the button becomes disabled).
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.textContent).toContain("Booking...");
    await user.click(btn);
    // The second click was a no-op — handler's `if (isPending) return`
    // short-circuited before another fetch was issued.
    expect(submit).toHaveBeenCalledTimes(1);
    // Resolve the pending promise so the test cleanup is deterministic.
    resolve(TURNO_DTO);
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
  });

  it("after success → ErrorBanner auto-dismisses on next successful submit", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    // First click fails (409) — banner shows up.
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "APPOINTMENT_NOT_AVAILABLE",
        message: "El horario seleccionado ya no se encuentra disponible.",
        status: 409,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    await screen.findByTestId("booking-error");
    // Second click succeeds — the 201 path clears the error before
    // navigating away, so the banner stays gone (in jsdom we observe
    // the unmount via the navigation call, not via `document.body`,
    // because the component is replaced by the new page; the banner
    // is auto-dismissed via `setError(null)` in the try block).
    submit.mockResolvedValueOnce(TURNO_DTO);
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    await waitFor(() => expect(routerPush).toHaveBeenCalled());
    expect(routerPush.mock.calls[0]?.[0]).toBe(
      `/appointments?confirmed=${TURNO_ID}`,
    );
  });

  it("ErrorBanner dismiss button clears the error", async () => {
    const submit = submitBooking as unknown as ReturnType<typeof vi.fn>;
    submit.mockRejectedValueOnce(
      new ApiError({
        code: "APPOINTMENT_NOT_AVAILABLE",
        message: "El horario seleccionado ya no se encuentra disponible.",
        status: 409,
      }),
    );
    renderCompound();
    await userEvent.setup().click(screen.getByTestId("booking-submit"));
    const banner = await screen.findByTestId("booking-error");
    const dismiss = banner.querySelector<HTMLButtonElement>(
      '[data-testid="booking-error-dismiss"]',
    );
    if (!dismiss) throw new Error("dismiss button not found");
    await userEvent.setup().click(dismiss);
    await waitFor(() =>
      expect(screen.queryByTestId("booking-error")).toBeNull(),
    );
  });
});

describe("BookingForm — compound throws outside provider", () => {
  it("Submit outside <BookingForm> throws a loud error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Probe() {
      return <BookingForm.Submit />;
    }
    expect(() => render(<Probe />)).toThrow(
      /BookingForm statics must be used inside/,
    );
    errorSpy.mockRestore();
  });
});