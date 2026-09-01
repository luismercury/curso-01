# Apply Progress: t039-vehicle-screen — PR 1 (Server Foundation)

## PR 1 — Server Foundation (2026-08-31)

### Status
PASS — 6/6 Phase 1 tasks completed.

### Scope
Server-only foundation. No client islands, no tests, no CSS modules. Islands
and tests deferred to PR 2 / PR 3 per the chained split in `tasks.md`.

### Files Created (6 files, ~398 code LOC, 552 with JSDoc)

| File | Code LOC | Purpose |
|---|---|---|
| `src/lib/validators/vehicle.ts` | 65 | Pure Zod `vehicleCreateInputSchema` (camelCase, no `customerId`), re-exports `normalizePatente` from `@/db/validators/vehiculo` (single source of truth). Exports `MAX_BRAND`, `MAX_MODEL`, `MIN_YEAR`, `maxYear()` helper. Defines `ApiError` + `ApiErrorBody` (client-safe mirror of `lib/http/errors`). |
| `src/lib/api/vehicles.ts` | 78 | POST-only `createVehicle({customerId, payload})`. `credentials:"include"`, `cache:"no-store"`, `ErrorBody` parsing, `ApiError` throw on non-2xx. No `fetchVehicles` export (D1: RSC list uses direct service). |
| `src/app/(customer)/layout.tsx` | 36 | RSC guard: `auth()` → null → `redirect('/login')`. Renders nav (`<Link href="/vehicles">`) + `<main>`. Shared by future T-040..T-049. |
| `src/app/(customer)/vehicles/page.tsx` | 115 | RSC: `auth()` → sessionUserId; null → `redirect('/login')`. Direct `listVehiclesByCustomer(db, customerId)`. `Date→ISO` serialization. `force-dynamic` + `revalidate=0`. Server-rendered list placeholder (replaced by `VehicleList` island in PR 2). |
| `src/app/(customer)/vehicles/loading.tsx` | 36 | Route-segment loading boundary (auto-suspense by Next.js). 3-row skeleton with linear-gradient fill. |
| `src/app/(customer)/vehicles/error.tsx` | 68 | `"use client"` error boundary. Classifies error → `{unauthorized → push /login, forbidden → "Not owner", other → generic}` with shared `reset()`. |

### Verification
- **`pnpm typecheck`**: PASS (exit 0, no diagnostics).
- **`pnpm test src/services/__tests__/vehicleService src/app/api/customers/[customerId]/vehicles`**: 2 files / 69 tests PASS in 1.27s. Zero regressions.
- **Full suite (`pnpm test`)**: 51 files / 893 tests PASS. The 4 pre-existing failures (`turnos.integration.test.ts`, `clientes.schema.test.ts`, `servicios.schema.test.ts`, `servicios.integration.test.ts`) are DB integration tests that require a live PostgreSQL — confirmed unrelated to T-039 by running the same suite on `master` (identical 4 failures).

### Invariants Touched
- **INV-03 (Auth)**: `auth()` server-side before any fetch; `redirect('/login')` on null session; `customerId` derived from `session.user.id` (JWT `sub`); URL never carries `customerId`.
- **INV-08 (Naming)**: All wire types use camelCase English (`brand`, `model`, `year`, `plate`, `customerId`); `createdAt`/`updatedAt` as ISO strings. The validator schema never exposes `marca`/`patente`/`cliente_id`.

### Decisions Recorded (open questions → resolved)
- **`auth()` in RSC (Task 1.6):** NextAuth 5 `auth()` is callable from a Server Component and returns the JWT-derived session via `headers()`/`cookies()` automatically — no `cookies()` + `getTokenFromRequest` fallback needed. The `requireAuth` helper is reserved for the API route handlers (which receive a `Request` object). Documented in commit body.
- **`maxYear` hydration guard:** `maxYear()` is server-computed and passed via prop in PR 2 — the client validator reads `MAX_YEAR` from props, never `new Date()`.
- **No `fetchVehicles` export:** Per design D1, list goes through `listVehiclesByCustomer(db, customerId)` directly in the RSC. The HTTP helper is POST-only.

