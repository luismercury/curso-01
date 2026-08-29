# Apply Progress — t034-lifecycle-tests

## Change
t034-lifecycle-tests — Exhaustive RN-07 Lifecycle Coverage (EC-03/EC-04, H-12/H-13)
Branch: feature/t034-lifecycle-tests from master 74795b9
Mode: Standard (strict_tdd false)

## Completed Tasks
- [x] 1.1 T-034-001 Create src/domain/__tests__/t034.lifecycle.matrix.test.ts — 32-cell matrix + time-guard + isTerminal + COMPLETADO rejection
- [x] 2.1 T-034-002 Create src/services/__tests__/appointmentLifecycle.test.ts — 4 valid chains (PENDIENTE->CONFIRMADO/RECHAZADO/CANCELADO, CONFIRMADO->CANCELADO owner+ADMIN)
- [x] 2.2 T-034-003 Same file — 4 invalids 409 + terminal RECHAZADO|CANCELADO->CANCELADO 409 + EC-03 past
- [x] 3.1 T-034-004 Same file — H-12 trios 11:59Z allow / 12:00Z reject / 12:00:01Z reject for cancel (PENDIENTE|CONFIRMADO) and confirm/reject (PENDIENTE) via deps.now strict <
- [x] 3.2 T-034-005 Same file — H-13 inactive 400 + foreign 403 before lock (countActiveOverlappingForUpdate not called), H-11/EC-04 listAppointments default hides CANCELADO|RECHAZADO, flags opt-in, RECHAZADO non-active
- [x] 4.1 T-034-006 Verify no COMPLETADO leak, no prod changes, vitest green without DB, tsc --noEmit clean; rollback delete 2 test files

## Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| src/domain/__tests__/t034.lifecycle.matrix.test.ts | Created | 32-cell canTransition matrix (no opts 6 true/26 false), 12 time-guard rows strict <, isTerminal, COMPLETADO rejection, allowedTransitions guard (~187 LOC) |
| src/services/__tests__/appointmentLifecycle.test.ts | Created | Mocked AppointmentService: valid chains 5, invalid 8 incl terminal/EC-03, H-12 13 border cases, H-13 2, H-11/EC-04 6; vi.mock turnos/vehiculos/servicios, deps.now UTC, no DB (~570 LOC) |
| openspec/changes/t034-lifecycle-tests/tasks.md | Modified | All 6 tasks [ ]->[x] |
| openspec/changes/t034-lifecycle-tests/apply-progress.md | Created | This progress file |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command | `npx vitest run src/domain/__tests__/t034.lifecycle.matrix.test.ts src/services/__tests__/appointmentLifecycle.test.ts` |
| Focused test result | PASS — 2 files, 90 tests passed (matrix 55, service 35) Duration 1.59s |
| Full unit run without DB | `npx vitest run` for those 2 files green, no ECONNREFUSED |
| Typecheck | `npx tsc --noEmit` clean (no output) |
| Runtime harness | N/A — mocked deps, deps.now UTC, no DB; no FOR UPDATE in query path; toTurnoDTO via makeTurno DTO camelCase |
| Rollback boundary | Delete 2 new test files: `src/domain/__tests__/t034.lifecycle.matrix.test.ts`, `src/services/__tests__/appointmentLifecycle.test.ts` |

## Deviations from Design
- Actual LOC 757 vs forecast ~330: service file 570 vs est 250 due to exhaustive H-12 trios (4×3=12) + H-11/EC-04 6 cases + comments/fixtures. Design budget Low but actual exceeds 400 review budget. Mitigation: test-only, no prod mutation, 2 work-unit commits for review slicing; content remains mocked deterministic. Consider as size:exception-for-tests (no prod risk).
- File naming: `t034.lifecycle.matrix.test.ts` per tasks option (alternative `t034-lifecycle-matrix.test.ts` not used).

## Issues Found
None — all 6 ADDED requirements covered, 17 GWT scenarios exercised.

## Remaining Tasks
None — 6/6 complete. Ready for verify.

## Workload / PR Boundary
- Mode: single PR (feature/t034-lifecycle-tests -> main)
- Current work unit: 1 — Matrix + service lifecycle, H-12/H-13, visibility (test-only)
- Boundary: T-034-001..T-034-006 inclusive, 2 commits (matrix + service), test-only
- Estimated review budget impact: 757 LOC test-only, 2 files, low risk, no DB, rollback delete 2 files

## Commits
- 39972cf test(domain): add t034 RN-07 exhaustive 32-cell matrix with strict H-12 borders
- 2d60040 test(service): add t034 lifecycle chains, invalid 409s, H-12/H-13, H-11/EC-04 mocked deps.now

## Verification
- `npx vitest run src/domain/__tests__/t034.lifecycle.matrix.test.ts src/services/__tests__/appointmentLifecycle.test.ts` — 90 passed
- `npx tsc --noEmit` — clean
- No prod files modified: `git diff HEAD --name-only` shows only 2 test files + tasks/progress
- No COMPLETADO in allowedTransitions, no FOR UPDATE string in domain layer

## Next Recommended
sdd-verify
