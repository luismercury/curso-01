# Apply Progress: t043-booking-form — PR1 of 2 (VehicleSelector + Page Wiring)

> Hybrid artifact mirror — Engram topic `sdd/t043-booking-form/apply-progress`
> carries the same content. This file is the filesystem mirror under
> `openspec/changes/t043-booking-form/` per the T-041 / T-042 precedent.

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
| Apply PR1 | DONE | Branch `feature/t043-booking-form-pr1` from `master=eb4bad0`. 9/9 tasks complete. |
| Apply PR2 | PENDING | `feature/t043-booking-form-pr2` off PR1 tip — BookingForm + lib/api/appointments + Summary + 409/403/422/401 envelope + e2e |
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
