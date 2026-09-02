import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Component, type ReactNode } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/appointments",
}));

import { cleanup, render, screen } from "@testing-library/react";

import { AppointmentList, useAppointment } from "./AppointmentList";

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

beforeEach(() => {});
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