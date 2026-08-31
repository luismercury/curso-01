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
| `src/app/(customer)/vehicles/loading.tsx` | 36 | Route-segment loading boundary (auto-Suspense by Next.js). 3-row skeleton with linear-gradient fill. |
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
- Commit (forthcoming): `feat(vehicle): add RSC shell foundation PR1` with RDD receipt metadata per `rdd-defect-workflow`/`work-unit-commits`.

### Next PR
**PR 2 — Client Islands + Styling** (Tasks 2.1..2.6): `VehicleProvider`/`VehicleList`/`VehicleForm` compound components, `vehicles.module.css`, `globals.css` token additions, wire islands into `page.tsx`, map `ApiError → 401/403/400/409` UX. Forecast ~400 LOC.