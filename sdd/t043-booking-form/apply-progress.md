# Apply Progress: t043-booking-form — PR1 + PR2 (merged report)

> Hybrid artifact (Engram + filesystem). Both PRs of the
> `feature-branch-chain` strategy:
> - **PR1** (commits `506b4b8` + `0088bd8` + `3366615`): `VehicleSelector`
>   compound + page wire + 0-vehicle CTA + tests.
> - **PR2** (commits `<feat>` + `<docs>`): `BookingForm` compound +
>   `lib/api/appointments` helper + Summary + 409/403/422/401 envelope
>   + e2e + idempotency + tests.
>
> PR1 section follows below (historical); PR2 section is appended at the
> bottom (this report's primary focus).

## Cycle Status

| Phase | Status | Evidence |
|-------|--------|----------|
| Explore | DONE | `openspec/changes/t043-booking-form/exploration.md` (161L) |
| Propose | DONE | `openspec/changes/t043-booking-form/proposal.md` (118L) |
| Spec | DONE | `openspec/changes/t043-booking-form/spec.md` (123L) — 4 ADDED reqs, 13 GWT scenarios |
| Design | DONE | `openspec/changes/t043-booking-form/design.md` (117L) — 10 architecture decisions, 3 open Q resolved |
| Tasks | DONE | `openspec/changes/t043-booking-form/tasks.md` (113L) — 22 tasks across 3 phases |
| Apply PR1 | DONE (this report) | Branch `feature/t043-booking-form-pr1` from `master=eb4bad0`. 9/9 tasks complete. |
| Apply PR2 | PENDING | `feature/t043-booking-form-pr2` off PR1 tip — BookingForm + lib/api/appointments + Summary + 409/403/422/401 envelope + e2e |
| Verify | PENDING | After PR2 merged on tracker, then `sdd-verify` |
| Archive | PENDING | After verify PASS |

## PR1 Commit

| Field | Value |
|-------|-------|
| Branch (tracker) | `feature/t043-booking-form-pr1` |
| Base | `eb4bad0` (master) |
| Files changed | 8 src + tracker docs |
| Insertions / Deletions | 1228 prod+test insertions / 15 deletions in `src/` (excludes tracker docs) |
| Tests added | 30 (11 vehicleId + 14 VehicleSelector + 5 page.test PR1 describe block) |

## Files Changed (PR1 — production + test)

| File | Action | Role |
|------|--------|------|
| `src/lib/validators/vehicleId.ts` | CREATE | Pure Zod `vehicleIdSchema = z.string().uuid()` + `isOwner(vehicle, userId)` defense-in-depth ownership guard (INV-03). Client-safe, no `server-only`. |
| `src/lib/validators/vehicleId.test.ts` | CREATE | 11 vitest unit tests: uuid accept/reject (canonical, garbage, empty, no-dashes), `safeParse` never throws on weird inputs, `isOwner` true/false (own/foreign/empty customerId/empty userId). |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx` | CREATE | `"use client"` compound namespace `{Root, List, Card(atomic), SelectedBanner, ClearButton, Empty}` mirroring ServiceSelector / AvailabilitySlots — `createContext` + `use` + `useSearchParams` + `useRouter` + `usePathname` + `URLSearchParams(searchParams.toString())` for sibling preservation. `select(id)` writes `?vehicleId=uuidV` with `vehicleIdSchema.safeParse` + `vehicles.some(v=>v.id===candidate && v.customerId===userId)` re-check. `clear()` deletes `?vehicleId=` while preserving siblings. |
| `src/app/(customer)/appointments/new/_components/VehicleCard.tsx` | CREATE | Atomic `<button type="button" role="radio" aria-checked>` showing `brand model (year)` primary + `plate` secondary; class composes `.vehicleCard` + `.vehicleSelected` when active. |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` | CREATE | 14 jsdom + RTL + `userEvent.click` tests: statics exposed, List renders one radio per vehicle, click → `router.push(?vehicleId=, {scroll:false})`, URL → aria-checked + banner, tampered/foreign UUID → no aria-checked + no banner + no 500, ClearButton deletes `?vehicleId=` preserving siblings, Empty renders CTA to `/vehicles`, Empty static suppression when List populates, INV-08 no-leak. |
| `src/app/(customer)/appointments/new/page.tsx` | MODIFY | Extends `Promise.all` with `listVehiclesByCustomer(db, userId)` (server-direct, design D1 — no `/api/customers/{id}/vehicles` hop). Maps `VehiculoDTO[]` → `VehicleDTOJson[]` via inline `toVehicleJson` mapper (camelCase English + ISO strings, INV-08). Renders `<VehicleSelector>` compound with `vehicles` + `userId` + sibling `serviceId` + `date`. When `vehicles.length === 0` renders ONLY the page-level CTA `<Link href="/vehicles">` branch — no DateSelector/AvailabilitySlots/VehicleSelector (design E1 — mirrors T-040 CTA pattern). |
| `src/app/(customer)/appointments/new/page.test.tsx` | MODIFY | Mocks `listVehiclesByCustomer`. Existing tests updated to set `mockListVehicles.mockResolvedValueOnce(...)` so the `Promise.all` extension does not break the existing assertions. New T-043 PR1 describe block (5 tests): authenticated + vehicles → VehicleSelector renders primitive props; zero vehicles → CTA `/vehicles`; zero vehicles → no availability fetch (CTA branch returns before bulk call); auth null → redirect short-circuits BEFORE vehicles fetch (INV-03); INV-08 no-leak (no `marca`/`modelo`/`anio`/`patente`/`cliente_id` in rendered tree; English camelCase keys present). |
| `src/app/(customer)/appointments/new/appointments.module.css` | MODIFY | Adds vehicle tokens: `.vehicleSection` / `.vehicleHeading` / `.vehicleList` (radiogroup grid) / `.vehicleCard` (radio button) / `.vehicleSelected` (composes vehicleCard, swapped selector — composition pattern, no boolean prop) / `.vehicleCardPrimary` / `.vehicleCardSecondary` / `.vehicleEmpty` / `.vehicleEmptyTitle` / `.vehicleEmptyBody` / `.vehicleEmptyCta`. No Tailwind; reuses `--color-*` / `--space-*` / `--radius-*` from globals. |

## Tracker Docs (mirror under both roots per T-040/T-041/T-042 pattern)

| File | Action | Role |
|------|--------|------|
| `openspec/changes/t043-booking-form/proposal.md` | CREATE | T-043 proposal (118L). |
| `openspec/changes/t043-booking-form/spec.md` | CREATE | T-043 spec (123L) — 4 ADDED reqs, 13 scenarios. Canonical mirror = `openspec/specs/booking-form/spec.md`. |
| `openspec/changes/t043-booking-form/design.md` | CREATE | T-043 design (117L) — 10 architecture decisions + 3 resolved open Q. |
| `openspec/changes/t043-booking-form/tasks.md` | CREATE | T-043 tasks (113L) — 22 tasks across 3 phases; PR1 = tasks 1.1-1.9. |
| `openspec/changes/t043-booking-form/exploration.md` | CREATE | T-043 exploration context (161L). |
| `openspec/changes/t043-booking-form/apply-progress.md` | CREATE | THIS FILE (hybrid mirror). |
| `openspec/specs/booking-form/spec.md` | CREATE | Canonical spec — byte-identical with the change's spec.md. |
| `sdd/t043-booking-form/apply-progress.md` | CREATE | THIS FILE (mirror under `sdd/` per T-041 pattern). |

**Tracker doc commit strategy:** The `openspec/.../*` files are committed in
PR3 as a separate `chore(docs)` commit per the T-041 / T-042 precedent. PR1's
production commit only ships the `src/` changes. This report is committed in
PR3 alongside the tracker docs.

## Test Counts

| File | Project | Tests | Status |
|------|---------|-------|--------|
| `src/lib/validators/vehicleId.test.ts` | node | 11 | 11/11 PASS |
| `src/app/(customer)/appointments/new/page.test.tsx` (T-043 PR1 block) | node | 5 | 5/5 PASS (page-wide: 25/25 PASS) |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` | jsdom | 14 | 14/14 PASS |

**PR1 net tests added: 30** (11 + 5 + 14).

## Gate Evidence

### `pnpm vitest run` (PR1 target files only)

```
# vehicleId.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)

# page.test.tsx (full file incl. existing T-041 + T-042 blocks)
Test Files  1 passed (1)
Tests       25 passed (25)

# VehicleSelector.test.tsx (jsdom)
Test Files  1 passed (1)
Tests       14 passed (14)
```

### `pnpm vitest run` (full suite, regression smoke)

```
Master baseline: 11 failed | 67 passed | 1 skipped (79 files); 50 failed | 1131 passed | 2 skipped (1183 tests)
PR1 delta:       +30 passing tests; 0 new failures
PR1 realized:    11 failed | 69 passed | 1 skipped (81 files); 50 failed | 1161 passed | 2 skipped (1213 tests)
```

**The 11 failed files / 50 failed tests are pre-existing master baseline
failures** (DB integration tests fail with ECONNREFUSED because Postgres is
not running locally — same set documented in T-041 / T-042 apply-progress
archives). Zero regressions introduced by PR1.

### `pnpm typecheck`

```
$ tsc --noEmit
(exit 0, no diagnostics)
```

Clean. The `session.user.id` narrowing follows the precedent set by
`vehicles/page.tsx:64-70` (`(session?.user as { id?: string } | undefined)?.id`
+ `if (!sessionUserId) redirect('/login')` + `const userId: string = sessionUserId`).

### `pnpm lint`

```
✖ 21 problems (2 errors, 19 warnings)
```

Identical to master baseline (T-039-introduced `VehicleProvider.tsx:61`
react-hooks/set-state-in-effect + master-baseline `appointmentQuery.ts:55`
prefer-const). Zero new errors or warnings introduced by PR1.

Verified via:
```
pnpm lint 2>&1 | Select-String -Pattern "VehicleSelector|VehicleCard|vehicleId|appointments/new/page|appointments/new/appointments.module"
# (no output)
```

## PR1 Budget (forecast vs realized)

| Metric | Forecast | Realized | Delta |
|--------|----------|----------|-------|
| PR1 prod+test LOC | ~290 | 1228 (src/ only) | +938 |
| PR1 prod LOC (excl. tests) | ~150 | ~676 net | +526 |
| PR1 prod code-only (excl. JSDoc/blanks) | n/a | ~390 (compounds + CSS) | n/a |

**Budget overrun acknowledged.** The chain split was already locked at the
tasks phase (PR1 = VehicleSelector + wiring + 0-vehicle CTA + tests; PR2 =
BookingForm + `lib/api/appointments` + Summary + error envelope). The PR1
files mirror the existing `AvailabilitySlots.tsx` (315 LOC) / `DateSelector.tsx`
(390 LOC) precedents verbatim — the JSDoc-heavy compound shape is the
established convention. Following the T-042 precedent
(`feat(appointments): T-042 availability display (RSC + grid compound)` —
1095 insertions, single atomic commit, "Budget exceeded: chain split not
viable"), PR1 ships as one atomic commit since the page already imports the
compound (splitting would break the page wire).

The orchestrator should review this realization. If the chain split is
considered the wrong granularity, the alternative is to:
1. Pull `VehicleSelector.tsx` + `VehicleCard.tsx` + `vehicleId.ts` into PR1
   (compound + validator only — ~450 LOC prod).
2. Pull `page.tsx` + `appointments.module.css` + `page.test.tsx` delta into
   PR1a.
3. Defer `VehicleSelector.test.tsx` + `vehicleId.test.ts` to PR1b alongside
   `lib/api/appointments.ts`.

But that would require the orchestrator to re-architect, since the current
chain decision was already locked at the tasks phase. **PR1 ships with this
realization; the orchestrator decides whether to accept the budget overrun
or invoke a `chained-pr` re-split.**

## Invariant Compliance

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ | `page.tsx` defensive `auth()` → `redirect('/login')` unchanged; `VehicleSelector` re-runs ownership check via `isOwner(vehicle, userId)` after the RSC's `listVehiclesByCustomer(db, session.user.id)` filter. Both layers prevent tampered/foreign `?vehicleId=` from highlighting the wrong card. |
| **INV-06** `TIMESTAMPTZ` UTC; BA timezone via `Intl`; never `toISOString` for wall-clock | ✅ | No `startDateTime` is built in PR1 (submit is PR2's job). A `// TODO(PR2): -03:00 reconstruction` comment is parked in `VehicleSelector.SelectedBanner` JSDoc for the PR2 implementer. |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase English + ISO | ✅ | `VehicleSelector.tsx` accepts only `VehicleDTOJson` (camelCase + ISO strings). Page's `toVehicleJson` mapper does `Date → ISO` for `createdAt`/`updatedAt`. `VehicleSelector.test.tsx` and `page.test.tsx` both assert forbidden strings (`marca`, `modelo`, `anio`, `patente`, `cliente_id`, `fecha`, `fechaHora*`) absent from the rendered tree. |
| **INV-01/02/04/05/07** | ✅ preserved | Not applicable to T-043 PR1 (no capacity, no state transitions, no concurrency, no slot validation, no DAG cycle touched). |

## Compound Contract (PR1)

```
<VehicleSelector
  vehicles={vehicles}            // server-derived, owner-filtered
  userId={userId}                // session-derived, for ownership re-check (INV-03)
  serviceId={selectedService.id} // sibling preserved across vehicle changes
  date={selectedDate}            // sibling preserved across vehicle changes
>
  <VehicleSelector.List />           // radiogroup of vehicle cards; null when empty
  <VehicleSelector.SelectedBanner />  // self-hiding; shows brand/model/year + plate
  <VehicleSelector.ClearButton />     // self-hiding; deletes ?vehicleId=
</VehicleSelector>
```

`VehicleSelector.Empty` is also exported as a separate static for defensive
opt-in (mirrors `AvailabilitySlots.Empty`) — but the page renders its own
CTA branch instead because the 0-vehicle case needs the page-level guard
(no DateSelector/AvailabilitySlots can render with 0 vehicles anyway).

No boolean props. No Server Actions. No `localStorage`. No `useEffect` data
fetch. URL is canonical.

### State persistence

URL is the source of truth (`?vehicleId=uuidV`):
- Refresh / deep-link / share work because the URL drives the state.
- The island re-validates with `vehicleIdSchema.safeParse` + ownership guard
  so post-hydration state never disagrees with SSR.

### Sibling preservation

```ts
const params = new URLSearchParams(searchParams.toString());
params.delete("vehicleId");
router.push(`${pathname}?${params}`, { scroll: false });
```

`?serviceId=` and `?date=` survive every vehicle change. Verified by
`VehicleSelector.test.tsx` "ClearButton deletes ?vehicleId= while preserving
siblings" (GWT Clear).

## Chain Handoff to PR2

PR2 (`feature/t043-booking-form-pr2` from PR1 tip) ships:
1. `src/lib/api/appointments.ts` — `submitBooking` POST helper mirroring
   `vehicles.ts:42-49`.
2. `src/lib/api/appointments.test.ts` — 201/409/403/422/401 envelope tests.
3. `src/app/(customer)/appointments/new/_components/BookingForm.tsx` —
   Summary/Submit/ErrorBanner compound with `isPending` gate.
4. `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx`
   — jsdom + RTL + `userEvent.click` tests.
5. `src/app/(customer)/appointments/new/page.tsx` delta — compose
   `<BookingForm>` when all 4 selections resolve.
6. `tests/e2e/t043-booking-form.spec.ts` — Playwright artifact
   (excluded per T-042 precedent).

**Chain discipline preserved:** PR1 has no submit wiring. `<BookingForm>` is
NOT defined in PR1. `src/lib/api/appointments.ts` is NOT created in PR1. No
`POST /api/appointments` call is wired in PR1.

## Risks & Caveats

1. **PR1 budget overrun (1228 insertions vs ~290 forecast)** — acknowledged.
   The chain split was already locked. PR1 ships as one atomic commit per
   T-042 precedent. Orchestrator decides whether to accept or re-architect.
2. **Tracker docs remain untracked in PR1** — `openspec/changes/t043-booking-form/*`
   + `sdd/t043-booking-form/apply-progress.md` will be committed in PR3
   alongside `chore(docs)` per T-041 / T-042 precedent.
3. **`session.user.id` narrowing** — `(session?.user as { id?: string } | undefined)?.id`
   follows the `vehicles/page.tsx:64-70` precedent. The redirect guard
   ensures the subsequent `const userId: string = sessionUserId` assertion
   is safe at runtime; TS just needs the explicit annotation to narrow.
4. **Pre-existing baseline failures** — 11 vitest failures + 2 lint errors
   identical to `master@eb4bad0`. Zero regressions.

## Next Recommended Steps

1. **Orchestrator**: `gentle-ai review status` → START → reviewers →
   correction (if any) → finalize. Then push PR1 branch
   `feature/t043-booking-form-pr1` for review.
2. **Orchestrator**: After PR1 merges to master, branch
   `feature/t043-booking-form-pr2` from the PR1 merge commit. PR2 ships the
   `<BookingForm>` compound + `lib/api/appointments.ts` + error envelope +
   idempotent submit + e2e artifact.
3. **After PR2 merges**: run PR3 `chore(docs)` commit for the still-untracked
   tracker docs (`openspec/changes/t043-booking-form/*` and this report).
4. **After PR3 merges**: run `sdd-verify` for t043. Expected verdict: PASS,
   4/4 requirements / 13/13 GWT scenarios.
5. **After verify PASS**: `sdd-archive` — move change to
   `openspec/changes/archive/2026-XX-XX-t043-booking-form/`. Then merge
   tracker to master with `--no-ff` per T-042 archive pattern.

## Files Referenced

- `openspec/changes/t043-booking-form/{exploration,proposal,design,tasks,spec}.md`
- `openspec/specs/booking-form/spec.md` (canonical)
- `sdd/t043-booking-form/apply-progress.md` (this file)
- `src/lib/validators/vehicleId.ts` + `.test.ts` (PR1 — created)
- `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx`
  + `VehicleSelector.test.tsx` + `VehicleCard.tsx` (PR1 — created)
- `src/app/(customer)/appointments/new/page.tsx` + `page.test.tsx`
  + `appointments.module.css` (PR1 — modified)

---

*Generated: 2026-09-01 — sdd-apply PR1 for `t043-booking-form` — hybrid
artifact (Engram + filesystem). Branch `feature/t043-booking-form-pr1` from
`master=eb4bad0`.*

---

# Apply Progress: t043-booking-form — PR2 of 2 (BookingForm + Submit + Error Envelope)

> Hybrid artifact (Engram + filesystem). PR2 of 2 on tracker
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
| `src/lib/api/appointments.ts` | CREATE | `submitBooking({vehicleId, serviceId, startDateTime})` POSTs JSON to `/api/appointments` with `credentials:"include"` + `cache:"no-store"` + `Content-Type:"application/json"`; mirrors `lib/api/vehicles.ts:42-49` envelope mapping. Exports `TurnoDTOJson` (camelCase + ISO strings, mirror of `db/mappers/turno.ts:TurnoDTO`). `buildBookingStartDateTime(date, slot)` reconstructs `${date}T${slot}:00-03:00` (BA fixed since 2009, INV-06, with `TODO(DST)` escape hatch). `buildLoginNext(pathname, search)` URL-encodes `next=` so the 401 redirect round-trips through the auth handler. |
| `src/lib/api/appointments.test.ts` | CREATE | 18 vitest unit tests: 201 happy path + INV-08 no-leak, 409/403/422/401/400 envelope mapping, no-ErrorBody fallbacks, NETWORK_ERROR, buildBookingStartDateTime happy paths + `Intl` offset-delta regression guard (DST safety), buildLoginNext `?`-injection + slot-colon encoding. |
| `src/app/(customer)/appointments/new/_components/BookingForm.tsx` | CREATE | `"use client"` compound namespace `{Root, Summary, Submit, ErrorBanner}` mirroring `VehicleSelector` / `AvailabilitySlots`. Submit handler uses `useState<boolean> isPending` + `try/finally` (design P2 — NOT `useTransition`). On 201 → `router.push("/appointments?confirmed=" + dto.id, {scroll:false})` (T-044 reads `?confirmed=`). On 409 → Spanish banner + `router.refresh()`. On 403 → banner + delete `?vehicleId=` + `router.refresh()`. On 422 → banner + delete `?serviceId=` + `router.push("/services", {scroll:false})`. On 401 → `window.location.assign(buildLoginNext(...))`. Belt-and-suspenders idempotency via `disabled`+`aria-busy` + handler early-return. |
| `src/app/(customer)/appointments/new/_components/SummaryCard.tsx` | CREATE | Atomic 4-row read-only recap (Service / Vehicle / Date / Time) — delegated as `<BookingForm.Summary />` static. |
| `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` | CREATE | 19 jsdom + RTL + `userEvent.click` tests: compound statics, Summary 4 rows, Submit enabled+aria-busy=false default, ErrorBanner absent when no error, INV-08 no-leak, click → `submitBooking` called with TZ-corrected `startDateTime`, 201 → `router.push("/appointments?confirmed=" + id, {scroll:false})`, 409 banner + `router.refresh()`, 403 banner + delete `vehicleId` + refresh, 422 banner + delete `serviceId` + push `/services`, 401 → `window.location.assign("/login?next=...")`, 400 verbatim, NETWORK_ERROR → "Network error", unmapped 5xx → generic, **double-click → only 1 `submitBooking` call** (idempotency), auto-dismiss on success, dismiss button, throws outside provider. |
| `src/app/(customer)/appointments/new/appointments.module.css` | MODIFY | Adds `.bookingSection` / `.summary` / `.summaryList` / `.summaryRow` / `.summaryLabel` / `.summaryValue` / `.submit` / `.submitPending` (composed — NO boolean prop) / `.errorBanner` / `.errorBannerDestructive` / `.errorBannerBody` / `.errorBannerDismiss`. No Tailwind; reuses `--color-*` / `--space-*` / `--radius-*`. |
| `src/app/(customer)/appointments/new/page.tsx` | MODIFY | JSDoc updated. Imports `slotSchema`, `vehicleIdSchema`, `isOwner`, `BookingForm`. Adds `selectedSlot` derivation (slotSchema + `availableSlots.includes`, defense in depth) and `selectedVehicle` derivation (vehicleIdSchema + `isOwner(vehicle, userId)` re-check, INV-03). When ALL FOUR selections resolve, composes `<BookingForm>` with primitive props only. |
| `src/app/(customer)/appointments/new/page.test.tsx` | MODIFY | Adds T-043 PR2 describe block (5 tests): all-4-valid → `BookingForm` composed with primitive props; missing slot → not composed; tampered slot (`25:00`) → not composed; foreign `?vehicleId=` → not composed; INV-08 no-leak continues. |
| `tests/e2e/t043-booking-form.spec.ts` | CREATE | Playwright e2e artifact (excluded per T-042 precedent): deep-link → Confirm → `/appointments?confirmed=<id>`; idempotent Submit (`disabled`+`aria-busy`); INV-08 booking summary 4-row no-leak. |

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

## PR2 Budget (forecast vs realized)

| Metric | Forecast | Realized | Delta |
|--------|----------|----------|-------|
| PR2 prod+test LOC | ~280 | ~1050 (incl. ~700 test LOC) | +770 |
| PR2 prod LOC (excl. tests) | ~180 | ~480 net | +300 |
| PR2 prod code-only (excl. JSDoc/blanks) | n/a | ~250 | n/a |

**Budget overrun acknowledged.** Mirrors T-042 + PR1 precedent. PR2 ships
as one atomic commit because the page already imports `<BookingForm>` and
splitting the submit pipeline from the helper would leave an orphan
component import.

## Invariant Compliance

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ | Page filters vehicles by `session.user.id` (RSC); island re-runs `isOwner(vehicle, userId)`; server route re-asserts via `requireAuth` + `vehicleIdSchema`. 403 path drops `?vehicleId=` and refreshes. |
| **INV-04** Atomic `REPEATABLE READ` + `EXCLUDE gist` (capacity) | ✅ | Server `appointmentService.createAppointment` (untouched) enforces. Client-side idempotency: `useState isPending` + early-return + `disabled`+`aria-busy` (double-click test verifies only 1 call). |
| **INV-05** Slots filtered by `durationMinutes`; schemas validated upstream | ✅ | Page uses `slotSchema.safeParse` + `availableSlots.includes` for `selectedSlot`. Submit only fires from valid 4-selection state. |
| **INV-06** `TIMESTAMPTZ` UTC; BA timezone; never `toISOString` for wall-clock | ✅ | `buildBookingStartDateTime(date, slot)` produces `${date}T${slot}:00-03:00`. `Intl`-based offset-delta regression guard in tests asserts BA is UTC-3 for Jan+Jul noon-UTC anchors. `TODO(DST)` escape hatch documented. |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase + ISO | ✅ | `submitBooking` parses `TurnoDTOJson` (camelCase + ISO); `BookingForm` accepts only primitive props. Tests assert no `cliente_id` / `vehiculo_id` / `servicio_id` / `fecha_hora_*` / `estado` / `created_at` / `updated_at` / `marca` / `modelo` / `anio` / `patente` leak. |
| **INV-01/02/07** | ✅ preserved | Not applicable to PR2 (no capacity, no state transitions, no DAG cycle). |

## Chain Discipline Preserved

PR1 has no submit wiring. `<BookingForm>` is NOT defined on PR1 tip
(`3366615`). `src/lib/api/appointments.ts` is NOT created on PR1 tip.
No `POST /api/appointments` call is wired on PR1 tip. ✅

## Risks & Caveats

1. **PR2 budget overrun (~1050 src/ insertions vs ~280 forecast)** —
   acknowledged. The chain split was locked at the tasks phase. PR2
   ships as one atomic commit per T-042 + PR1 precedent.
2. **`buildBookingStartDateTime` hardcodes `-03:00`** — BA has been at
   UTC-3 since 2009 (Law 26.474). The `TODO(DST)` escape hatch is
   documented. If BA ever reinstates DST, replace with
   `slotGenerator.baWallTimeToUtcDate(...)`.
3. **Pre-existing baseline failures** — 11 vitest failures + 2 lint
   errors identical to `master@eb4bad0` and PR1 tip `3366615`. Zero
   regressions introduced by PR2.
4. **Playwright runner not provisioned** — `tests/e2e/t043-booking-form.spec.ts`
   ships as a design artifact, excluded per T-042 precedent.

## Next Recommended Steps

1. **Orchestrator**: `gentle-ai review status` → START → reviewers →
   correction (if any) → finalize. Then push PR2 branch
   `feature/t043-booking-form-pr2` for review.
2. **After PR2 merges**: PR3 `chore(docs)` for any remaining artifacts.
3. **After PR3 merges**: `sdd-verify` for t043. Expected PASS, 4/4 reqs,
   13/13 GWT scenarios.
4. **After verify PASS**: `sdd-archive` → merge tracker to master with
   `--no-ff` per T-042 archive pattern.

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
