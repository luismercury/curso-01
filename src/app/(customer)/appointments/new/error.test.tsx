/**
 * jsdom + RTL tests for `src/app/(customer)/appointments/new/error.tsx`
 * — T-041 PR3 boundary coverage.
 *
 * The error boundary is a Client Component (must be — Next.js App Router
 * rule). It maps common failure modes to a friendly banner:
 *
 *   - 401/unauthorized → `router.push('/login')` with a "Go to login" CTA
 *     (INV-03: never the auth helper, never the login form action).
 *   - anything else → `reset()` (Next.js re-renders the segment) with a
 *     "Try again" CTA.
 *
 * Coverage matrix:
 *   - 401 detection (`unauthorized` / `missing token` / `invalid token`).
 *   - other errors fall through to the generic branch.
 *   - `role="alert"` + `aria-labelledby` linkage.
 *   - `useEffect` logs the failure for FASE 9 observability.
 *   - INV-03 (no password / JWT / token strings on the wire) +
 *     INV-08 (no `fecha` / snake_case date fields) no-leak.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.fn();
const consoleErrorSpy = vi
  .spyOn(console, "error")
  .mockImplementation(() => undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: () => {} }),
}));

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppointmentsNewError from "./error";

afterEach(() => {
  cleanup();
  routerPush.mockClear();
  consoleErrorSpy.mockClear();
});

beforeEach(() => {
  routerPush.mockClear();
  consoleErrorSpy.mockClear();
});

function make401(message = "Unauthorized") {
  return Object.assign(new Error(message), { digest: "digest-401" });
}

function makeOther(message = "DB down") {
  return Object.assign(new Error(message), { digest: "digest-other" });
}

describe("error.tsx — 401 unauthorized routing (INV-03)", () => {
  it("matches 'unauthorized' → renders 'Go to login' CTA", () => {
    render(<AppointmentsNewError error={make401("Unauthorized")} reset={() => {}} />);
    const button = screen.getByRole("button", { name: /go to login/i });
    expect(button).toBeInTheDocument();
  });

  it("matches 'missing token' → renders 'Go to login' CTA", () => {
    render(<AppointmentsNewError error={make401("missing token")} reset={() => {}} />);
    expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument();
  });

  it("matches 'invalid token' → renders 'Go to login' CTA", () => {
    render(<AppointmentsNewError error={make401("invalid token: expired")} reset={() => {}} />);
    expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument();
  });

  it("clicking the CTA → router.push('/login')", () => {
    render(<AppointmentsNewError error={make401()} reset={() => {}} />);
    const button = screen.getByRole("button", { name: /go to login/i });
    fireEvent.click(button);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/login");
  });

  it("does NOT call reset() on the 401 branch", () => {
    const reset = vi.fn();
    render(<AppointmentsNewError error={make401()} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /go to login/i }));
    expect(reset).not.toHaveBeenCalled();
  });
});

describe("error.tsx — generic retry path", () => {
  it("non-401 error → renders 'Try again' CTA", () => {
    render(<AppointmentsNewError error={makeOther("DB down")} reset={() => {}} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("clicking 'Try again' → calls reset() (Next.js re-renders the segment)", () => {
    const reset = vi.fn();
    render(<AppointmentsNewError error={makeOther("timeout")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does NOT call router.push on the generic branch", () => {
    render(<AppointmentsNewError error={makeOther("network")} reset={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe("error.tsx — accessibility", () => {
  it("renders role='alert' so AT users hear the failure immediately", () => {
    const { container } = render(
      <AppointmentsNewError error={makeOther()} reset={() => {}} />,
    );
    const alert = container.querySelector("section[role='alert']");
    expect(alert).not.toBeNull();
  });

  it("aria-labelledby points at the rendered heading id", () => {
    const { container } = render(
      <AppointmentsNewError error={makeOther()} reset={() => {}} />,
    );
    const section = container.querySelector("section[role='alert']");
    const labelledBy = section?.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("appointments-new-error-heading");
    const heading = document.getElementById(labelledBy!);
    expect(heading).not.toBeNull();
  });

  it("401 branch renders the 'Session expired' heading", () => {
    render(<AppointmentsNewError error={make401()} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /session expired/i }),
    ).toBeInTheDocument();
  });

  it("other branch renders the 'Something went wrong' heading", () => {
    render(<AppointmentsNewError error={makeOther()} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });
});

describe("error.tsx — observability hook (FASE 9 surface)", () => {
  it("logs the error via console.error on mount (PR1 surface only)", () => {
    render(<AppointmentsNewError error={make401()} reset={() => {}} />);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const call = consoleErrorSpy.mock.calls[0]!;
    const payload = call[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      kind: "unauthorized",
      message: "Unauthorized",
      digest: "digest-401",
    });
  });

  it("tags the generic branch with kind='other'", () => {
    render(<AppointmentsNewError error={makeOther("boom")} reset={() => {}} />);
    const payload = consoleErrorSpy.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    expect(payload?.kind).toBe("other");
  });
});

describe("error.tsx — INV-03 / INV-08 no-leak", () => {
  it("does not render auth-secret strings (password / jwt / bearer)", () => {
    const { container } = render(
      <AppointmentsNewError error={make401()} reset={() => {}} />,
    );
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ["password", "jwt", "bearer "]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("does not leak Spanish / snake_case date strings (INV-08)", () => {
    const { container } = render(
      <AppointmentsNewError error={makeOther()} reset={() => {}} />,
    );
    const html = container.innerHTML;
    for (const forbidden of [
      "fecha",
      "fechaHoraInicio",
      "fechaHoraFin",
      "patente",
      "marca",
      "cliente_id",
      "servicio_id",
      "created_at",
      "updated_at",
    ]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("does not log the error's full message verbatim (defense in depth)", () => {
    // Even when the error message leaks a date string, the rendered HTML
    // must not echo it. (errors may come from server logs; UI copy is fixed.)
    const sneaky = Object.assign(new Error("fechaHoraInicio internal"), {
      digest: "digest-sneaky",
    });
    const { container } = render(
      <AppointmentsNewError error={sneaky} reset={() => {}} />,
    );
    expect(container.innerHTML).not.toContain("fechaHoraInicio");
  });
});
