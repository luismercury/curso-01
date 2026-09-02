import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";

// PR2c brings the shared `push` + `mockSearch` mocks — they are used by
// Pagination tests below to assert on the URL router.push calls. The
// vi.mock factory hoists `push` and `mockSearch` references so vi.fn
// can be set up before the mock factory closes over them.
const push = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mockSearch,
  usePathname: () => "/appointments",
}));

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppointmentList, useAppointment } from "./AppointmentList";
import type { EnrichedTurnoDTOJson } from "@/lib/api/appointments";

const TZ = "America/Argentina/Buenos_Aires";

/** Error boundary that re-throws so we can assert on the guard. */
class Boundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error !== null) throw this.state.error;
    return this.props.children;
  }
}

const pagination = (o: Record<string, number> = {}) => ({
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
  ...o,
});

beforeEach(() => {
  push.mockReset();
  mockSearch = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppointmentList — context guard", () => {
  // PR2a: Card is a no-op stub until PR2b lands — guard coverage for Card
  // moves to PR2b's test slice once the real component calls useAppointment().
  // The hook-level guard below is stable across the chain.

  it("throws when useAppointment() is called outside Root", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Probe(): null {
      useAppointment();
      return null;
    }
    expect(() =>
      render(
        <Boundary>
          <Probe />
        </Boundary>,
      ),
    ).toThrow(/AppointmentList/);
    consoleErrorSpy.mockRestore();
  });
});

describe("AppointmentList — Empty state (R3.1)", () => {
  it("Empty subcomponent renders data-testid + role=status + BA copy", () => {
    render(
      <AppointmentList.Root timezone={TZ} pagination={pagination({ total: 0, totalPages: 0 })}>
        <AppointmentList.Empty />
      </AppointmentList.Root>,
    );
    const empty = screen.getByTestId("appointments-empty");
    expect(empty.getAttribute("role")).toBe("status");
    expect(empty.textContent).toMatch(/No tienes turnos próximos/);
  });
});

describe("AppointmentList — Skeleton", () => {
  it("Skeleton renders aria-busy + appointments-skeleton data-testid", () => {
    render(
      <AppointmentList.Root timezone={TZ} pagination={pagination()}>
        <AppointmentList.Skeleton />
      </AppointmentList.Root>,
    );
    const skel = screen.getByTestId("appointments-skeleton");
    expect(skel.getAttribute("aria-busy")).toBe("true");
    expect(skel.getAttribute("aria-live")).toBe("polite");
  });
});

describe("AppointmentList — Root provider", () => {
  it("Root mounts a context provider (children render inside)", () => {
    render(
      <AppointmentList.Root timezone={TZ} pagination={pagination()}>
        <span data-testid="root-child">hello</span>
      </AppointmentList.Root>,
    );
    expect(screen.getByTestId("root-child").textContent).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// PR2b — Card + Badge.{PendingBadge,ConfirmedBadge} tests.
//
// Tests below add the slice landed in PR2b: Card rendering, badge
// variants, A11y roles, snake leak (INV-08), data attributes
// (camelCase + ISO), and fallback strings. Pagination coverage moves
// to PR2c.
// ---------------------------------------------------------------------------

/**
 * SNAKE — every snake_case / Spanish DB key that must NEVER leak into
 * the rendered output (INV-08). The page test uses the same list.
 */
const SNAKE = [
  "fecha_hora_inicio",
  "fecha_hora_fin",
  "cliente_id",
  "vehiculo_id",
  "servicio_id",
  "estado",
  "created_at",
  "updated_at",
  "nombre",
  "marca",
  "modelo",
  "patente",
];

const appointment = (o: Partial<EnrichedTurnoDTOJson> = {}): EnrichedTurnoDTOJson => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  vehicleId: "770e8400-e29b-41d4-a716-446655440099",
  serviceId: "880e8400-e29b-41d4-a716-446655440088",
  // 2026-09-10T12:00:00Z == 2026-09-10T09:00:00-03:00 (BA, no DST)
  startDateTime: "2026-09-10T12:00:00.000Z",
  endDateTime: "2026-09-10T13:30:00.000Z",
  status: "PENDIENTE",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  serviceName: "Cambio de aceite",
  vehicleLabel: "Toyota Corolla — AB123CD",
  ...o,
});

/**
 * Thin composition mirror of the page's <AppointmentList.Root> tree.
 * Keeps every test focused on the assertions instead of repeating the
 * conditional render. Card renders real rows in PR2b; Pagination is
 * still a no-op stub until PR2c lands.
 */
function TestRoot({
  appointments,
  pagination: p,
}: {
  appointments: EnrichedTurnoDTOJson[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}) {
  return (
    <AppointmentList.Root timezone={TZ} pagination={p}>
      {appointments.length === 0 ? (
        <AppointmentList.Empty />
      ) : (
        <>
          <ol data-testid="appointments-list" role="list">
            {appointments.map((a) => (
              <AppointmentList.Card key={a.id} appointment={a} />
            ))}
          </ol>
          <AppointmentList.Pagination />
        </>
      )}
    </AppointmentList.Root>
  );
}

describe("AppointmentList — context guard (R5.1)", () => {
  it("throws when Card is mounted outside Root (R5.1)", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Boundary>
          <AppointmentList.Card appointment={appointment()} />
        </Boundary>,
      ),
    ).toThrow(/AppointmentList/);
    consoleErrorSpy.mockRestore();
  });
});

