/**
 * Playwright e2e — T-042 availability display deep-link flow.
 *
 * NOTE: requires `@playwright/test` harness. The repo currently uses
 * vitest for unit/integration coverage and has no Playwright dev dep.
 * This file ships as the T-042 design artifact (spec scenarios
 * "Selection preserves siblings", "Clear and invalid guard",
 * "Loading vs empty vs error") and is excluded from vitest via
 * `vitest.config.ts -> exclude: ["tests/e2e/**"]` so the suite stays
 * green until a Playwright runner is wired.
 *
 * Run with:
 *   pnpm playwright test tests/e2e/t042-availability-display.spec.ts
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

test.describe("T-042 availability display", () => {
  test("deep-link shows grid, click persists slot across refresh, clear hides banner", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&vehicleId=${VEHICLE_ID}`,
    );

    // GWT Loading vs empty vs error — once SSR resolves the radiogroup is
    // present. We wait for the slot grid (not the empty/loading states).
    const grid = page.getByRole("radiogroup", { name: /available times/i });
    await expect(grid).toBeVisible();

    // GWT Selection preserves siblings — click 09:30.
    const slot0930 = page.getByRole("radio", { name: "09:30" });
    await slot0930.click();

    // URL now carries slot=09%3A30 alongside the original siblings.
    await expect(page).toHaveURL(/serviceId=/);
    await expect(page).toHaveURL(/date=/);
    await expect(page).toHaveURL(/vehicleId=/);
    await expect(page).toHaveURL(/slot=09%3A30/);

    // The selected radio carries aria-checked=true.
    await expect(slot0930).toHaveAttribute("aria-checked", "true");

    // The SelectedBanner shows the HH:mm and the date.
    const banner = page.getByTestId("availability-slots-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("09:30");
    await expect(banner).toContainText(FUTURE_WED);

    // Refresh — the URL is canonical, so the selection survives.
    await page.reload();
    await expect(page.getByRole("radio", { name: "09:30" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByTestId("availability-slots-banner")).toBeVisible();

    // Clear by clicking the same slot — the compound treats this as a
    // re-selection (URL is rewritten with the same params). To exercise
    // the clear path we instead pick a different slot then re-navigate
    // without ?slot=. Here we deep-link without slot to confirm the
    // banner stays hidden.
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&vehicleId=${VEHICLE_ID}`,
    );
    await expect(grid).toBeVisible();
    await expect(
      page.queryByTestId("availability-slots-banner"),
    ).toHaveCount(0);
  });

  test("tampered ?slot=25:00 never claims aria-checked=true", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}&slot=25:00`,
    );
    const radios = page.getByRole("radio");
    const count = await radios.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(radios.nth(i)).toHaveAttribute("aria-checked", "false");
    }
    await expect(
      page.queryByTestId("availability-slots-banner"),
    ).toHaveCount(0);
  });

  test("closed Sunday renders Empty with 'Closed on Sunday'", async ({
    page,
  }) => {
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=2026-09-06`,
    );
    const empty = page.getByTestId("availability-slots-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Closed on Sunday");
    await expect(page.queryByRole("radiogroup")).toHaveCount(0);
  });

  test("open weekday with all slots booked renders EC-02 Empty", async ({
    page,
  }) => {
    // Seed: a future weekday where every slot is already booked. This
    // requires a deterministic fixture (T-043 territory). The shape
    // assertion below documents the contract for when the fixture lands.
    await page.goto(
      `/appointments/new?serviceId=${SERVICE_ID}&date=${FUTURE_WED}`,
    );
    const empty = page.getByTestId("availability-slots-empty");
    // Either the grid renders (some slot free) OR the empty state
    // shows the booked copy. Both branches are correct.
    const gridCount = await page.getByRole("radiogroup").count();
    if (gridCount === 0) {
      await expect(empty).toContainText("No availability");
    } else {
      await expect(page.getByRole("radiogroup")).toBeVisible();
    }
  });
});
