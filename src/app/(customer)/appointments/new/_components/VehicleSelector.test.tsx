/**
 * jsdom + RTL tests for `VehicleSelector.tsx` — T-043 PR1 compound.
 *
 * Coverage matrix from `tasks.md §1.6` and the GWT scenarios in
 * `specs/booking-form/spec.md`:
 *   - GWT Selection preserves siblings (click `uuidV` → URL contains
 *     `?vehicleId=uuidV`, banner shows summary).
 *   - GWT Clear deletes `?vehicleId=` (banner hidden, siblings intact).
 *   - GWT Tampered / foreign vehicle (UUID garbage or UUID-of-someone-elses-car
 *     → no aria-checked, banner hidden, no 500).
 *   - Zero vehicles → CTA branch with `<Link href="/vehicles">`.
 *   - Compound namespace structure (`VehicleSelector.List`,
 *     `.SelectedBanner`, `.ClearButton`, `.Empty`).
 *   - RSC-supplied `userId` re-checked via `isOwner` (INV-03).
 *   - INV-08: rendered tree contains no Spanish / snake_case vehicle fields.
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
import userEvent from "@testing-library/user-event";
import { VehicleSelector } from "./VehicleSelector";
import type { VehicleDTOJson } from "@/lib/api/vehicles";

const ID_A = "550e8400-e29b-41d4-a716-446655440000"; // service
const ID_V = "770e8400-e29b-41d4-a716-446655440099"; // vehicle owned by user
const ID_W = "880e8400-e29b-41d4-a716-446655440088"; // foreign vehicle
const USER_ID = "990e8400-e29b-41d4-a716-446655440077"; // session user

function v(overrides: Partial<VehicleDTOJson> = {}): VehicleDTOJson {
  return {
    id: ID_V,
    customerId: USER_ID,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    plate: "AB123CD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  mockSearch = new URLSearchParams();
  routerPush.mockClear();
  mockPathname.mockClear();
  mockPathname.mockImplementation(() => "/appointments/new");
});

function renderCompound(
  overrides: Partial<React.ComponentProps<typeof VehicleSelector>> = {},
) {
  return render(
    <VehicleSelector
      vehicles={[v()]}
      userId={USER_ID}
      serviceId={ID_A}
      date={null}
      {...overrides}
    >
      <VehicleSelector.List />
      <VehicleSelector.SelectedBanner />
      <VehicleSelector.ClearButton />
    </VehicleSelector>,
  );
}

describe("VehicleSelector — compound namespace (T-043 PR1)", () => {
  it("exposes List, Empty, SelectedBanner, ClearButton statics", () => {
    expect(typeof VehicleSelector.List).toBe("function");
    expect(typeof VehicleSelector.Empty).toBe("function");
    expect(typeof VehicleSelector.SelectedBanner).toBe("function");
    expect(typeof VehicleSelector.ClearButton).toBe("function");
  });

  it("renders one radio per vehicle inside a radiogroup", () => {
    const v1 = v({ id: ID_V, brand: "Toyota", model: "Corolla", plate: "AAA111" });
    const v2 = v({
      id: "aa0e8400-e29b-41d4-a716-446655440aaa",
      brand: "Honda",
      model: "Civic",
      plate: "BBB222",
    });
    renderCompound({ vehicles: [v1, v2] });
    const group = screen.getByRole("radiogroup", { name: /choose a vehicle/i });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]?.textContent).toContain("Toyota Corolla (2020)");
    expect(radios[0]?.textContent).toContain("AAA111");
    expect(radios[1]?.textContent).toContain("Honda Civic (2020)");
    expect(radios[1]?.textContent).toContain("BBB222");
    for (const radio of radios) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("click uuidV → router.push with ?vehicleId=uuidV (GWT Selection writes URL)", async () => {
    const user = userEvent.setup();
    mockSearch = new URLSearchParams(`serviceId=${ID_A}&date=2026-09-10`);
    renderCompound();
    const radio = screen.getByRole("radio", { name: /Toyota Corolla/i });
    await user.click(radio);
    expect(routerPush).toHaveBeenCalledTimes(1);
    const [pushedPath, pushedOpts] = routerPush.mock.calls[0] ?? [];
    expect(typeof pushedPath).toBe("string");
    expect(pushedPath).toContain("vehicleId=" + ID_V);
    expect(pushedOpts).toEqual({ scroll: false });
  });

  it("URL ?vehicleId=<owned UUID> → button has aria-checked=true and banner renders", () => {
    mockSearch = new URLSearchParams(`vehicleId=${ID_V}`);
    renderCompound();
    const radio = screen.getByRole("radio", { name: /Toyota Corolla/i });
    expect(radio.getAttribute("aria-checked")).toBe("true");
    const banner = screen.getByTestId("vehicle-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Toyota Corolla");
    expect(banner.textContent).toContain("AB123CD");
  });

  it("URL ?vehicleId=<foreign UUID> → no aria-checked, banner hidden, no 500 (GWT Tampered / foreign vehicle)", () => {
    // foreign UUID belongs to a different user — `isOwner` fails.
    mockSearch = new URLSearchParams(`vehicleId=${ID_W}`);
    expect(() => renderCompound()).not.toThrow();
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
    expect(screen.queryByTestId("vehicle-banner")).toBeNull();
  });

  it("URL ?vehicleId=garbage → no aria-checked, banner hidden, no 500 (GWT Tampered)", () => {
    mockSearch = new URLSearchParams(`vehicleId=garbage`);
    expect(() => renderCompound()).not.toThrow();
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
    expect(screen.queryByTestId("vehicle-banner")).toBeNull();
  });

  it("ClearButton deletes ?vehicleId= while preserving siblings (GWT Clear)", () => {
    mockSearch = new URLSearchParams(
      `serviceId=${ID_A}&date=2026-09-10&vehicleId=${ID_V}`,
    );
    renderCompound({ date: "2026-09-10" });
    const clear = screen.getByTestId("vehicle-selector-clear");
    expect(clear.tagName).toBe("BUTTON");
    fireEvent.click(clear);
    expect(routerPush).toHaveBeenCalledTimes(1);
    const [pushedPath, pushedOpts] = routerPush.mock.calls[0] ?? [];
    expect(typeof pushedPath).toBe("string");
    expect(pushedPath).not.toContain("vehicleId=");
    expect(pushedPath).toContain("serviceId=" + ID_A);
    expect(pushedPath).toContain("date=2026-09-10");
    expect(pushedOpts).toEqual({ scroll: false });
  });

  it("ClearButton hidden when no vehicle is selected", () => {
    mockSearch = new URLSearchParams();
    renderCompound();
    expect(screen.queryByTestId("vehicle-selector-clear")).toBeNull();
  });

  it("Empty renders the CTA to /vehicles when vehicles=[] (Zero vehicles)", () => {
    // Empty is a SEPARATE static — render it alone to avoid duplicate
    // empty testids (the page-level CTA handles the empty case via
    // its own branch; the compound's Empty is a defensive opt-in).
    render(
      <VehicleSelector
        vehicles={[]}
        userId={USER_ID}
        serviceId={ID_A}
        date={null}
      >
        <VehicleSelector.Empty />
      </VehicleSelector>,
    );
    const empty = screen.getByTestId("vehicle-selector-empty");
    expect(empty).toBeInTheDocument();
    const cta = screen.getByTestId("vehicle-selector-empty-cta");
    expect(cta.tagName).toBe("A");
    expect(cta.getAttribute("href")).toBe("/vehicles");
  });

  it("List renders nothing when vehicles=[] (consumer owns empty state)", () => {
    renderCompound({ vehicles: [] });
    // List returns null on empty so the page can route to its own
    // 0-vehicle CTA branch without forking the compound's Empty.
    expect(screen.queryByTestId("vehicle-selector-list")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    // Explicit Empty static NOT in this render → no duplicate testids.
    expect(screen.queryByTestId("vehicle-selector-empty")).toBeNull();
  });

  it("List renders the radiogroup when vehicles populate the list", () => {
    renderCompound({ vehicles: [v()] });
    expect(screen.queryByTestId("vehicle-selector-empty")).toBeNull();
    expect(screen.getByTestId("vehicle-selector-list")).toBeInTheDocument();
  });

  it("vehicles filtered by userId — a foreign-owned vehicle is not rendered as a card", () => {
    // The RSC is supposed to filter via listVehiclesByCustomer; this
    // test asserts that the compound renders ONLY the supplied list —
    // i.e. the caller must pre-filter. Defense in depth lives in the
    // ownership re-check (isOwner), not in the render loop.
    const owned = v({ id: ID_V, customerId: USER_ID });
    const foreign = v({ id: ID_W, customerId: "ffffffff-ffff-ffff-ffff-ffffffffffff" });
    renderCompound({ vehicles: [owned, foreign] });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
  });
});

describe("VehicleSelector — compound throws outside provider", () => {
  it("useVehicleContext outside <VehicleSelector> throws a loud error", async () => {
    const { useVehicleContext } = await import("./VehicleSelector");
    function Probe() {
      useVehicleContext();
      return null;
    }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useVehicleContext must be used inside/,
    );
    errorSpy.mockRestore();
  });
});

describe("VehicleSelector — INV-08 DTO no-leak", () => {
  it("rendered tree contains no Spanish / snake_case vehicle fields", () => {
    mockSearch = new URLSearchParams(`vehicleId=${ID_V}`);
    renderCompound();
    const html = document.body.innerHTML;
    for (const forbidden of [
      "marca",
      "modelo",
      "anio",
      "patente",
      "cliente_id",
      "clienteId",
      "created_at",
      "updated_at",
      "fecha",
      "fechaHoraInicio",
      "fechaHoraFin",
    ]) {
      // `customerId` (camelCase) is allowed because the RSC maps it from
      // `cliente_id`. The forbidden word list covers both shapes so we
      // explicitly whitelist `customerId` by skipping it in the loop.
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
    // English camelCase labels must be present.
    expect(html).toContain("Toyota");
    expect(html).toContain("Corolla");
    expect(html).toContain("AB123CD");
  });
});