describe("AppointmentList — Fecha/Horario BA formatting (R1.1, R1.2)", () => {
  it("formats UTC 12:00 → BA 10/09/2026 + 09:00–10:30", () => {
    render(<TestRoot appointments={[appointment()]} pagination={pagination()} />);
    const item = screen.getByTestId("appointment-item");
    expect(screen.getByTestId("card-date").textContent).toBe("10/09/2026");
    const timeText = screen.getByTestId("card-time").textContent ?? "";
    expect(timeText).toMatch(/09:00/);
    expect(timeText).toMatch(/10:30/);
    expect(timeText).toContain("–"); // em dash range separator
    expect(item).toBeTruthy();
  });

  it("preserves ISO startDateTime on the <time datetime> attribute (R5.3)", () => {
    render(<TestRoot appointments={[appointment()]} pagination={pagination()} />);
    const dateEl = screen.getByTestId("card-date");
    expect(dateEl.getAttribute("datetime")).toBe("2026-09-10T12:00:00.000Z");
  });
});

describe("AppointmentList — Badge variants (R2.1)", () => {
  it("PENDIENTE → aria-label 'Estado: PENDIENTE' + amber class + data-status", () => {
    render(<TestRoot appointments={[appointment({ status: "PENDIENTE" })]} pagination={pagination()} />);
    const badge = screen.getByTestId("appointment-status");
    expect(badge.getAttribute("aria-label")).toBe("Estado: PENDIENTE");
    expect(badge.getAttribute("data-status")).toBe("PENDIENTE");
    expect(badge.className).toMatch(/badgePending/);
  });

  it("CONFIRMADO → aria-label 'Estado: CONFIRMADO' + green class + data-status", () => {
    render(<TestRoot appointments={[appointment({ status: "CONFIRMADO" })]} pagination={pagination()} />);
    const badge = screen.getByTestId("appointment-status");
    expect(badge.getAttribute("aria-label")).toBe("Estado: CONFIRMADO");
    expect(badge.getAttribute("data-status")).toBe("CONFIRMADO");
    expect(badge.className).toMatch(/badgeConfirmed/);
  });
});

describe("AppointmentList — A11y roles (R2.2)", () => {
  it("ol role=list + 3 li role=listitem", () => {
    const list = [
      appointment({ id: "550e8400-e29b-41d4-a716-446655440001" }),
      appointment({ id: "550e8400-e29b-41d4-a716-446655440002", status: "CONFIRMADO" }),
      appointment({ id: "550e8400-e29b-41d4-a716-446655440003" }),
    ];
    render(<TestRoot appointments={list} pagination={pagination({ total: 3, totalPages: 1 })} />);
    const ol = screen.getByTestId("appointments-list");
    expect(ol.getAttribute("role")).toBe("list");
    const items = screen.getAllByTestId("appointment-item");
    expect(items).toHaveLength(3);
    items.forEach((i) => expect(i.getAttribute("role")).toBe("listitem"));
  });
});

