/**
 * jsdom + RTL tests for `src/app/(customer)/vehicles/_components/VehicleForm.tsx`.
 *
 * The form composes:
 *   - client Zod (`vehicleCreateInputSchema`) for early feedback.
 *   - Provider.createVehicle (POST via lib/api/vehicles) for the wire.
 *   - 4xx mapping per spec scenario "Error mapping and auth divergence".
 *
 * Coverage (Task 3.5):
 *   - empty brand -> inline field error before fetch.
 *   - short plate -> inline field error before fetch.
 *   - "abc-123" -> plate preview hint shows canonical "ABC123".
 *   - 201 -> form resets + router.refresh() called.
 *   - 409 -> ONLY the plate field errors, brand/model/year preserved.
 *   - 401 -> router.push('/login') called (handled by Provider).
 *   - 400 with issues -> inline field error from issues[0].path.
 *   - 403 -> banner set on the Provider context (ErrorBanner renders).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// next/navigation requires an app-router context; expose push/refresh spies.
const refreshMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

// createVehicle (HTTP helper) is mocked per-test.
const createVehicleRequestMock = vi.fn();
vi.mock("@/lib/api/vehicles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/vehicles")>("@/lib/api/vehicles");
  return {
    ...actual,
    createVehicle: (...args: unknown[]) => createVehicleRequestMock(...args),
  };
});

import { VehicleProvider } from "./VehicleProvider";
import { VehicleForm } from "./VehicleForm";
import { VehicleList } from "./VehicleList";
import { ApiError } from "@/lib/validators/vehicle";
import type { VehicleDTOJson } from "@/lib/api/vehicles";

const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";

function newDto(overrides: Partial<VehicleDTOJson> = {}): VehicleDTOJson {
  return {
    id: "660e8400-e29b-41d4-a716-446655440002",
    customerId: CUSTOMER_ID,
    brand: "Toyota",
    model: "Corolla",
    year: 2024,
    plate: "ABC123",
    createdAt: "2026-08-31T13:00:00.000Z",
    updatedAt: "2026-08-31T13:00:00.000Z",
    ...overrides,
  };
}

function renderForm() {
  return render(
    <VehicleProvider customerId={CUSTOMER_ID} maxYear={2027} initialVehicles={[]}>
      <VehicleForm />
    </VehicleProvider>,
  );
}

beforeEach(() => {
  refreshMock.mockClear();
  pushMock.mockClear();
  createVehicleRequestMock.mockReset();
});

afterEach(() => {
  cleanup();
});

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("vehicle-form-brand"), "Toyota");
  await user.type(screen.getByTestId("vehicle-form-model"), "Corolla");
  await user.type(screen.getByTestId("vehicle-form-year"), "2024");
  await user.type(screen.getByTestId("vehicle-form-plate"), "abc-123");
}

describe("VehicleForm — client Zod rejects before fetch", () => {
  it("empty brand shows inline error, fetch not called", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByTestId("vehicle-form-submit"));
    const brandInput = screen.getByTestId("vehicle-form-brand");
    expect(brandInput.getAttribute("aria-invalid")).toBe("true");
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => /brand/i.test(a.textContent ?? ""))).toBe(true);
    expect(createVehicleRequestMock).not.toHaveBeenCalled();
  });

  it("short plate 'AB1' (5 chars) shows plate error, fetch not called", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("vehicle-form-brand"), "Toyota");
    await user.type(screen.getByTestId("vehicle-form-model"), "Corolla");
    await user.type(screen.getByTestId("vehicle-form-year"), "2024");
    await user.type(screen.getByTestId("vehicle-form-plate"), "AB1");
    await user.click(screen.getByTestId("vehicle-form-submit"));
    const plateInput = screen.getByTestId("vehicle-form-plate");
    expect(plateInput.getAttribute("aria-invalid")).toBe("true");
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((a) => /plate/i.test(a.textContent ?? ""))).toBe(true);
    expect(createVehicleRequestMock).not.toHaveBeenCalled();
  });
});

describe("VehicleForm — plate preview hint", () => {
  it("shows 'Will be saved as: ABC123' when input is 'abc-123'", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("vehicle-form-plate"), "abc-123");
    expect(screen.getByText(/will be saved as: ABC123/i)).toBeInTheDocument();
  });
});

describe("VehicleForm — 201 success", () => {
  it("resets the form and calls router.refresh()", async () => {
    createVehicleRequestMock.mockResolvedValueOnce(newDto());
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    // Brand/model/year/plate cleared after success.
    expect((screen.getByTestId("vehicle-form-brand") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("vehicle-form-model") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("vehicle-form-year") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("vehicle-form-plate") as HTMLInputElement).value).toBe("");
  });
});

describe("VehicleForm — 409 keeps brand/model/year", () => {
  it("409 from server maps ONLY to plate field error; brand/model/year preserved", async () => {
    createVehicleRequestMock.mockRejectedValueOnce(
      new ApiError({ code: "PLATE_ALREADY_EXISTS", message: "Plate already exists", status: 409 }),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => /plate already exists/i.test(a.textContent ?? ""))).toBe(true);
    });
    // Brand/model/year preserved
    expect((screen.getByTestId("vehicle-form-brand") as HTMLInputElement).value).toBe("Toyota");
    expect((screen.getByTestId("vehicle-form-model") as HTMLInputElement).value).toBe("Corolla");
    expect((screen.getByTestId("vehicle-form-year") as HTMLInputElement).value).toBe("2024");
    // refresh not called for 409
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("VehicleForm — 401 pushes /login", () => {
  it("401 -> router.push('/login')", async () => {
    createVehicleRequestMock.mockRejectedValueOnce(
      new ApiError({ code: "UNAUTHORIZED", message: "Missing token", status: 401 }),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
  });
});

describe("VehicleForm — 400 inline issues", () => {
  it("400 with issues[0].path='plate' shows plate field error", async () => {
    createVehicleRequestMock.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Bad input",
        status: 400,
        issues: [{ path: ["plate"], message: "Plate invalid" }],
      }),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => /plate invalid/i.test(a.textContent ?? ""))).toBe(true);
    });
  });

  it("400 with issues[0].path='brand' shows brand field error (path-based mapping)", async () => {
    createVehicleRequestMock.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "Bad input",
        status: 400,
        issues: [{ path: ["brand"], message: "Brand invalid" }],
      }),
    );
    const user = userEvent.setup();
    renderForm();
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => /brand invalid/i.test(a.textContent ?? ""))).toBe(true);
    });
  });
});

describe("VehicleForm — 403 banner via Provider", () => {
  it("403 -> Provider sets banner error; VehicleList is replaced by ErrorBanner", async () => {
    createVehicleRequestMock.mockRejectedValueOnce(
      new ApiError({ code: "FORBIDDEN", message: "Not owner", status: 403 }),
    );
    const user = userEvent.setup();
    render(
      <VehicleProvider customerId={CUSTOMER_ID} maxYear={2027} initialVehicles={[newDto()]}>
        {/* Mount BOTH the list and the form so the Provider's banner
            surfaces inside the list when createVehicle flips the error. */}
        <VehicleList vehicles={[newDto()]} />
        <VehicleForm />
      </VehicleProvider>,
    );
    await fillValid(user);
    await user.click(screen.getByTestId("vehicle-form-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("vehicle-error-banner")).toBeInTheDocument();
      expect(screen.getByTestId("vehicle-error-banner")).toHaveTextContent(/Not owner/);
    });
  });
});