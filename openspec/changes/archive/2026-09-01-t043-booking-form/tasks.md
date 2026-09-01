# Tasks: t043-booking-form — Crear formulario de reserva

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~290 + PR2 ~280 = ~570 total (430 prod + 140 test) |
| 400-line budget risk | High (>400 total) |
| Chained PRs recommended | Yes (feature-branch-chain, 2 PRs) |
| Suggested split | PR1 VehicleSelector + page wiring + 0-vehicle CTA + tests; PR2 BookingForm + `lib/api/appointments` + Summary + 409/403/422/401 + pending + tests |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (locked) |
| Decision needed before apply | No — preflight cached feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

> ~570L > 400 cap; `auto-chain` proceeds with 2-PR feature-branch-chain.
> PR1 base = `master`. PR2 base = PR1 tip.
> PR1 = VehicleSelector + page wiring + 0-vehicle CTA + tests (~290).
> PR2 = BookingForm + `lib/api/appointments` + Summary + errors + pending + tests (~280).
> PR1 must NOT wire the Confirm button (disabled or absent until PR2).

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|----|---------------------|-----------------|-------------------|
| 1.1 | `vehicleIdSchema` validator | PR1 | `pnpm vitest run src/lib/validators/vehicleId.test.ts` | N/A (pure validator) | new file |
| 1.2 | RSC `listVehiclesByCustomer` in `Promise.all` + page composition | PR1 | `pnpm vitest run src/app/(customer)/appointments/new/page.test.tsx` | `pnpm dev` deep-link `?serviceId=&date=&slot=` | `page.tsx` additive (T-042 state preserved) |
| 1.3 | VehicleSelector compound + CSS + 0-vehicle CTA | PR1 | `pnpm vitest run src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` | `pnpm dev` click card → `?vehicleId=` | new files |
| 1.4 | VehicleSelector jsdom tests (select/clear/tampered/empty/banner) | PR1 | same as 1.3 | jsdom | new tests |
| 1.5 | page.test.tsx delta (vehicles wire + 0-vehicles + auth gate + INV-08 no-leak) | PR1 | same as 1.2 | vitest | extends existing |
| 2.1 | `lib/api/appointments.ts` helper + envelope test | PR2 | `pnpm vitest run src/lib/api/appointments.test.ts` | N/A (fetch stub) | new file |
| 2.2 | BookingForm compound + CSS + pending gate | PR2 | `pnpm vitest run src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` | `pnpm dev` full chain deep-link → Confirm | new files |
| 2.3 | page.tsx delta (compose BookingForm when all 4 valid) | PR2 | same as 1.2 | `pnpm dev` Confirm click | `page.tsx` additive |
| 2.4 | BookingForm jsdom tests (enable/409/403/422/401/idempotent/TZ) | PR2 | same as 2.2 | jsdom | new tests |
| 2.5 | e2e Playwright artifact | PR2 | `pnpm playwright test t043` (excluded) | browser full chain | tests only |

## Phase 1: PR1 — VehicleSelector + Page Wiring

Branch: `feature/t043-booking-form-pr1` from `master`. PR1 base = `master`.

- [x] 1.1 Create `src/lib/validators/vehicleId.ts` — `vehicleIdSchema = z.string().uuid()` + `isOwner(vehicle, userId)`; pure, client-safe, no `server-only`. Files: `vehicleId.ts`. Deps: none. Est: ~12 LOC.

- [x] 1.2 Create `src/lib/validators/vehicleId.test.ts` — vitest: uuid accept/reject, `isOwner` true/false; `safeParse` never throws. Files: `vehicleId.test.ts`. Deps: 1.1. Est: ~30 LOC.

- [x] 1.3 Modify `src/app/(customer)/appointments/new/page.tsx` — extend `Promise.all` with `listVehiclesByCustomer(db, session.user.id)`; map via `lib/api/vehicles.ts` `toJson` (INV-08); pass `vehicles` + `userId` to `<VehicleSelector>`; if `vehicles.length === 0` render only the CTA branch (no DateSelector/AvailabilitySlots/BookingForm yet). Keep `force-dynamic`, auth gate, conditional availability fetch unchanged. Files: `page.tsx`. Deps: 1.1, T-040/T-041/T-042. Est: +30 prod LOC. [GWT Auth, Zero vehicles, Authenticated vehicles]

- [x] 1.4 Create `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx` + `VehicleCard.tsx` — `"use client"`; `createContext` + `use()`; `useSearchParams()` reads `?vehicleId=`; `vehicleIdSchema.safeParse` + `vehicles.some(v=>v.id===candidate && v.customerId===userId)` defense-in-depth; `select(id)` → `router.push("?vehicleId="+id, {scroll:false})`; `clear()` → `params.delete("vehicleId")` via `URLSearchParams(searchParams.toString())`. Statics: `List`, `Card` (atomic `<button type="button" role="radio" aria-checked>` showing `brand model (year) — plate`), `SelectedBanner` (only when `selected && selected.customerId === userId`), `ClearButton`, `Empty` (CTA `/vehicles` when `vehicles.length === 0`). Files: `VehicleSelector.tsx`, `VehicleCard.tsx`. Deps: 1.1. Est: ~140 prod LOC. [GWT Selection, Clear, Tampered]

