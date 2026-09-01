/**
 * jsdom + RTL tests for `src/app/(customer)/vehicles/_components/VehicleList.tsx`.
 *
 * The list is server-sorted (the page passes an ASC-sorted array), so the
 * component is a pure projection. The Provider context drives the
 * Empty/ErrorBanner variants.
 *
 * Coverage:
 *  - renders an <li> per vehicle with stable key={v.id}.
 *  - Empty `[]` shows the EmptyState ("No vehicles yet").
 *  - ASC ordering: parent-supplied order is preserved (no client resorting).
 *  - Banner-on-error is covered by the VehicleForm test (PR3.5) which
 *    drives Provider.createVehicle into a 403 to flip ErrorBanner on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// next/navigation requires an app-router context; mock the surface the
// Provider uses (useRouter). refresh/push are no-ops in this test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import { cleanup, render, screen } from "@testing-library/react";
import { VehicleProvider } from "./VehicleProvider";
import { VehicleList } from "./VehicleList";
import type { VehicleDTOJson } from "@/lib/api/vehicles";

const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";

function v(overrides: Partial<VehicleDTOJson> = {}): VehicleDTOJson {
  return {
    id: overrides.id ?? "660e8400-e29b-41d4-a716-446655440002",
    customerId: CUSTOMER_ID,
    brand: "Toyota",
    model: "Corolla",
    year: 2024,
    plate: "ABC123",
    createdAt: "2026-08-25T13:00:00.000Z",
    updatedAt: "2026-08-25T13:00:00.000Z",
    ...overrides,
  };
}

function renderList(initialVehicles: VehicleDTOJson[]) {
  return render(
    <VehicleProvider customerId={CUSTOMER_ID} maxYear={2027} initialVehicles={initialVehicles}>
      <VehicleList vehicles={initialVehicles} />
    </VehicleProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("VehicleList — list rendering", () => {
  it("renders one <li data-testid='vehicle-item'> per vehicle", () => {
    renderList([v({ id: "a", plate: "AAA111" }), v({ id: "b", plate: "BBB222" })]);
    const items = screen.getAllByTestId("vehicle-item");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("data-vehicle-id")).toBe("a");
    expect(items[1]?.getAttribute("data-vehicle-id")).toBe("b");
  });

  it("renders brand/model/year/plate per row", () => {
    renderList([v({ brand: "Peugeot", model: "207", year: 2011, plate: "ABC123" })]);
    expect(screen.getByText(/Peugeot 207 \(2011\)/)).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("preserves the server-supplied order (no client-side resorting)", () => {
    const oldest = v({ id: "old", plate: "OLD001", createdAt: "2026-01-01T00:00:00.000Z" });
    const middle = v({ id: "mid", plate: "MID001", createdAt: "2026-06-01T00:00:00.000Z" });
    const newest = v({ id: "new", plate: "NEW001", createdAt: "2026-12-01T00:00:00.000Z" });
    renderList([newest, middle, oldest]);
    const items = screen.getAllByTestId("vehicle-item");
    expect(items.map((el) => el.getAttribute("data-vehicle-id"))).toEqual(["new", "mid", "old"]);
  });
});

describe("VehicleList — Empty state", () => {
  it("renders 'No vehicles yet' for an empty list", () => {
    renderList([]);
    expect(screen.getByTestId("vehicle-empty")).toHaveTextContent(/no vehicles yet/i);
    expect(screen.queryByTestId("vehicle-list")).toBeNull();
  });
});