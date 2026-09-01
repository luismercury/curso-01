/**
 * jsdom + RTL tests for `ServiceList.tsx`.
 * Pure projection — server-sorted active-only list comes from RSC.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let mockServiceId: string | null = null;
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: () => {} }),
  useSearchParams: () => ({
    get: (key: string) => (key === "serviceId" ? mockServiceId : null),
  }),
}));

import { cleanup, render, screen } from "@testing-library/react";
import { ServiceSelector } from "./ServiceSelector";
import { ServiceList } from "./ServiceList";
import type { ServiceDTOJson } from "@/lib/api/services";

const ID_A = "550e8400-e29b-41d4-a716-446655440000";
const ID_B = "660e8400-e29b-41d4-a716-446655440001";

function s(overrides: Partial<ServiceDTOJson> = {}): ServiceDTOJson {
  return {
    id: ID_A, name: "Oil Change", description: null, durationMinutes: 30,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderList(services: ServiceDTOJson[]) {
  return render(
    <ServiceSelector services={services}>
      <ServiceList />
    </ServiceSelector>,
  );
}

afterEach(() => { cleanup(); mockServiceId = null; routerPush.mockClear(); });

describe("ServiceList — list rendering", () => {
  it("renders one <li data-testid='service-item'> per service with stable UUID keys", () => {
    renderList([s({ id: ID_A, name: "Oil Change" }), s({ id: ID_B, name: "Tire Rotation" })]);
    const items = screen.getAllByTestId("service-item");
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("data-service-id")).toBe(ID_A);
    expect(items[1]?.getAttribute("data-service-id")).toBe(ID_B);
  });

  it("preserves the server-supplied order (no client-side resorting)", () => {
    const oldest = s({ id: ID_A, createdAt: "2026-01-01T00:00:00.000Z" });
    const newest = s({ id: ID_B, createdAt: "2026-12-01T00:00:00.000Z" });
    renderList([newest, oldest]);
    const ids = screen.getAllByTestId("service-item").map((el) => el.getAttribute("data-service-id"));
    expect(ids).toEqual([ID_B, ID_A]);
  });

  it("renders inside <ul data-testid='services-list'>", () => {
    renderList([s({ id: ID_A })]);
    const ul = screen.getByTestId("services-list");
    expect(ul.tagName).toBe("UL");
  });
});

describe("ServiceList — Empty state", () => {
  it("renders 'No services available' for an empty list", () => {
    renderList([]);
    const empty = screen.getByTestId("services-empty");
    expect(empty).toHaveTextContent(/no services available/i);
    expect(screen.queryByTestId("services-list")).toBeNull();
    expect(screen.queryByTestId("service-item")).toBeNull();
  });
});