- [x] 1.5 Extend `src/app/(customer)/appointments/new/appointments.module.css` — add `.vehicleList`, `.vehicleCard`, `.vehicleSelected`, `.vehicleEmpty`, `.vehicleEmptyCta` tokens. No Tailwind. Files: `appointments.module.css`. Deps: none. Est: +30 prod LOC.

- [x] 1.6 Create `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` — vitest jsdom + RTL + `userEvent.click`: List renders one radio per vehicle; click uuidV → `router.push("?vehicleId="+uuidV, {scroll:false})`; clear → URL without `vehicleId`; tampered `?vehicleId=garbage` or `?vehicleId=uuidV-other-user` → no `aria-checked`, no 500; `Empty` shows CTA `/vehicles` when `vehicles=[]`. Files: `VehicleSelector.test.tsx`. Deps: 1.4, 1.5. Est: ~80 test LOC. [GWT Selection, Clear, Tampered, Zero vehicles]

- [x] 1.7 Extend `src/app/(customer)/appointments/new/page.test.tsx` — RSC delta: vehicles wire assertion, 0-vehicles CTA, auth null → redirect, INV-08 no-leak (`marca`/`patente`/`cliente_id` absent from rendered tree). Files: `page.test.tsx`. Deps: 1.3, 1.4. Est: +30 test LOC. [GWT Auth, Zero vehicles, INV-08]

- [x] 1.8 Run `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` — full suite green; PR1 budget ~290 (<400). Files: all. Deps: 1.x.

- [x] 1.9 Commit `feat(appointments): T-043 PR1 vehicle selector (RSC + compound, no submit)` with RDD receipt. Branch: `feature/t043-booking-form-pr1` from `master`. PR1 base = `master`. Files: all. Deps: 1.8.

## Phase 2: PR2 — BookingForm + Submit + Error Handling

Branch: `feature/t043-booking-form-pr2` from `feature/t043-booking-form-pr1` tip. PR2 base = PR1 tip.

- [x] 2.1 Create `src/lib/api/appointments.ts` — `submitBooking({vehicleId, serviceId, startDateTime})` POSTs JSON to `/api/appointments` (`credentials:"include"`, `Content-Type:"application/json"`); maps `ErrorBody` envelope → `ApiError` (mirror `lib/api/vehicles.ts:42-49`); exports `TurnoDTOJson` shape. Files: `appointments.ts`. Deps: T-039 route.ts. Est: ~30 prod LOC.

- [x] 2.2 Create `src/lib/api/appointments.test.ts` — covers 201/409/403/422/401/400 + envelope mapping; TZ reconstruction `${date}T${slot}:00-03:00` (BA fixed, `Intl` assert + `TODO(DST)`). Files: `appointments.test.ts`. Deps: 2.1. Est: ~50 test LOC. [GWT TZ, All 4 selections preserved]

- [x] 2.3 Create `src/app/(customer)/appointments/new/_components/BookingForm.tsx` + `SummaryCard.tsx` — `"use client"`; `useState<boolean> isPending` + `try/finally`; reads 4 selections from props (all 4 guaranteed valid at mount by the page); `Summary` static (4 rows: Service/Vehicle/Date/Time); `Submit` static (`<button type="button" disabled={isPending} aria-busy={isPending}>` calling `submitBooking`); `ErrorBanner` static (`role="alert"`, dismissed on success). On 201 → `router.push("/appointments?confirmed="+dto.id, {scroll:false})` for T-044. On 409 → `setError("El horario seleccionado ya no se encuentra disponible")` + `router.refresh()`. On 403 → `setError("Vehicle not found or not owned")` + `params.delete("vehicleId")` + `router.refresh()`. On 422 → `setError("Service not active")` + `params.delete("serviceId")` + `router.push("/services", {scroll:false})`. On 401 → `window.location.assign("/login?next="+encodeURIComponent(pathname+search))`. Files: `BookingForm.tsx`, `SummaryCard.tsx`. Deps: 2.1. Est: ~130 prod LOC. [GWT All 4 → 201, 409 race, 403 ownership, Idempotent]

- [x] 2.4 Extend `src/app/(customer)/appointments/new/appointments.module.css` — add `.summary`, `.summaryRow`, `.submit`, `.submitPending`, `.errorBanner`, `.errorBannerDestructive`. No Tailwind. Files: `appointments.module.css`. Deps: none. Est: +25 prod LOC.