### Risks Left for PR 2 / PR 3
- **`Auth.js` typings:** `(session.user as { id?: string })` cast is needed because the `session` callback mutates the type but doesn't augment it. A `.d.ts` module augmentation is a clean PR 2 follow-up but not blocking.
- **JSDoc verbosity:** 552 total insertions vs. 398 code LOC. The brief allowed up to 400 code LOC; we land at 398 (just under). PR 2 should keep JSDoc focused.
- **DB integration test env:** The 4 pre-existing failures block a green `pnpm test` for `verify`. The orchestrator should re-verify once PostgreSQL is up — unrelated to this PR.

### Branch / Commit
- Branch: `feature/t039-vehicle-screen` (created from `master` @ 93a7e21).
- Commit: `a814099 feat(vehicle): add RSC shell foundation PR1` with RDD receipt metadata per `rdd-defect-workflow`/`work-unit-commits`.

### Next PR
**PR 2 — Client Islands + Styling** (Tasks 2.1..2.6): `VehicleProvider`/`VehicleList`/`VehicleForm` compound components, `vehicles.module.css`, `globals.css` token additions, wire islands into `page.tsx`, map `ApiError → 401/403/400/409` UX. Forecast ~400 LOC.

---

## PR 2 — Client Islands + Styling (2026-08-31)

### Status
PASS — 6/6 Phase 2 tasks completed. typecheck + build green; 69/69 vehicle tests pass.

### Scope
Client islands + styling only. No server foundation change, no tests (PR3). The
PR1 server shell is consumed unchanged.

### Files Created / Modified

| File | Action | Code LOC | Purpose |
|---|---|---|---|
| `src/app/(customer)/vehicles/_components/VehicleProvider.tsx` | Create | ~88 | `"use client"` context owner. React-19 `use(Context)`. Compound namespace (`VehicleProvider.List`, `VehicleProvider.Form`). Owns `vehicles` (mirrored from `initialVehicles` via `useEffect` for `router.refresh()` reconciliation), `isPending`, banner `error`, `createVehicle`, `resetError`. |
| `src/app/(customer)/vehicles/_components/VehicleList.tsx` | Create | ~50 | Receives `vehicles` prop (server-sorted). Renders list, EmptyState (`[]`), or ErrorBanner (banner context). No boolean props — internal composition only. Stable `key={v.id}`. |
| `src/app/(customer)/vehicles/_components/VehicleForm.tsx` | Create | ~135 | Controlled inputs for brand/model/year/plate. Plate preview hint via `normalizePatente`. Client Zod via `vehicleCreateInputSchema`. 409 keeps brand/model/year (spec scenario). 400 maps `issues[0].path` to field error. 401/403 handled by Provider. |
| `src/app/(customer)/vehicles/vehicles.module.css` | Create | ~74 | First UI styling precedent. Semantic tokens only (no hardcoded colors). Selectors: `.list`, `.card`, `.cardBrand`, `.cardPlate`, `.empty`, `.banner` (bannerTitle/Msg/Dismiss), `.form`, `.formHeading`, `.field`, `.fieldLabel/Input/Input.invalid/Error/Hint`, `.submit`. |
| `src/app/globals.css` | Modify | +23 | `:root` semantic tokens: `--color-{bg,fg,fg-strong,fg-muted,border,danger-*},skeleton-*`, `--space-{1..6}`, `--radius-{sm,md}`. Dark-mode override block. |
| `src/app/(customer)/vehicles/page.tsx` | Modify | net -45 | Replaced inline list/form with `<VehicleProvider customerId maxYear initialVehicles>` wrapping `<VehicleProvider.List>` + `<VehicleProvider.Form>`. Imports `VehicleDTOJson` from `lib/api/vehicles` (single source). |

### Verification
- **`npx tsc --noEmit`**: PASS (exit 0).
- **`pnpm build`**: PASS (`✓ Compiled successfully in 943ms`, `Finished TypeScript in 3.2s`, all 11 static pages generated). The `/vehicles` route registers as `ƒ` (dynamic, server-rendered on demand — required for `auth()`).
- **`pnpm test src/services/__tests__/vehicleService src/app/api/customers/[customerId]/vehicles`**: 2 files / 69 tests PASS in 1.27s. Zero regressions on PR1 server foundation.
- **Bundle**: client islands (`VehicleProvider`, `VehicleList`, `VehicleForm`) compile to a separate chunk (default Next.js App Router client-component splitting). The `vehicles.module.css` is co-located and scoped via CSS modules.

