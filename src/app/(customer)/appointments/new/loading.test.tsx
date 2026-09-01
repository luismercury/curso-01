/**
 * jsdom + RTL tests for `src/app/(customer)/appointments/new/loading.tsx`
 * — T-041 PR3 boundary coverage.
 *
 * The skeleton is a route-segment Suspense boundary Next.js auto-mounts
 * while the RSC shell awaits `auth()` + `getWorkshopConfig` +
 * `listServices`. It must:
 *   - render the section with `aria-busy="true"` so AT users hear
 *     "loading" (loading.tsx:42),
 *   - keep placeholder nodes `aria-hidden="true"` so they are not
 *     announced twice (loading.tsx:43-45),
 *   - expose a stable `aria-label` for the Suspense fallback (skeleton
 *     i18n hook for FASE 9).
 *
 * INV-08: rendered HTML must not leak Spanish/snake_case date strings
 * (`fecha`, `fechaHoraInicio`, `fechaHoraFin`) or any auth-secret strings
 * (password / JWT / token).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AppointmentsNewLoading from "./loading";

afterEach(() => cleanup());

describe("loading.tsx — /appointments/new skeleton (T-041 PR3)", () => {
  it("renders a section marked aria-busy='true' for assistive tech", () => {
    const { container } = render(<AppointmentsNewLoading />);
    const section = container.querySelector("section[aria-busy='true']");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-busy")).toBe("true");
  });

  it("exposes an aria-label so the Suspense fallback announces itself", () => {
    const { container } = render(<AppointmentsNewLoading />);
    const section = container.querySelector("section[aria-busy='true']");
    expect(section?.getAttribute("aria-label")).toBe("Loading appointments");
  });

  it("renders three placeholder nodes (heading + 2 lines)", () => {
    const { container } = render(<AppointmentsNewLoading />);
    const section = container.querySelector("section[aria-busy='true']");
    expect(section).not.toBeNull();
    // 1 <h1> + 2 <p> placeholders.
    const placeholders = section!.querySelectorAll("h1, p");
    expect(placeholders).toHaveLength(3);
  });

  it("marks every placeholder aria-hidden so AT does not double-announce", () => {
    const { container } = render(<AppointmentsNewLoading />);
    const section = container.querySelector("section[aria-busy='true']");
    const placeholders = section!.querySelectorAll("h1, p");
    for (const node of Array.from(placeholders)) {
      expect(node.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("is queryable by the Suspense aria-label (screen reader path)", () => {
    render(<AppointmentsNewLoading />);
    expect(
      screen.getByLabelText("Loading appointments"),
    ).toBeInTheDocument();
  });
});

describe("loading.tsx — INV-03 / INV-08 no-leak", () => {
  it("does not leak auth-secret strings (no password / jwt / token)", () => {
    const { container } = render(<AppointmentsNewLoading />);
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ["password", "jwt", "bearer ", "secret"]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("does not leak Spanish / snake_case date strings (INV-08)", () => {
    const { container } = render(<AppointmentsNewLoading />);
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
});
