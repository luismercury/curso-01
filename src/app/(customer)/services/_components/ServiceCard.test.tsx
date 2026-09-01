/**
 * jsdom + RTL tests for `ServiceCard.tsx`.
 * Coverage: aria-pressed toggle, click -> router.push, formatDuration, cardSelected class.
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
import userEvent from "@testing-library/user-event";
import { ServiceSelector } from "./ServiceSelector";
import { ServiceList } from "./ServiceList";
import type { ServiceDTOJson } from "@/lib/api/services";

const ID_A = "550e8400-e29b-41d4-a716-446655440000";
const ID_B = "660e8400-e29b-41d4-a716-446655440001";

function s(overrides: Partial<ServiceDTOJson> = {}): ServiceDTOJson {
  return {
    id: ID_A, name: "Oil Change", description: "Standard oil and filter change",
    durationMinutes: 30, active: true,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderCards(services: ServiceDTOJson[]) {
  return render(
    <ServiceSelector services={services}>
      <ServiceList />
    </ServiceSelector>,
  );
}

afterEach(() => { cleanup(); mockServiceId = null; routerPush.mockClear(); });

describe("ServiceCard — aria-pressed toggle", () => {
  it("aria-pressed='false' when no service is selected", () => {
    renderCards([s({ id: ID_A, name: "Oil Change" })]);
    expect(screen.getByTestId("service-card").getAttribute("aria-pressed")).toBe("false");
  });

  it("aria-pressed='true' when service.id === selectedId", () => {
    mockServiceId = ID_A;
    renderCards([s({ id: ID_A, name: "Oil Change" })]);
    expect(screen.getByTestId("service-card").getAttribute("aria-pressed")).toBe("true");
  });

  it("only the selected card is pressed in a multi-card list", () => {
    mockServiceId = ID_A;
    renderCards([s({ id: ID_A, name: "Oil Change" }), s({ id: ID_B, name: "Tire Rotation" })]);
    const cards = screen.getAllByTestId("service-card");
    expect(cards[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(cards[1]?.getAttribute("aria-pressed")).toBe("false");
  });

  it("uses aria-label that names the service (a11y)", () => {
    renderCards([s({ id: ID_A, name: "Oil Change" })]);
    expect(screen.getByTestId("service-card").getAttribute("aria-label")).toBe("Select Oil Change");
  });
});

describe("ServiceCard — click writes the URL", () => {
  it("click on an unselected card -> router.push('?serviceId={id}',{scroll:false})", async () => {
    const user = userEvent.setup();
    renderCards([s({ id: ID_A })]);
    await user.click(screen.getByTestId("service-card"));
    expect(routerPush).toHaveBeenCalledWith(`?serviceId=${ID_A}`, { scroll: false });
  });

  it("click on the already-selected card is a no-op (URL would not change)", async () => {
    mockServiceId = ID_A;
    const user = userEvent.setup();
    renderCards([s({ id: ID_A })]);
    await user.click(screen.getByTestId("service-card"));
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("click on a non-selected card in a multi-card list pushes its own id", async () => {
    mockServiceId = ID_A;
    const user = userEvent.setup();
    renderCards([s({ id: ID_A }), s({ id: ID_B })]);
    const cards = screen.getAllByTestId("service-card");
    await user.click(cards[1]!);
    expect(routerPush).toHaveBeenCalledWith(`?serviceId=${ID_B}`, { scroll: false });
  });
});

describe("ServiceCard — formatDuration + description", () => {
  it.each([
    [30, "30 min"],
    [90, "1 h 30 min"],
    [120, "2 h"],
  ] as const)("durationMinutes=%i renders '%s'", (mins, expected) => {
    renderCards([s({ id: ID_A, durationMinutes: mins })]);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders the description when present", () => {
    renderCards([s({ id: ID_A, description: "Standard oil and filter change" })]);
    expect(screen.getByText("Standard oil and filter change")).toBeInTheDocument();
  });

  it("omits <p> when description is null", () => {
    renderCards([s({ id: ID_A, description: null })]);
    expect(screen.getByTestId("service-card").querySelector("p")).toBeNull();
  });
});

describe("ServiceCard — cardSelected class swap", () => {
  it("applies cardSelected class only to the selected card", () => {
    mockServiceId = ID_A;
    renderCards([s({ id: ID_A, name: "Oil Change" }), s({ id: ID_B, name: "Tire Rotation" })]);
    const cards = screen.getAllByTestId("service-card");
    expect(cards[0]?.className).toMatch(/cardSelected/);
    expect(cards[1]?.className).not.toMatch(/cardSelected/);
  });
});