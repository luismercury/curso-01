/**
 * jsdom + RTL test for `src/app/(customer)/vehicles/loading.tsx`.
 *
 * The skeleton is a route-segment Suspense boundary Next.js auto-mounts
 * while the RSC shell awaits auth() + listVehiclesByCustomer. It must:
 *  - render 3 placeholder rows (data-testid="vehicle-list-skeleton"),
 *  - expose aria-busy="true" on the section so AT users hear "loading".
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import VehiclesLoading from "./loading";

afterEach(() => cleanup());

describe("loading.tsx — /vehicles skeleton", () => {
  it("renders a 3-row skeleton list (data-testid='vehicle-list-skeleton')", () => {
    render(<VehiclesLoading />);
    const skeleton = screen.getByTestId("vehicle-list-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.querySelectorAll("li")).toHaveLength(3);
  });

  it("marks the section aria-busy='true' for assistive tech", () => {
    const { container } = render(<VehiclesLoading />);
    const section = container.querySelector("section[aria-busy='true']");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-busy")).toBe("true");
  });
});