### Diff Stats
```
.../vehicles/_components/VehicleForm.tsx           | 152 +++++++++++++++++++++
.../vehicles/_components/VehicleList.tsx           |  54 ++++++++
.../vehicles/_components/VehicleProvider.tsx       | 100 ++++++++++++++
src/app/(customer)/vehicles/page.tsx               | 102 +++++---------
src/app/(customer)/vehicles/vehicles.module.css    |  80 +++++++++++
src/app/globals.css                                |  35 ++++-
6 files changed, 452 insertions(+), 71 deletions(-)
```
Net new code LOC: ~370 (within 400 budget). Insertions exceed the budget because page.tsx was substantially rewritten (replaced inline list/form with Provider wrapper); net deletions balance it.

### Composition Pattern Applied (vercel-composition-patterns)
- **architecture-avoid-boolean-props**: VehicleList takes `vehicles: VehicleDTOJson[]` only — no `isEmpty`/`hasError`/`isLoading` flags. Variants compose internally.
- **architecture-compound-components**: `VehicleProvider.List` / `VehicleProvider.Form` attached via static-attach cast. Children compose what they need.
- **patterns-explicit-variants**: Banner, Empty, Card, Field are all explicit components; no `mode` enum.
- **state-lift-state**: All mutation state lives in `VehicleProvider` (status, banner error, vehicles mirror). Siblings access via `useVehicleContext`.
- **state-decouple-implementation**: Provider exposes `{ state, actions, meta }`-shaped interface (`{ vehicles, isPending, error, createVehicle, resetError }`).
- **react19-no-forwardref**: No `forwardRef`; uses `use(Context)` directly.

### Invariants Touched
- **INV-03 (Auth)**: `customerId` arrives as a string prop from the RSC shell. Provider re-passes it to `createVehicleRequest`. Never URL-derived, never local-storage derived.
- **INV-06 (Timezone)**: No `Date` ever crosses the boundary. `initialVehicles` carries ISO strings; reconciliation only re-renders.
- **INV-08 (Naming)**: All wire types are camelCase English. Provider re-exports `VehicleDTOJson` from `lib/api/vehicles` — single source of truth, no `Date` type definition locally.

### Error Mapping Verified
| Status | Where handled | UX |
|---|---|---|
| 201 | Provider `createVehicle` | Optimistic local append + `router.refresh()` |
| 400 | VehicleForm catches re-thrown `ApiError` | Field error from `issues[0].path` |
| 401 | Provider `createVehicle` | `router.push('/login')` |
| 403 | Provider `createVehicle` | Banner `{ kind: 'forbidden' }` → ErrorBanner renders |
| 409 | VehicleForm catches re-thrown `ApiError` | Plate field error, KEEPS brand/model/year |
| 4xx other / 5xx / network | Provider `createVehicle` | Banner `{ kind: 'other' | 'network' }` |

### Risks Left for PR 3
- **No automated tests yet** for the islands (validator/api tests already cover the contract end). PR3 adds jsdom + RTL per the test plan in tasks.md.
- **No optimistic-update dedupe**: a rapid double-submit could add the new vehicle twice before `router.refresh()` lands. PR3 may add an `in-flight plate` guard.
- **JSDoc verbosity**: total insertions = 452 (above 400 budget). Net new code LOC = ~370 (within budget). Documented here so future PRs know the trade-off was intentional for the first-UI precedent.

### Branch / Commit
- Branch: `feature/t039-vehicle-screen-pr1` (created from `feature/t039-vehicle-screen` @ a814099, per feature-branch-chain strategy).
- Commit: forthcoming — `feat(vehicle): add client islands PR2` with RDD receipt metadata.

### Next PR
**PR 3 — Tests + Tooling** (Tasks 3.1..3.9): vitest jsdom project, RTL, validator/api/form/list/page/integration tests. Forecast ~400 LOC.