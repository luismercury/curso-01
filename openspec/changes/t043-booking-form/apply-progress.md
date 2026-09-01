# Apply Progress: t043-booking-form — PR1 + PR2 (merged report)

> Hybrid artifact mirror — Engram topic `sdd/t043-booking-form/apply-progress`
> carries the same content. This file is the filesystem mirror under
> `openspec/changes/t043-booking-form/` per the T-041 / T-042 precedent.
>
> This report covers BOTH PRs of the `feature-branch-chain`:
> - **PR1** (commits `506b4b8` + `0088bd8` + `3366615`): `VehicleSelector`
>   compound + page wire + 0-vehicle CTA + tests.
> - **PR2** (commits `<feat>` + `<docs>`): `BookingForm` compound +
>   `lib/api/appointments` helper + Summary + 409/403/422/401 envelope
>   + e2e + idempotency + tests.
>
> PR1 section follows below (historical); PR2 section is appended at the
> bottom (this report's primary focus).

PR1 of 2 on tracker `feature/t043-booking-form-pr1` (chain strategy:
feature-branch-chain, locked at tasks phase). PR1 base = `master`.
PR2 base = PR1 tip.

## Cycle Status

| Phase | Status | Evidence |
|-------|--------|----------|
| Explore | DONE | `openspec/changes/t043-booking-form/exploration.md` (161L) |
| Propose | DONE | `openspec/changes/t043-booking-form/proposal.md` (118L) |
| Spec | DONE | `openspec/changes/t043-booking-form/spec.md` (123L) — 4 ADDED reqs, 13 GWT scenarios |
| Design | DONE | `openspec/changes/t043-booking-form/design.md` (117L) — 10 architecture decisions, 3 open Q resolved |
| Tasks | DONE | `openspec/changes/t043-booking-form/tasks.md` (113L) — 22 tasks across 3 phases |
| Apply PR1 | DONE | Branch `feature/t043-booking-form-pr1` from `master=eb4bad0`. 9/9 tasks complete. Commit `3366615`. |
| Apply PR2 | DONE | `feature/t043-booking-form-pr2` off PR1 tip — BookingForm + lib/api/appointments + Summary + 409/403/422/401 envelope + e2e. 10/10 tasks complete. See PR2 section below. |
| Verify | PENDING | After PR2 merged on tracker, then `sdd-verify` |
| Archive | PENDING | After verify PASS |

## PR1 Commit

| Field | Value |
|-------|-------|
| Branch (tracker) | `feature/t043-booking-form-pr1` |
| Base | `eb4bad0` (master) |
| Files changed (src/) | 8 |
| Insertions / Deletions (src/) | 1228 / 15 |
| Tests added | 30 (11 vehicleId + 14 VehicleSelector + 5 page.test PR1 block) |

## Files Changed (PR1 — production + test)

| File | Action | Role |
|------|--------|------|
| `src/lib/validators/vehicleId.ts` | CREATE | Pure Zod `vehicleIdSchema = z.string().uuid()` + `isOwner(vehicle, userId)` defense-in-depth ownership guard (INV-03). Client-safe. |
| `src/lib/validators/vehicleId.test.ts` | CREATE | 11 vitest unit tests. |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx` | CREATE | `"use client"` compound namespace `{Root, List, Card(atomic), SelectedBanner, ClearButton, Empty}` mirroring ServiceSelector / AvailabilitySlots. |
| `src/app/(customer)/appointments/new/_components/VehicleCard.tsx` | CREATE | Atomic `<button type="button" role="radio" aria-checked>`. |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` | CREATE | 14 jsdom + RTL + `userEvent.click` tests. |
| `src/app/(customer)/appointments/new/page.tsx` | MODIFY | Extends `Promise.all` with `listVehiclesByCustomer(db, userId)`; renders `<VehicleSelector>` + page-level 0-vehicle CTA branch. |
| `src/app/(customer)/appointments/new/page.test.tsx` | MODIFY | Mocks `listVehiclesByCustomer`. Existing tests + new T-043 PR1 describe block (5 tests). |
| `src/app/(customer)/appointments/new/appointments.module.css` | MODIFY | Adds vehicle tokens (radiogroup, card, selected, empty CTA). |

## Gate Evidence

### `pnpm vitest run` (PR1 target files only)

```
# vehicleId.test.ts                              11/11 PASS
# page.test.tsx (full file incl. T-041 + T-042)  25/25 PASS
# VehicleSelector.test.tsx (jsdom)               14/14 PASS
```

### `pnpm vitest run` (full suite, regression smoke)

```
Master baseline: 11 failed | 67 passed | 1 skipped (79 files); 50 failed | 1131 passed | 2 skipped (1183 tests)
PR1 delta:       +30 passing tests; 0 new failures
PR1 realized:    11 failed | 69 passed | 1 skipped (81 files); 50 failed | 1161 passed | 2 skipped (1213 tests)
```

Pre-existing baseline failures are DB integration tests (ECONNREFUSED —
Postgres not running locally). Zero regressions introduced by PR1.

### `pnpm typecheck`

```
$ tsc --noEmit
(exit 0, no diagnostics)
```

### `pnpm lint`

```
✖ 21 problems (2 errors, 19 warnings)
```

Identical to master baseline. Zero new errors / warnings introduced by PR1.

## PR1 Budget (forecast vs realized)

| Metric | Forecast | Realized |
|--------|----------|----------|
| PR1 prod+test LOC | ~290 | 1228 (src/ only) |
| PR1 prod LOC (excl. tests) | ~150 | ~676 net |
| PR1 prod code-only (excl. JSDoc/blanks) | n/a | ~390 |

**Budget overrun acknowledged.** Mirrors the T-042 precedent (1095
insertions, single atomic commit, "chain split not viable"). PR1 ships as
one atomic commit since the page already imports the compound.

## Invariant Compliance

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ | Two-layer ownership: RSC `listVehiclesByCustomer(db, userId)` + island `isOwner(vehicle, userId)` re-check. |
| **INV-06** `TIMESTAMPTZ` UTC; BA timezone | ✅ | No `startDateTime` in PR1 (submit is PR2). `// TODO(PR2): -03:00 reconstruction` parked in `VehicleSelector.SelectedBanner` JSDoc. |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase + ISO | ✅ | `VehicleDTOJson` only crosses; `toVehicleJson` mapper `Date → ISO`; tests assert no `marca`/`modelo`/`anio`/`patente`/`cliente_id`/`fecha*` leak. |
| **INV-01/02/04/05/07** | ✅ preserved | Not applicable to PR1 (no capacity, no state, no concurrency, no slot validation, no DAG cycle). |

## Compound Contract (PR1)

```
<VehicleSelector
  vehicles={vehicles}            // server-derived, owner-filtered
  userId={userId}                // session-derived, ownership re-check (INV-03)
  serviceId={selectedService.id} // sibling preserved
  date={selectedDate}            // sibling preserved
>
  <VehicleSelector.List />           // radiogroup of vehicle cards; null when empty
  <VehicleSelector.SelectedBanner />  // self-hiding; shows brand/model/year + plate
  <VehicleSelector.ClearButton />     // self-hiding; deletes ?vehicleId=
</VehicleSelector>
```

`VehicleSelector.Empty` is also exported as a defensive opt-in static. The
page renders its own CTA branch instead (the 0-vehicle case needs the
page-level guard).

## Chain Handoff to PR2

PR2 (`feature/t043-booking-form-pr2` from PR1 tip) ships:
1. `src/lib/api/appointments.ts` — `submitBooking` POST helper.
2. `src/lib/api/appointments.test.ts` — envelope tests.
3. `src/app/(customer)/appointments/new/_components/BookingForm.tsx` —
   Summary/Submit/ErrorBanner compound with `isPending` gate.
4. `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx`.
5. `src/app/(customer)/appointments/new/page.tsx` delta — compose
   `<BookingForm>` when all 4 selections resolve.
6. `tests/e2e/t043-booking-form.spec.ts` — Playwright artifact (excluded).

**Chain discipline preserved:** PR1 has no submit wiring. `<BookingForm>` is
NOT defined in PR1. `src/lib/api/appointments.ts` is NOT created in PR1.

## Next Steps

1. **Orchestrator**: `gentle-ai review status` → START → reviewers →
   correction (if any) → finalize. Then push PR1 branch
   `feature/t043-booking-form-pr1` for review.
2. **After PR1 merges**: branch `feature/t043-booking-form-pr2` from the
   PR1 merge commit.
3. **After PR2 merges**: PR3 `chore(docs)` commit for the still-untracked
   tracker docs.
4. **After PR3 merges**: `sdd-verify` for t043 (PASS expected — 4/4 reqs,
   13/13 GWT scenarios).
5. **After verify PASS**: `sdd-archive`.

---

*Generated: 2026-09-01 — sdd-apply PR1 for `t043-booking-form` — hybrid
artifact (Engram + filesystem). Branch `feature/t043-booking-form-pr1` from
`master=eb4bad0`.*

---

# Apply Progress: t043-booking-form — PR2 of 2 (BookingForm + Submit + Error Envelope)

> Hybrid artifact mirror — Engram topic `sdd/t043-booking-form/apply-progress`
> carries the same content. PR2 of 2 on tracker
> `feature/t043-booking-form-pr2` (chain strategy: feature-branch-chain,
> locked at tasks phase). PR2 base = PR1 tip `3366615`. Master tip
> `eb4bad0` unchanged.

## Cycle Status (post-PR2)

| Phase | Status | Evidence |
|-------|--------|----------|
| Explore | DONE | `openspec/changes/t043-booking-form/exploration.md` (161L) |
| Propose | DONE | `openspec/changes/t043-booking-form/proposal.md` (118L) |
| Spec | DONE | `openspec/changes/t043-booking-form/spec.md` (123L) — 4 ADDED reqs, 13 GWT scenarios |
| Design | DONE | `openspec/changes/t043-booking-form/design.md` (117L) — 10 architecture decisions, 3 open Q resolved |
| Tasks | DONE | `openspec/changes/t043-booking-form/tasks.md` (113L) — 22 tasks across 3 phases |
| Apply PR1 | DONE | Branch `feature/t043-booking-form-pr1` from `master=eb4bad0`. 9/9 tasks complete. Commit `3366615`. |
| Apply PR2 | DONE (this report) | Branch `feature/t043-booking-form-pr2` from PR1 tip `3366615`. 10/10 tasks complete. Tip `<pr2-hash>`. |
| Verify | PENDING | After PR2 merged on tracker, then `sdd-verify` |
| Archive | PENDING | After verify PASS |

## PR2 Commit

| Field | Value |
|-------|-------|
| Branch (tracker) | `feature/t043-booking-form-pr2` |
| Base | `3366615` (PR1 tip) |
| Files changed (src/) | 7 (5 new + 2 modified + 1 e2e) |
| Insertions (src/) | ~1050 (incl. ~700 test LOC) |
| Tests added | 43 (18 helper + 19 BookingForm jsdom + 5 page.test PR2 block + 1 BA-TZ regression guard) |
| Worktree clean after commit | yes (verified `git status`) |

## Files Changed (PR2 — production + test)

| File | Action | Role |
|------|--------|------|
| `src/lib/api/appointments.ts` | CREATE | `submitBooking({vehicleId, serviceId, startDateTime})` POSTs JSON to `/api/appointments` with `credentials:"include"` + `cache:"no-store"` + `Content-Type:"application/json"`; mirrors `lib/api/vehicles.ts:42-49` envelope mapping (uses `ApiErrorBody` from `lib/validators/service` for `isErrorBody` predicate — same as vehicles helper). Exports `TurnoDTOJson` (camelCase + ISO strings, mirror of `db/mappers/turno.ts:TurnoDTO`). `buildBookingStartDateTime(date, slot)` reconstructs `${date}T${slot}:00-03:00` (BA fixed since 2009, INV-06, with `TODO(DST)` escape hatch to `slotGenerator.baWallTimeToUtcDate`). `buildLoginNext(pathname, search)` URL-encodes `next=` so the 401 redirect round-trips through the auth handler. |
| `src/lib/api/appointments.test.ts` | CREATE | 18 vitest unit tests: 201 happy path (POST shape + parsed `TurnoDTOJson` + ISO date strings + INV-08 no-leak), 409/403/422/401/400 envelope mapping, no-ErrorBody fallbacks, NETWORK_ERROR, buildBookingStartDateTime happy paths + `Intl` offset-delta regression guard for Jan+Jul (DST safety), `buildLoginNext` `?`-injection + slot-colon encoding (`09:30` → `09%3A30`). |
| `src/app/(customer)/appointments/new/_components/BookingForm.tsx` | CREATE | `"use client"` compound namespace `{Root, Summary, Submit, ErrorBanner}` mirroring `VehicleSelector` / `AvailabilitySlots` — `createContext` + `use` + React 19 hooks. Submit handler uses `useState<boolean> isPending` + `try/finally` (design P2 — NOT `useTransition`). On 201 → `router.push("/appointments?confirmed=" + dto.id, {scroll:false})` (T-044 reads `?confirmed=`). On 409 → Spanish banner + `router.refresh()`. On 403 → banner + delete `?vehicleId=` + `router.refresh()`. On 422 → banner + delete `?serviceId=` + `router.push("/services", {scroll:false})`. On 401 → `window.location.assign(buildLoginNext(pathname, searchParams.toString()))`. 400/500/NETWORK_ERROR/unmapped → appropriate banner copy. Early-return guard `if (isPending) return` for idempotency belt-and-suspenders (server `REPEATABLE READ` + `EXCLUDE gist` is the correctness half). |
| `src/app/(customer)/appointments/new/_components/SummaryCard.tsx` | CREATE | Atomic 4-row read-only recap (Service / Vehicle / Date / Time) — delegated as `<BookingForm.Summary />` static. Pure read; no state. |
| `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` | CREATE | 19 jsdom + RTL + `userEvent.click` tests: compound statics exposed, Summary 4 rows with primitive props, Submit enabled+`aria-busy=false` default, ErrorBanner absent when no error, INV-08 no-leak, click → `submitBooking` called with TZ-corrected `startDateTime` (`2026-09-10T09:30:00-03:00` for `date=2026-09-10&slot=09:30`), 201 → `router.push("/appointments?confirmed=" + id, {scroll:false})`, 201 with siblings doesn't leak to success URL, 409 Spanish banner + `router.refresh()` (no navigation), 403 banner + delete `vehicleId` + refresh, 422 banner + delete `serviceId` + push `/services`, 401 → `window.location.assign("/login?next=" + encoded booking URL)`, 400 verbatim server message, NETWORK_ERROR → "Network error. Please try again.", unmapped 5xx → generic, **double-click during pending → only 1 `submitBooking` call** (idempotency via `disabled`+`aria-busy` + handler early-return), ErrorBanner auto-dismisses on next successful submit, ErrorBanner dismiss button clears error, Submit outside `<BookingForm>` throws loud. |
| `src/app/(customer)/appointments/new/appointments.module.css` | MODIFY | Adds `.bookingSection` / `.summary` / `.summaryList` / `.summaryRow` / `.summaryLabel` / `.summaryValue` / `.submit` / `.submitPending` (composed onto `.submit`, NOT a boolean prop — composition pattern) / `.submit:disabled` / `.errorBanner` / `.errorBannerDestructive` (composed for danger state) / `.errorBannerBody` / `.errorBannerDismiss`. No Tailwind; reuses `--color-*` / `--space-*` / `--radius-*`. |
| `src/app/(customer)/appointments/new/page.tsx` | MODIFY | JSDoc updated to reflect PR2 (8-step flow). Imports `slotSchema`, `vehicleIdSchema`, `isOwner`, `BookingForm`. Adds `selectedSlot` derivation (slotSchema + `availableSlots.includes(candidate)`, defense in depth) and `selectedVehicle` derivation (vehicleIdSchema + `isOwner(vehicle, userId)` re-check, INV-03). When ALL FOUR selections resolve, composes `<BookingForm>` with primitive props only: `serviceId` + `vehicleId` + `date` + `slot` (UUIDs + YMD + HH:mm) + `serviceName` + `vehicleLabel` (pre-formatted `brand model (year) — plate`). |
| `src/app/(customer)/appointments/new/page.test.tsx` | MODIFY | Adds T-043 PR2 describe block (5 tests): all-4-valid → `BookingForm` composed with primitive props; missing slot → not composed; tampered slot (`25:00`) → not composed; foreign `?vehicleId=` → not composed (`isOwner` fails); INV-08 no-leak continues (no `marca`/`patente`/`cliente_id`/`fecha*` in rendered tree). Existing T-043 PR1 block kept intact. |
| `tests/e2e/t043-booking-form.spec.ts` | CREATE | Playwright e2e artifact (excluded per T-042 precedent): deep-link `?serviceId=&date=&slot=&vehicleId=` → Confirm → URL becomes `/appointments?confirmed=<id>` (T-044 reads `?confirmed=`); idempotent Submit (`disabled`+`aria-busy`); INV-08 booking summary 4-row no-leak. Excluded from `vitest.config.ts -> tests/e2e/**` (already present) and `tsconfig.json -> exclude` (already present). |

## Gate Evidence

### `pnpm vitest run` (PR2 target files only)

```
# appointments.test.ts                  18/18 PASS
# BookingForm.test.tsx (jsdom)          19/19 PASS
# page.test.tsx (PR2 block, 5 tests)     5/5 PASS  (full file: 30/30 PASS)
```

### `pnpm vitest run` (full suite, regression smoke)

```
Master baseline:   11 failed | 67 passed | 1 skipped (79 files); 50 failed | 1131 passed | 2 skipped (1183 tests)
PR1 realized:      11 failed | 69 passed | 1 skipped (81 files); 50 failed | 1161 passed | 2 skipped (1213 tests)
PR2 realized:      11 failed | 71 passed | 1 skipped (83 files); 50 failed | 1204 passed | 2 skipped (1256 tests)

PR2 delta:         +2 test files (appointments.test + BookingForm.test)
                   +43 passing tests (18 + 19 + 5 + 1 BA-TZ regression)
                   0 new failures
```

**Pre-existing baseline failures are DB integration tests** (ECONNREFUSED —
Postgres not running locally). Identical to PR1 + master. Zero regressions
introduced by PR2.

### `pnpm typecheck`

```
$ tsc --noEmit
(exit 0, no diagnostics)
```

Clean. Single fix during development: tightened the `isErrorBody` predicate
in `src/lib/api/appointments.ts` to use `ApiErrorBody` from
`@/lib/validators/service` instead of a locally-inferred type — mirrors
`src/lib/api/vehicles.ts:42` exactly.

### `pnpm build`

```
Route /appointments/new stays dynamic (`ƒ`). No new prerender hits.
Full Next.js build passes; route table unchanged.
```

### `pnpm lint`

```
✖ 21 problems (2 errors, 19 warnings)
```

Identical to PR1 baseline (T-039-introduced `VehicleProvider.tsx:61` +
master-baseline `appointmentQuery.ts:55` prefer-const). Zero new errors or
warnings introduced by PR2.

Verified via:
```
pnpm lint 2>&1 | Select-String -Pattern "appointments.ts|BookingForm|SummaryCard|appointments/new/page|appointments.module"
# (no output)
```

## PR2 Budget (forecast vs realized)

| Metric | Forecast | Realized | Delta |
|--------|----------|----------|-------|
| PR2 prod+test LOC | ~280 | ~1050 (incl. ~700 test LOC) | +770 |
| PR2 prod LOC (excl. tests) | ~180 | ~480 net | +300 |
| PR2 prod code-only (excl. JSDoc/blanks) | n/a | ~250 | n/a |

**Budget overrun acknowledged.** Mirrors the T-042 + PR1 precedent
("chain split not viable"). PR2 ships as one atomic commit because the
page already imports `<BookingForm>` and splitting the submit pipeline
from the helper would leave an orphan component import.

PR2 production LOC breakdown:
- `src/lib/api/appointments.ts` 205 lines (~80 prod, rest JSDoc + types)
- `src/app/(customer)/appointments/new/_components/BookingForm.tsx` 360 lines (~150 prod, rest JSDoc)
- `src/app/(customer)/appointments/new/_components/SummaryCard.tsx` 73 lines (~25 prod, rest JSDoc)
- `src/app/(customer)/appointments/new/appointments.module.css` +133 (all CSS tokens)
- `src/app/(customer)/appointments/new/page.tsx` +88 (derive + compose)

If the orchestrator considers the budget overrun excessive, the
alternative split would be:
1. PR2a: `lib/api/appointments.ts` + `.test.ts` + `SummaryCard.tsx` (helper + static + tests).
2. PR2b: `BookingForm.tsx` + `.test.ts` + `page.tsx` delta + CSS (compound + wire).

But PR2a + PR2b would require a temporary commit that imports
`BookingForm` before defining it, breaking the page wire. **PR2 ships
with this realization; the orchestrator decides whether to accept the
budget overrun or invoke a `chained-pr` re-split.**

## Invariant Compliance

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ | Page filters vehicles by `session.user.id` at the RSC layer; island re-runs `isOwner(vehicle, userId)` in `BookingForm` derive; server route re-asserts ownership via `requireAuth` + `vehicleIdSchema`. 403 path drops `?vehicleId=` and refreshes. |
| **INV-04** Atomic `REPEATABLE READ` + `EXCLUDE gist` (capacity check) | ✅ | Server `appointmentService.createAppointment` (untouched) enforces. Client-side idempotency is `useState isPending` + early-return + `disabled`+`aria-busy` (double-click test verifies only 1 call). |
| **INV-05** Slots filtered by `durationMinutes`; `slotSchema` + `dateSchema` validated upstream | ✅ | Page uses `slotSchema.safeParse` + `availableSlots.includes` for `selectedSlot`. `dateSchema` was already validating `?date=` upstream. Submit only fires from valid 4-selection state. |
| **INV-06** `TIMESTAMPTZ` UTC; BA timezone; never `toISOString` for wall-clock | ✅ | `buildBookingStartDateTime(date, slot)` produces `${date}T${slot}:00-03:00` (BA fixed since Law 26.474, 2009). `Intl`-based offset-delta regression guard in `appointments.test.ts` asserts BA is UTC-3 for both Jan and Jul noon-UTC anchors. `TODO(DST)` escape hatch documented at the helper. |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase English + ISO | ✅ | `submitBooking` parses `TurnoDTOJson` (camelCase + ISO); `BookingForm` accepts only primitive props (4 strings + 2 labels). Tests assert no `cliente_id` / `vehiculo_id` / `servicio_id` / `fecha_hora_*` / `estado` / `created_at` / `updated_at` / `marca` / `modelo` / `anio` / `patente` leak. |
| **INV-01/02/07** | ✅ preserved | Not applicable to PR2 (no capacity config, no state transitions, no DAG cycle touched). |

## Compound Contract (PR2)

```
<BookingForm
  serviceId={selectedService.id}        // UUID, server-derived
  vehicleId={selectedVehicle.id}        // UUID, ownership-verified
  date={selectedDate}                   // YYYY-MM-DD, validated by dateSchema
  slot={selectedSlot}                   // HH:mm, validated by slotSchema + includes
  serviceName={selectedService.name}    // display label
  vehicleLabel={`${brand} ${model} (${year}) — ${plate}`}  // display label
>
  <BookingForm.Summary />     // 4-row recap
  <BookingForm.ErrorBanner /> // role="alert", self-hiding when no error
  <BookingForm.Submit />      // disabled + aria-busy while isPending
</BookingForm>
```

No boolean props. No Server Actions. No `localStorage`. No `useEffect`
data fetch. URL is canonical for all 4 selections; submit is the only
imperative interaction.

### State persistence

The 4 selections stay URL-canonical (`?serviceId=&date=&slot=&vehicleId=`).
The submit handler navigates to `/appointments?confirmed=<id>` on success
(T-044 reads the query) and imperatively redirects to `/login?next=...`
on 401. Refresh / deep-link / share work because the URL drives the state
end-to-end.

### Sibling preservation

On 403: `params.delete("vehicleId")` keeps `serviceId` / `date` / `slot`.
On 422: `params.delete("serviceId")` keeps `date` / `slot` / `vehicleId`.
On 401: `buildLoginNext(pathname, searchParams.toString())` preserves the
full booking URL (including siblings) so the user lands back here after
signing in.

## Chain Discipline Preserved

PR1 has no submit wiring. `<BookingForm>` is NOT defined on PR1 tip
(`3366615`). `src/lib/api/appointments.ts` is NOT created on PR1 tip.
No `POST /api/appointments` call is wired on PR1 tip. ✅

## Risks & Caveats

1. **PR2 budget overrun (~1050 src/ insertions vs ~280 forecast)** —
   acknowledged. The chain split was locked at the tasks phase (PR2 =
   BookingForm + helper + Summary + errors + pending + tests + e2e).
   PR2 ships as one atomic commit per T-042 + PR1 precedent.
2. **`buildBookingStartDateTime` hardcodes `-03:00`** — BA has been at
   UTC-3 since 2009 (Law 26.474). The `TODO(DST)` escape hatch is
   documented. If BA ever reinstates DST, replace with
   `slotGenerator.baWallTimeToUtcDate(...)`.
3. **Pre-existing baseline failures** — 11 vitest failures + 2 lint
   errors identical to `master@eb4bad0` and PR1 tip `3366615`. Zero
   regressions introduced by PR2.
4. **Playwright runner not provisioned** — `tests/e2e/t043-booking-form.spec.ts`
   ships as a design artifact, excluded from vitest + tsc per T-042
   precedent. Provision Playwright + drop the `tests/e2e/**` exclusion
   to enable the e2e gate.

## Next Recommended Steps

1. **Orchestrator**: `gentle-ai review status` → START → reviewers →
   correction (if any) → finalize. Then push PR2 branch
   `feature/t043-booking-form-pr2` for review.
2. **After PR2 merges**: run PR3 `chore(docs)` commit for the
   still-untracked artifacts (apply-progress mirrors were updated in
   this commit).
3. **After PR3 merges**: run `sdd-verify` for t043. Expected verdict:
   PASS, 4/4 requirements / 13/13 GWT scenarios.
4. **After verify PASS**: `sdd-archive` — move change to
   `openspec/changes/archive/2026-XX-XX-t043-booking-form/`. Then merge
   tracker to master with `--no-ff` per T-042 archive pattern.

## Files Referenced

- `openspec/changes/t043-booking-form/{exploration,proposal,design,tasks,spec}.md`
- `openspec/specs/booking-form/spec.md` (canonical)
- `sdd/t043-booking-form/apply-progress.md` (this file — hybrid mirror)
- `src/lib/api/appointments.ts` + `.test.ts` (PR2 — created)
- `src/app/(customer)/appointments/new/_components/BookingForm.tsx` +
  `BookingForm.test.tsx` + `SummaryCard.tsx` (PR2 — created)
- `src/app/(customer)/appointments/new/page.tsx` + `page.test.tsx` +
  `appointments.module.css` (PR2 — modified)
- `tests/e2e/t043-booking-form.spec.ts` (PR2 — created, excluded)

---

*Generated: 2026-09-01 — sdd-apply PR2 for `t043-booking-form` — hybrid
artifact (Engram + filesystem). Branch `feature/t043-booking-form-pr2`
from `feature/t043-booking-form-pr1@3366615`.*
