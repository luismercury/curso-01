// Vite 8 + Vitest 4 deprecate `vite-tsconfig-paths` in favour of the native
// `resolve.tsconfigPaths: true` option, but the native option does not yet
// propagate to inline child projects at this version. We register the plugin
// on each project explicitly and silence the deprecation noise at process
// level — see vitest.config.ts body.
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config for t039-vehicle-screen PR3.
 *
 * Two inline projects:
 *   - "node"    (default): unit + integration tests under src and tests.
 *   - "jsdom"            : RTL component tests under the _components folders
 *                           colocated with each route segment.
 *
 * Vitest 4.x does NOT auto-inherit root plugins on inline projects
 * (the migration guide notes that change lands in v5). We register the
 * tsconfig-paths plugin on each project explicitly so the alias `@/` works
 * inside every test file regardless of which project picks it up. The plugin
 * is registered on the root config too so non-project defaults still resolve.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    exclude: ["node_modules", ".next", "coverage"],
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.test.{ts,tsx}",
            "src/**/*.spec.{ts,tsx}",
            "tests/**/*.test.{ts,tsx}",
            "tests/**/*.spec.{ts,tsx}",
          ],
          exclude: [
            "**/_components/**",
            // route-segment RTL tests that need jsdom
            "src/app/(customer)/vehicles/loading.test.tsx",
            "src/app/(customer)/vehicles/error.test.tsx",
            "src/app/(customer)/appointments/new/loading.test.tsx",
            "src/app/(customer)/appointments/new/error.test.tsx",
            // T-042 e2e artifact uses @playwright/test which is not
            // provisioned in this repo. Excluded until a Playwright
            // harness is added.
            "tests/e2e/**",
          ],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "src/**" + "/_components/**/*.test.{ts,tsx}",
            "src/app/(customer)/vehicles/loading.test.tsx",
            "src/app/(customer)/vehicles/error.test.tsx",
            "src/app/(customer)/appointments/new/loading.test.tsx",
            "src/app/(customer)/appointments/new/error.test.tsx",
          ],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});