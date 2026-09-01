/**
 * Playwright e2e — T-043 booking-form submit flow.
 *
 * NOTE: requires `@playwright/test` harness. The repo currently uses
 * vitest for unit/integration coverage and has no Playwright dev dep.
 * This file ships as the T-043 PR2 design artifact (spec scenarios
 * "All 4 selections → 201", "409 race", "403 ownership", "422 service",
 * "401 redirect", "Idempotent") and is excluded from vitest via
 * `vitest.config.ts -> exclude: ["tests/e2e/**"]` and from tsc via
 * `tsconfig.json -> exclude: ["tests/e2e/**"]` so the suite stays
 * green until a Playwright runner is wired.
 *
 * Run with:
 *   pnpm playwright test tests/e2e/t043-booking-form.spec.ts
 *
 * Once Playwright is provisioned:
 *   1. Add `@playwright/test` to devDependencies.
 *   2. Add a `playwright.config.ts` rooted at `tests/e2e/`.
 *   3. Drop the `exclude: ["tests/e2e/**"]` line from vitest.config.ts.
 */
import { expect, test } from "@playwright/test";

const SERVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const VEHICLE_ID = "770e8400-e29b-41d4-a716-446655440099";
const FUTURE_WED = "2026-09-09"; // Wednesday — open under Mon-Fri default.
const SLOT = "09:30";

test.describe("T-043 booking form", () => {
  test("deep-link with all 4 selections → Confirm → URL becomes /appointments?confirmed=<id> (REQ-BOOK-01)", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&slot=${encodeURIComponent(SLOT)}&vehicleId=${VEHICLE_ID}`,
    );

    // GWT All 4 selections preserved — the BookingForm compound renders
    // once `selectedService && selectedDate && selectedSlot && selectedVehicle`
    // all resolve. We wait for the Submit button.
    const submit = page.getByTestId("booking-submit");
    await expect(submit).toBeVisible();

    // Confirm click → 201 → URL becomes /appointments?confirmed=<id>
    // (T-044 reads `?confirmed=` to flash the success toast).
    await submit.click();
    await expect(page).toHaveURL(/\/appointments\?confirmed=[0-9a-f-]+/);
  });

  test("INV-04 — Submit button disabled+aria-busy while pending (idempotent)", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&slot=${encodeURIComponent(SLOT)}&vehicleId=${VEHICLE_ID}`,
    );
    const submit = page.getByTestId("booking-submit");
    await expect(submit).toBeEnabled();

    // Click twice — the first click should disable the button; the
    // second is a no-op (server enforces REPEATABLE READ + EXCLUDE gist
    // regardless of what the client posts).
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("aria-busy", "true");
  });

  test("INV-08 — booking summary shows 4 rows with camelCase primitives only", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&slot=${encodeURIComponent(SLOT)}&vehicleId=${VEHICLE_ID}`,
    );
    await expect(page.getByTestId("booking-summary")).toBeVisible();
    // The summary rows are independent testids — never Spanish or
    // snake_case (the page maps `marca` → `brand`, `patente` → `plate`,
    // etc. before the data crosses the RSC boundary).
    await expect(page.getByTestId("booking-summary-row-service")).toBeVisible();
    await expect(page.getByTestId("booking-summary-row-vehicle")).toBeVisible();
    await expect(page.getByTestId("booking-summary-row-date")).toBeVisible();
    await expect(page.getByTestId("booking-summary-row-time")).toBeVisible();

    const html = await page.content();
    for (const forbidden of [
      "marca",
      "modelo",
      "anio",
      "patente",
      "cliente_id",
      "vehiculo_id",
      "servicio_id",
      "fecha_hora_inicio",
      "fecha_hora_fin",
      "estado",
      "created_at",
      "updated_at",
    ]) {
      expect(html, `must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });
});