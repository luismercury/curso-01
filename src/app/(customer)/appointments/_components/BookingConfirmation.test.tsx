import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockSearch = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => mockSearch,
  usePathname: () => "/appointments",
}));

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingConfirmation } from "./BookingConfirmation";

const TZ = "America/Argentina/Buenos_Aires";
const turno = (o: Record<string, string> = {}) => ({
  id: "33333333-3333-4333-8333-333333333333",
  customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  vehicleId: "770e8400-e29b-41d4-a716-446655440099",
  serviceId: "550e8400-e29b-41d4-a716-446655440000",
  startDateTime: "2026-09-10T12:30:00.000Z",
  endDateTime: "2026-09-10T13:00:00.000Z",
  status: "PENDIENTE",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...o,
});

const renderCompound = (t: ReturnType<typeof turno>) => render(
  <BookingConfirmation turno={t} timezone={TZ}>
    <BookingConfirmation.Banner />
    <BookingConfirmation.Details />
    <BookingConfirmation.Dismiss />
  </BookingConfirmation>,
);

beforeEach(() => { replace.mockReset(); mockSearch = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("BookingConfirmation — Banner a11y (R2.1)", () => {
  it("PENDIENTE → role=status + aria-live + Intl BA 09:30", () => {
    renderCompound(turno());
    const b = screen.getByTestId("booking-confirmation-banner");
    expect(b.getAttribute("role")).toBe("status");
    expect(b.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByTestId("booking-confirmation-details").textContent).toMatch(/9:30|09:30/);
  });
  it("CANCELADO → no banner (neutral)", () => {
    renderCompound(turno({ status: "CANCELADO" }));
    expect(screen.queryByTestId("booking-confirmation-banner")).toBeNull();
  });
  it("XSS vehicleId → plain text, no <script>", () => {
    renderCompound(turno({ vehicleId: "<script>alert(1)</script>" }));
    expect(document.body.innerHTML).not.toContain("<script>alert(1)</script>");
    expect(document.body.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("BookingConfirmation.Dismiss — sibling-preserving (R2.2)", () => {
  it("strips only `confirmed`, keeps page/limit", async () => {
    mockSearch = new URLSearchParams("confirmed=33333333-3333-4333-8333-333333333333&page=2&limit=20");
    renderCompound(turno());
    await userEvent.setup().click(screen.getByTestId("booking-confirmation-dismiss"));
    expect(replace).toHaveBeenCalledWith("/appointments?page=2&limit=20", { scroll: false });
  });
});