- [x] 2.5 Modify `src/app/(customer)/appointments/new/page.tsx` — when `selectedService && selectedDate && selectedSlot && selectedVehicle` all valid, render `<BookingForm serviceId={...} date={...} slot={...} vehicleId={...} serviceName={...} vehicleLabel={...}>`; remove disabled state from PR1. Files: `page.tsx`. Deps: 2.3. Est: +20 prod LOC.

- [x] 2.6 Create `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` — vitest jsdom + RTL + `userEvent.click`: enable when 4 valid; click → `submitBooking` called with TZ-corrected `startDateTime` (`2026-09-10T09:30:00-03:00` for `date=2026-09-10&slot=09:30`); 201 → `router.push("/appointments?confirmed="+id, {scroll:false})`; 409 → `setError` + `router.refresh()`; 403 → `params.delete("vehicleId")`; 422 → `params.delete("serviceId")` + `router.push("/services")`; 401 → `window.location.assign("/login?next=...")`; double-click → `disabled` after first click → only 1 `submitBooking` call (idempotent). Files: `BookingForm.test.tsx`. Deps: 2.3, 2.4. Est: ~100 test LOC. [GWT All 4 → 201, 409 race, 403 ownership, 422 service, 401 redirect, Idempotent]

- [x] 2.7 Add `tests/e2e/t043-booking-form.spec.ts` — Playwright (excluded per T-042 pattern): deep-link `?serviceId=&date=&slot=&vehicleId=` → Confirm → 201 → URL becomes `/appointments?confirmed=<id>`. Excluded from `vitest.config.ts` + `tsconfig.json`. Files: `t043-booking-form.spec.ts`. Deps: 2.6. Est: ~60 test LOC.

- [x] 2.8 Extend `src/app/(customer)/appointments/new/page.test.tsx` — RSC delta: `BookingForm` rendered when all 4 valid; absent otherwise; INV-08 no-leak continues. Files: `page.test.tsx`. Deps: 2.5. Est: +30 test LOC. [GWT All 4 selections preserved, INV-08]

- [x] 2.9 Run `pnpm vitest run` + `pnpm typecheck` + `pnpm build` + `pnpm lint` — full suite green; PR2 budget ~280 (<400). Files: all. Deps: 2.x.

- [x] 2.10 Commit `feat(appointments): T-043 PR2 booking form (submit + 409/403/422/401)` with RDD receipt. PR2 base = PR1 tip. Files: all. Deps: 2.9.

## Phase 3: Verify + Archive (after PR2 merged to master)

- [x] 3.1 Run independent `sdd-verify` agent against merged master; PASS required for archive. Files: `openspec/changes/t043-booking-form/verify-report.md`.

- [x] 3.2 Run `sdd-archive` agent to move change to `openspec/changes/archive/2026-09-01-t043-booking-form/` + sync `openspec/specs/booking-form/spec.md` delta + record receipt. Files: archive dir.

- [x] 3.3 `git push origin master` (or use `gentle-ai review` gate per RDD). Files: all.

## DAG (acyclic, feeds T-044)

`1.1→1.2` · `1.1,1.3→1.4→1.5→1.6→1.7→1.8→1.9` (PR1, base=`master`)
`2.1→2.2` · `2.1→2.3→2.5→2.6→2.7→2.8→2.9→2.10` (PR2, base=PR1 tip)
`1.9→2.1` (PR2 branches off PR1 tip).
`2.10→3.1→3.2→3.3` (verify + archive + push).

Predecessors: T-025/T-039/T-040/T-041/T-042 ALL DONE at `master=eb4bad0`. Verified.
Successor: T-044 reads `?confirmed=<turnoId>` on `/appointments`.

## Reviewer Focus

Per `design.md` § Reviewer Focus:
1. **Sibling preservation** — all 4 params survive `router.push` via `URLSearchParams(searchParams.toString())` + `{scroll:false}`.
2. **INV-08 no-leak** — only `VehicleDTOJson` primitives cross; no `marca`/`patente`/`cliente_id`/`fecha*` in rendered HTML or test fixtures.
3. **INV-06 BA TZ** — `${date}T${slot}:00-03:00` passes `route.ts:27` regex; server UTC; `Intl` assert + `TODO(DST)` documented.
4. **Error envelope** — `lib/api/appointments.ts` mirrors `vehicles.ts:42-49` + `lib/http/errors.ts:10-42`; 409→refresh, 403→delete `vehicleId`, 422→delete `serviceId`+push `/services`, 401→assign.
5. **Idempotency** — `isPending` + `disabled`+`aria-busy`; server `REPEATABLE READ` + `EXCLUDE gist` belt-and-suspenders.
6. **Chain discipline** — PR1 has NO submit wiring; Confirm stays disabled or absent; PR2 wires submit.