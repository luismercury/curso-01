/**
 * jsdom + RTL tests for `DateSelector.tsx` — T-041 PR2 compound.
 *
 * Coverage matrix from `tasks.md §2.4` and the GWT scenarios in
 * `specs/date-selection/spec.md`:
 *   - GWT 3 (date selection writes `?date=` preserving siblings).
 *   - GWT 4 (clear deletes `?date=`, siblings intact).
 *   - GWT 7 (closedDows hint via aria-describedby).
 *   - GWT 9 (Continue href preserves `?serviceId=&date=&vehicleId=`).
 *   - Defense in depth: tampered URL `?date=` → null, no banner, no 500.
 *   - Compound namespace structure (`DateSelector.Input` etc.).
 *   - `min` / `max` attributes on the input.
 *   - Closed-day warning surfaces when the picked day is in `closedDows`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let mockSearch: URLSearchParams = new URLSearchParams();
const routerPush = vi.fn();
const mockPathname = vi.fn(() => "/appointments/new");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: () => {} }),
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearch,
}));

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateSelector } from "./DateSelector";

const ID_A = "550e8400-e29b-41d4-a716-446655440000";
const ID_V = "770e8400-e29b-41d4-a716-446655440099";
const TZ = "America/Argentina/Buenos_Aires";
const MIN = "2026-09-01";
const MAX = "2026-10-31";

afterEach(() => {
  cleanup();
  mockSearch = new URLSearchParams();
  routerPush.mockClear();
  mockPathname.mockClear();
  mockPathname.mockImplementation(() => "/appointments/new");
});

/** Render the compound with sensible defaults — callers override per test. */
function renderCompound(
  overrides: Partial<React.ComponentProps<typeof DateSelector>> = {},
) {
  return render(
    <DateSelector
      date={null}
      min={MIN}
      max={MAX}
      closedDows={[0, 6]}
      timezone={TZ}
      serviceId={ID_A}
      vehicleId={null}
      {...overrides}
    >
      <DateSelector.Input />
      <DateSelector.ClearButton />
      <DateSelector.SelectedBanner />
    </DateSelector>,
  );
}

describe("DateSelector — compound namespace", () => {
  it("exposes Input, SelectedBanner, ClearButton statics", () => {
    expect(typeof DateSelector.Input).toBe("function");
    expect(typeof DateSelector.SelectedBanner).toBe("function");
    expect(typeof DateSelector.ClearButton).toBe("function");
  });

  it("renders Input as a group with a labelled <input type='date'>", () => {
    renderCompound();
    const group = screen.getByTestId("date-selector");
    expect(group.tagName).toBe("DIV");
    expect(group.getAttribute("role")).toBe("group");
    const input = screen.getByTestId("date-selector-input");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("date");
    expect(input.getAttribute("min")).toBe(MIN);
    expect(input.getAttribute("max")).toBe(MAX);
  });

  it("links the closedDows hint to the input via aria-describedby", () => {
    renderCompound({ closedDows: [0, 6] });
    const input = screen.getByTestId("date-selector-input");
    const hint = screen.getByTestId("date-selector-closed-hint");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
    expect(hint).toHaveTextContent(/Closed:.*Sundays.*Saturdays/);
  });

  it("omits the closedDows hint when closedDows is empty (no aria-describedby)", () => {
    renderCompound({ closedDows: [] });
    const input = screen.getByTestId("date-selector-input");
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByTestId("date-selector-closed-hint")).toBeNull();
  });
});

describe("DateSelector.Input — onChange writes ?date= preserving siblings (GWT 3)", () => {
  it("picks a date → router.push preserves ?serviceId=&vehicleId=", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&vehicleId=${ID_V}`);
    renderCompound();
    const input = screen.getByTestId("date-selector-input");
    fireEvent.change(input, { target: { value: "2026-09-10" } });
    expect(routerPush).toHaveBeenCalledTimes(1);
    const [href, opts] = routerPush.mock.calls[0]!;
    expect(href).toBe(
      `/appointments/new?serviceId=${ID_A}&vehicleId=${ID_V}&date=2026-09-10`,
    );
    expect(opts).toEqual({ scroll: false });
  });

  it("picks a date when no siblings → URL has only ?date=", () => {
    // page.tsx would never render DateSelector without serviceId, but the
    // island itself only knows the URL — siblings come from searchParams.
    mockSearch = new URLSearchParams();
    renderCompound({ serviceId: null });
    const input = screen.getByTestId("date-selector-input");
    fireEvent.change(input, { target: { value: "2026-09-15" } });
    expect(routerPush).toHaveBeenCalledWith(
      `/appointments/new?date=2026-09-15`,
      { scroll: false },
    );
  });

  it("uses pathname from usePathname (not hardcoded)", () => {
    mockPathname.mockImplementation(() => "/appointments/new");
    mockSearch = new URLSearchParams(`serviceId=${ID_A}`);
    renderCompound();
    const input = screen.getByTestId("date-selector-input");
    fireEvent.change(input, { target: { value: "2026-09-20" } });
    const [href] = routerPush.mock.calls[0]!;
    expect(href).toMatch(/^\/appointments\/new\?/);
  });
});

describe("DateSelector.ClearButton — clears ?date= (GWT 4)", () => {
  it("renders nothing when no date is selected", () => {
    renderCompound({ date: null });
    expect(screen.queryByTestId("date-selector-clear")).toBeNull();
  });

  it("deletes ?date= while keeping siblings intact", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&vehicleId=${ID_V}&date=2026-09-10`);
    renderCompound({ date: "2026-09-10" });
    const clear = screen.getByTestId("date-selector-clear");
    expect(clear.tagName).toBe("BUTTON");
    fireEvent.click(clear);
    expect(routerPush).toHaveBeenCalledTimes(1);
    const [href, opts] = routerPush.mock.calls[0]!;
    // serviceId + vehicleId survive; date param dropped.
    expect(href).toBe(`/appointments/new?serviceId=${ID_A}&vehicleId=${ID_V}`);
    expect(opts).toEqual({ scroll: false });
  });

  it("deletes ?date= when no siblings present", () => {
    mockSearch = new URLSearchParams(`date=2026-09-10`);
    renderCompound({ serviceId: null, date: "2026-09-10" });
    fireEvent.click(screen.getByTestId("date-selector-clear"));
    const [href] = routerPush.mock.calls[0]!;
    expect(href).toBe("/appointments/new");
  });
});

