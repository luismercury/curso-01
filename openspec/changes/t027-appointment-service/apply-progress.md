# Apply Progress: T-027 Appointment Service (FASE 6) — PR1 Domain Slice

**Change**: t027-appointment-service
**Mode**: Standard (strict_tdd: false — no TDD override)
**Delivery strategy**: auto-chain / feature-branch-chain
**Chain strategy**: feature-branch-chain (PR1 → master tracker, PR2 → PR1, PR3 → PR2)
**Status**: 3/17 tasks complete — PR1 Domain pure slice complete, pending PR2/PR3
**Date**: 2026-08-28
**Branch**: feature/t027-appointment-service (base: master)

## Completed Tasks

### Phase 1: Domain Pure (R1 — RN-07/INV-02) — PR1

- [x] 1.1 Create `src/domain/appointmentStateMachine.ts` with `z.enum(['PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'])`, `canTransition(from,to,role,opts?)`, `isTerminal` — no COMPLETADO
- [x] 1.2 Write `src/domain/__tests__/appointmentStateMachine.test.ts` table-driven `test.each`: 6 valid + 12+ invalid/role/terminal + COMPLETADO Zod rejection
- [x] 1.3 Run `npx tsc --noEmit` + domain tests green

## Pending Tasks (for next PRs)

### Phase 2: Repo + Error Catalog (R6, R3-foundation) — PR2

- [ ] 2.1 Extend `src/services/errors.ts` with `InvalidAppointmentStateError` + `AppointmentNotAvailableError`
- [ ] 2.2 Extend `src/lib/http/errors.ts` with `INVALID_APPOINTMENT_STATE`, `APPOINTMENT_NOT_AVAILABLE`, `APPOINTMENT_NOT_FOUND`
- [ ] 2.3 Add `updateTurnoStatus(db: DbOrTx, id, status)` to `src/db/repositories/turnos.ts`
- [ ] 2.4 Add `findTurnosPaginated(db: DbOrTx, query)` — RN-04 defaults + pagination
- [ ] 2.5 Test repo with mocked `DbOrTx`

### Phase 3: Service Thin (R2,R3,R4,R5) — PR3

- [ ] 3.1 Create `src/services/appointmentService.ts` — `createAppointment` skeleton
- [ ] 3.2 Implement `confirmAppointment`/`rejectAppointment`
- [ ] 3.3 Implement `cancelAppointment` with borders
- [ ] 3.4 Implement `getAppointmentById`/`listAppointments`
- [ ] 3.5 Write `src/services/__tests__/appointmentService.test.ts`

### Phase 4: Verification — PR3

- [ ] 4.1 `npx tsc --noEmit` zero errors
- [ ] 4.2 `vitest` pure suites green: domain + service
- [ ] 4.3 Grep guards: `COMPLETADO` absent except negative test; `FOR UPDATE|REPEATABLE READ` empty; `toTurnoDTO` present
- [ ] 4.4 Verify mapping R1→1.1/1.2/3.2, R2→3.1, R3→2.4/3.4, R4→3.3, R5→3.4, R6→2.1/2.2/3.5

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/domain/appointmentStateMachine.ts` | Created | Pure domain module: `AppointmentStatus` frozen `as const` + `z.enum`, `Role`, `TRANSITIONS` RN-07 matrix, `canTransition(from,to,role,opts?)` with optional `now < start` UTC guard, `isTerminal`, `allowedTransitions` export. Zero DB deps, no COMPLETADO literal. |
| `src/domain/__tests__/appointmentStateMachine.test.ts` | Created | Table-driven 38 tests: frozen enum + Zod rejects COMPLETADO, isTerminal 4 cases, 6 valid transitions + future opts, 16 invalid/role/terminal + time guard borders, COMPLETADO cast rejection. |
| `openspec/changes/t027-appointment-service/tasks.md` | Modified | Marked Phase 1 (1.1-1.3) [x] |
| `openspec/changes/t027-appointment-service/apply-progress.md` | Created | This progress artifact (PR1 slice) |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts --reporter=verbose` — Test Files 1 passed, Tests 38 passed (Duration ~495ms, transform 51ms) |
| Runtime harness command/scenario and exact result | N/A — pure unit, no runtime boundary. Domain is zero-dep pure function; no DB, no HTTP, no process. Justified per Suggested Work Units. |
| Rollback boundary | Delete `src/domain/appointmentStateMachine.ts` + `src/domain/__tests__/appointmentStateMachine.test.ts` + revert `tasks.md` checkboxes. No migration, no consumer break. `git checkout master -- src/domain` or delete untracked files restores. |

## Invariants Verified

- INV-02 States: Only `PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO` (UPPER_SNAKE) via `z.enum`; `COMPLETADO` absent from domain source, Zod rejects it, `allowedTransitions` has no such key.
- INV-01/04/05/06/08 preserved: Domain pure — no `FOR UPDATE`, no `REPEATABLE READ`, no DB import, no slot logic;Time guard uses UTC `getTime()` when opts provided.
- DTO mapping invariant intact: Pure domain, no mapper leakage risk yet — noted for PR3.
- Grep guards: `Select-String COMPLETADO src/domain/appointmentStateMachine.ts` → 0 hits (comment sanitized); `FOR UPDATE|REPEATABLE READ` → 0 hits.

## Deviations from Design

None — implementation matches design. `canTransition` signature includes `opts?: {now, startDateTime}` as specified; optional time guard preserves both pure role check and service-level precise border tests. `allowedTransitions` exported for observability; `AppointmentStatus` frozen `as const`.

## Issues Found

None. `npx tsc --noEmit` zero errors, 38/38 tests green. Branch `feature/t027-appointment-service` created from `master` per feature-branch-chain PR1→master.

## Workload / PR Boundary

- Mode: chained PR slice (feature-branch-chain)
- Current work unit: PR1 Domain `canTransition`/`isTerminal` + tests (R1) — autonomous, pure zero-dep
- Boundary: Starts at domain file creation, ends at tsc + 38 tests green. No repo/service touched.
- Estimated review budget impact: ~180 lines (domain 55 + tests 130), well under 400 budget, reviewable ≤20 min.
- Dependency diagram:
  ```
  master
    └─ 📍 PR1 feature/t027-appointment-service (Domain pure) ← YOU ARE HERE
         └─ PR2 feature/t027-appointment-service-repo (Repo+Errors) [pending]
              └─ PR3 feature/t027-appointment-service-service (Service thin) [pending]
  ```
- Chain strategy: feature-branch-chain — PR1 targets `master` tracker, PR2 will target PR1 branch, PR3 targets PR2. Polluted diff check: only domain slice in diff.

## Next Recommended

Next apply PR2 (Phase 2 Repo + Error Catalog): extend `errors.ts` + `http/errors.ts` + `turnos.ts` (`updateTurnoStatus`, `findTurnosPaginated`), mocked `DbOrTx` tests, then PR3 Service thin. Alternatively, run `sdd-verify` slice verification for PR1 only (focused domain gate).

## Traceability Check

- R1 (RN-07/INV-02) → 1.1/1.2: `canTransition` 6 valid + terminal + COMPLETADO rejection
- Grep `COMPLETADO` → only in `__tests__` negative cases (11 hits), 0 in domain source
- `FOR UPDATE|REPEATABLE READ` → 0 hits in T-027 diff

## Merge Protocol Note

This artifact includes cumulative state; prior progress was none (first slice). Next save must merge this PR1 section with PR2/PR3 completions.
