/**
 * jsdom + RTL tests for `SelectedBanner.tsx`.
 * Coverage: hidden on tampered/inactive/no selection; renders name + duration + Continue; a11y.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let mockServiceId: string | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: () => {} }),
  useSearchParams: () => ({
    get: (key: string) => (key === "serviceId" ? mockServiceId : null),
  }),
}));

import { cleanup, render, screen } from "@testing-library/react";
import { ServiceSelector } from "./ServiceSelector";
import { SelectedBanner } from "./SelectedBanner";
import type { ServiceDTOJson } from "@/lib/api/services";

const ID_A = "550e8400-e29b-41d4-a716-446655440000";

function s(overrides: Partial<ServiceDTOJson> = {}): ServiceDTOJson {
  return {
    id: ID_A, name: "Oil Change", description: null, durationMinutes: 30,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderBanner(services: ServiceDTOJson[]) {
  return render(
    <ServiceSelector services={services}>
      <SelectedBanner />
    </ServiceSelector>,
  );
}

afterEach(() => { cleanup(); mockServiceId = null; });

describe("SelectedBanner — hidden when no selection", () => {
  it.each([
    ["renders nothing when no ?serviceId=", null],
    ["renders nothing when ?serviceId=garbage (tampered non-UUID)", "garbage"],
    ["renders nothing when ?serviceId= valid UUID absent from list", "00000000-0000-4000-a000-000000000099"],
  ] as const)("%s", (_label, id) => {
    mockServiceId = id;
    renderBanner([s({ id: ID_A, name: "Oil Change" })]);
    expect(screen.queryByTestId("selected-banner")).toBeNull();
  });

  it("renders nothing when the URL id matches an inactive entry", () => {
    mockServiceId = ID_A;
    renderBanner([s({ id: ID_A, active: false })]);
    expect(screen.queryByTestId("selected-banner")).toBeNull();
  });

  it("does not throw on garbage (no 500 path)", () => {
    mockServiceId = "not-a-uuid-at-all-just-garbage-input";
    expect(() => renderBanner([s({ id: ID_A })])).not.toThrow();
  });
});

describe("SelectedBanner — happy path", () => {
  it.each([
    [30, "30 min"],
    [90, "1 h 30 min"],
    [120, "2 h"],
  ] as const)("durationMinutes=%i renders '%s' + service name", (mins, expected) => {
    mockServiceId = ID_A;
    renderBanner([s({ id: ID_A, name: "Brakes", durationMinutes: mins })]);
    const banner = screen.getByTestId("selected-banner");
    expect(banner).toHaveTextContent(/Selected: Brakes/i);
    expect(banner).toHaveTextContent(expected);
  });
});

describe("SelectedBanner — Continue link", () => {
  it("Continue href preserves ?serviceId= for the T-041 chain", () => {
    mockServiceId = ID_A;
    renderBanner([s({ id: ID_A, name: "Oil Change" })]);
    const link = screen.getByTestId("selected-banner-continue");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(`/appointments/new?serviceId=${ID_A}`);
  });

  it("Continue link uses the resolved selected.id (defense in depth)", () => {
    mockServiceId = ID_A;
    renderBanner([s({ id: ID_A, name: "Oil Change" })]);
    const link = screen.getByTestId("selected-banner-continue");
    expect(link.getAttribute("href")).toContain(`serviceId=${ID_A}`);
    expect(link.getAttribute("href")).not.toContain("garbage");
  });
});

describe("SelectedBanner — accessibility surface", () => {
  it("role='status' + aria-live='polite' for screen-reader announcement", () => {
    mockServiceId = ID_A;
    renderBanner([s({ id: ID_A, name: "Oil Change" })]);
    const banner = screen.getByTestId("selected-banner");
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });
});