describe("DateSelector.SelectedBanner — Continue href (GWT 9)", () => {
  it("renders nothing when no date", () => {
    renderCompound({ date: null });
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
  });

  it("renders nothing when no serviceId", () => {
    renderCompound({ date: "2026-09-10", serviceId: null });
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
  });

  it("Continue href preserves ?serviceId=&date= (no vehicleId)", () => {
    renderCompound({ date: "2026-09-10", vehicleId: null });
    const link = screen.getByTestId("date-selector-continue");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      `/appointments/new?serviceId=${ID_A}&date=2026-09-10`,
    );
    expect(link).toHaveTextContent(/Continue/i);
  });

  it("Continue href preserves ?serviceId=&date=&vehicleId= (all siblings)", () => {
    renderCompound({ date: "2026-09-10", vehicleId: ID_V });
    const link = screen.getByTestId("date-selector-continue");
    expect(link.getAttribute("href")).toBe(
      `/appointments/new?serviceId=${ID_A}&vehicleId=${ID_V}&date=2026-09-10`,
    );
  });

  it("banner shows the selected date as visible text", () => {
    renderCompound({ date: "2026-09-10" });
    const banner = screen.getByTestId("date-selector-banner");
    expect(banner).toHaveTextContent(/Selected: 2026-09-10/);
  });

  it("banner exposes role=status + aria-live=polite for screen readers", () => {
    renderCompound({ date: "2026-09-10" });
    const banner = screen.getByTestId("date-selector-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});

describe("DateSelector — defense in depth (tampered URL)", () => {
  it("tampered ?date=garbage → null, no banner (no 500)", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=garbage`);
    renderCompound();
    // No banner because URL fails dateSchema.
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
    // No closed-day warning because the selected DOW resolves to null.
    expect(screen.queryByTestId("date-selector-closed-warn")).toBeNull();
    // Input is empty.
    expect(
      (screen.getByTestId("date-selector-input") as HTMLInputElement).value,
    ).toBe("");
  });

  it("calendar-overflow ?date=2026-02-30 → null, no banner", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=2026-02-30`);
    renderCompound();
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
  });

  it("past ?date=2020-01-01 → null, no banner (isPastBa guard)", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=2020-01-01`);
    renderCompound();
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
  });

  it("beyond-max ?date=2099-01-01 → null, no banner (max bound)", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=2099-01-01`);
    renderCompound();
    expect(screen.queryByTestId("date-selector-banner")).toBeNull();
  });

  it("SSR-resolved `date` prop wins over a malformed URL value", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=garbage`);
    renderCompound({ date: "2026-09-10" });
    // Banner visible because the prop resolved a valid date.
    expect(screen.getByTestId("date-selector-banner")).toBeInTheDocument();
    expect(
      (screen.getByTestId("date-selector-input") as HTMLInputElement).value,
    ).toBe("2026-09-10");
  });
});

describe("DateSelector — closed-day warning (UX hint)", () => {
  it("surfaces the closed-day warning when the picked day is in closedDows", () => {
    // 2026-09-06 is a Sunday — closedDows=[0,6] per default config.
    renderCompound({ date: "2026-09-06", closedDows: [0, 6] });
    expect(
      screen.getByTestId("date-selector-closed-warn"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("date-selector-closed-warn")).toHaveTextContent(
      /Sunday/i,
    );
  });

  it("does NOT surface the warning on a non-closed day", () => {
    // 2026-09-08 is a Tuesday — not in closedDows=[0,6].
    renderCompound({ date: "2026-09-08", closedDows: [0, 6] });
    expect(screen.queryByTestId("date-selector-closed-warn")).toBeNull();
  });

  it("does NOT surface the warning when no date is selected", () => {
    renderCompound({ date: null, closedDows: [0, 6] });
    expect(screen.queryByTestId("date-selector-closed-warn")).toBeNull();
  });
});

describe("DateSelector — INV-08 DTO no-leak", () => {
  it("rendered tree contains no Spanish / snake_case date fields", () => {
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=2026-09-10`);
    renderCompound({ date: "2026-09-10" });
    const html = document.body.innerHTML;
    for (const forbidden of [
      "fecha",
      "fechaHoraInicio",
      "fechaHoraFin",
      "patente",
      "marca",
      "cliente_id",
    ]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });
});