describe("AppointmentList — INV-08 no snake leak (R5.1, R5.2)", () => {
  it("rendered HTML is free of snake_case / Spanish DB keys", () => {
    const { container } = render(
      <TestRoot appointments={[appointment()]} pagination={pagination()} />,
    );
    const html = container.innerHTML;
    for (const s of SNAKE) expect(html).not.toContain(s);
  });

  it("data attributes use camelCase + ISO strings (no Date objects)", () => {
    render(<TestRoot appointments={[appointment()]} pagination={pagination()} />);
    const item = screen.getByTestId("appointment-item");
    expect(item.getAttribute("data-service-name")).toBe("Cambio de aceite");
    expect(item.getAttribute("data-vehicle-label")).toBe("Toyota Corolla — AB123CD");
    expect(item.getAttribute("data-appointment-id")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

describe("AppointmentList — fallback strings (R1.3)", () => {
  it("Servicio/Vehículo no disponible still renders a row", () => {
    render(
      <TestRoot
        appointments={[appointment({ serviceName: "Servicio no disponible", vehicleLabel: "Vehículo no disponible" })]}
        pagination={pagination()}
      />,
    );
    const item = screen.getByTestId("appointment-item");
    expect(item.textContent).toContain("Servicio no disponible");
    expect(item.textContent).toContain("Vehículo no disponible");
  });
});

describe("AppointmentList — Explicit variant components", () => {
  it("PendingBadge renders standalone with correct aria-label", () => {
    render(
      <AppointmentList.Root timezone={TZ} pagination={pagination()}>
        <AppointmentList.Badge.PendingBadge />
      </AppointmentList.Root>,
    );
    expect(screen.getByTestId("appointment-status").getAttribute("aria-label")).toBe("Estado: PENDIENTE");
  });

  it("ConfirmedBadge renders standalone with correct aria-label", () => {
    render(
      <AppointmentList.Root timezone={TZ} pagination={pagination()}>
        <AppointmentList.Badge.ConfirmedBadge />
      </AppointmentList.Root>,
    );
    expect(screen.getByTestId("appointment-status").getAttribute("aria-label")).toBe("Estado: CONFIRMADO");
  });
});

// ---------------------------------------------------------------------------
// PR2c — Pagination tests.
//
// Lands in this slice: ?page=2 label, Anterior/Siguiente disabled states,
// router.push URL construction (with sibling preservation), and the
// totalPages ≤ 1 render-nothing contract. The `push` + `mockSearch`
// mocks above are referenced here.
// ---------------------------------------------------------------------------

describe("AppointmentList — Pagination (R4.1)", () => {
  it("?page=2 → 'Página 2 de 2' + Anterior enabled + Siguiente disabled", () => {
    render(
      <TestRoot
        appointments={[appointment()]}
        pagination={pagination({ page: 2, total: 25, totalPages: 2 })}
      />,
    );
    expect(screen.getByTestId("pagination-label").textContent).toMatch(/Página 2 de 2/);
    expect(screen.getByTestId("pagination-prev").hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("pagination-next").hasAttribute("disabled")).toBe(true);
  });

  it("?page=1 → Anterior disabled + Siguiente enabled", () => {
    render(
      <TestRoot
        appointments={[appointment()]}
        pagination={pagination({ page: 1, total: 25, totalPages: 2 })}
      />,
    );
    expect(screen.getByTestId("pagination-prev").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("pagination-next").hasAttribute("disabled")).toBe(false);
  });

  it("clicking Siguiente pushes ?page=2 preserving limit + scroll:false", async () => {
    mockSearch = new URLSearchParams("page=1&limit=20");
    render(
      <TestRoot
        appointments={[appointment()]}
        pagination={pagination({ page: 1, total: 25, totalPages: 2 })}
      />,
    );
    await userEvent.setup().click(screen.getByTestId("pagination-next"));
    expect(push).toHaveBeenCalledWith("/appointments?page=2&limit=20", { scroll: false });
  });

  it("clicking Anterior pushes ?page=1 stripping the ?page= sibling", async () => {
    mockSearch = new URLSearchParams("page=2&limit=20&confirmed=keep-me");
    render(
      <TestRoot
        appointments={[appointment()]}
        pagination={pagination({ page: 2, total: 25, totalPages: 2 })}
      />,
    );
    await userEvent.setup().click(screen.getByTestId("pagination-prev"));
    // Anterior at page 2 → page 1, which strips ?page= and preserves siblings
    const [url, options] = push.mock.calls[0] ?? [];
    expect(url).toMatch(/^\/appointments\?/);
    expect(String(url)).not.toContain("page=");
    expect(String(url)).toContain("limit=20");
    expect(String(url)).toContain("confirmed=keep-me");
    expect(options).toEqual({ scroll: false });
  });

  it("single page (totalPages=1) → Pagination renders nothing", () => {
    render(
      <TestRoot
        appointments={[appointment()]}
        pagination={pagination({ total: 1, totalPages: 1 })}
      />,
    );
    expect(screen.queryByTestId("appointments-pagination")).toBeNull();
  });
});