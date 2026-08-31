# Tasks: t039-vehicle-screen — Vehicle Management Screen

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100 (10 new + 4 modified + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Runtime harness | N/A — `pnpm build` + `pnpm test` |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Work Units

- **PR 1** (base `feature/t039-vehicle-screen`): server foundation. Test `pnpm test src/lib/validators/vehicle` + `pnpm typecheck`. Rollback: delete `(customer)/`, `lib/api/vehicles.ts`, `lib/validators/vehicle.ts`.
- **PR 2** (base `feature/t039-vehicle-screen-pr1`): client islands + CSS. Test `pnpm typecheck` + RTL smoke. Rollback: revert `_components/*`, `vehicles.module.css`, `globals.css`.
- **PR 3** (base `feature/t039-vehicle-screen-pr2`): tests + tooling. Test `pnpm test` + `pnpm build`. Rollback: revert `vitest.config.ts`, `package.json`, test files.

## Phase 1: Server Foundation (PR 1)

- [x] 1.1 `src/lib/validators/vehicle.ts` — pure Zod `vehicleCreateInputSchema` (`brand`/`model` trim 2..100, `year` 1900..maxYear, `plate` post-`normalizePatente` `/^[A-Z0-9]{6,7}$/`); export `normalizePatente`, `MAX_BRAND`, `MAX_MODEL`, `MIN_YEAR`.
- [x] 1.2 `src/lib/api/vehicles.ts` — POST-only `createVehicle` (`credentials:"include"`, `cache:"no-store"`); `ApiError {code,message,issues?,status}`; parse `ErrorBody`. (No `fetchVehicles` export — D1: RSC list uses direct service.)
- [x] 1.3 `src/app/(customer)/layout.tsx` — RSC guard via `auth()`, nav link `/vehicles`.
- [x] 1.4 `src/app/(customer)/vehicles/page.tsx` — RSC: `auth()`→`customerId`; null→`redirect('/login')`; `listVehiclesByCustomer(db,id)` direct; `Date→ISO` serialization; `force-dynamic`.
- [x] 1.5 `loading.tsx` (skeleton rows) + `error.tsx` (`"use client"`; `FORBIDDEN`→"Not owner"; `reset()`).
- [x] 1.6 Probe `auth()` RSC vs `cookies()`+`getTokenFromRequest` fallback; record in commit body.

## Phase 2: Client Islands + Styling (PR 2)

- [ ] 2.1 `_components/VehicleProvider.tsx` — `"use client"` context `{vehicles, status, createVehicle(p)}`; no boolean props.
- [ ] 2.2 `_components/VehicleList.tsx` — DTO[] ASC; children `Empty` ("No vehicles yet"), `ErrorBanner`.
- [ ] 2.3 `_components/VehicleForm.tsx` — `"use client"` controlled inputs; plate preview; client Zod; 201→`router.refresh()`; 400 inline per `issues[0].path`; 409 plate field (keep brand/model); 401→`router.push('/login')`; 403→banner.
- [ ] 2.4 `vehicles.module.css` — tokens, shimmer, card, button; no Tailwind.
- [ ] 2.5 Modify `src/app/globals.css` — `:root` custom properties (color, spacing, radius).
- [ ] 2.6 Wire `<VehicleProvider>` in `page.tsx`; pass ISO `string` props (no `Date` leak).

## Phase 3: Tests + Tooling (PR 3)

- [ ] 3.1 `vitest.config.ts` — `projects`: existing `node` + new `jsdom` matching `**/_components/**/*.test.{ts,tsx}`.
- [ ] 3.2 `package.json` — devDeps `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; script `test:ui`.
- [ ] 3.3 `lib/validators/vehicle.test.ts` — `normalizePatente("abc-123")==="ABC123"`; reject `AB1`/`AB!@#`/`year 1800`/`maxYear+1`/`brand "a"`; trim model.
- [ ] 3.4 `lib/api/vehicles.test.ts` — parse array/single; throw `ApiError` on 401/403/400/409.
- [ ] 3.5 `_components/VehicleForm.test.tsx` (jsdom+RTL) — empty brand, short plate, `ABC123` preview, 201→`router.refresh`, 409 keeps brand/model, 401→push, 400 inline.
- [ ] 3.6 `_components/VehicleList.test.tsx` (jsdom) — ASC, Empty `[]`, ErrorBanner on error.
- [ ] 3.7 `vehicles/page.test.tsx` (mock `auth`+`redirect`) — null→redirect; service w/ `customerId`; Date→ISO; 401-before-403.
- [ ] 3.8 `tests/integration/vehicles-routing.test.ts` (DB+`jose`) — no-JWT→401 `{UNAUTHORIZED}` pre-validation; non-owner bad uuid→403 `{FORBIDDEN}`; DTO camelCase ISO (no `marca`/`patente`/`cliente_id`/`fecha`); `createdAt ASC`.
- [ ] 3.9 `tests/integration/dto-leak.test.ts` — `toVehiculoDTO` excludes snake/Spanish.

## Phase 4: Verification

- [ ] 4.1 `pnpm typecheck` + `lint` + `test` + `build` all green; no `server-only` in client bundle.
- [ ] 4.2 Smoke: login→`/vehicles` lists own DTOs; create→list updates; dup plate→field error keeps values; expired session→`/login`.
