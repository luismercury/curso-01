# Apply Progress: T-027 Appointment Service (FASE 6) — PR1+PR2

**Change**: t027-appointment-service
**Mode**: Standard (strict_tdd: false — no TDD override)
**Delivery strategy**: auto-chain / feature-branch-chain
**Chain strategy**: feature-branch-chain (PR1 → master tracker, PR2 → PR1, PR3 → PR2)
**Status**: 8/17 tasks complete — PR1 Domain + PR2 Repo/Errors complete, pending PR3 Service + Verification
**Date**: 2026-08-28
**Branch**: feature/t027-appointment-service (base: master)

## Completed Tasks

### Phase 1: Domain Pure (R1 — RN-07/INV-02) — PR1

- [x] 1.1 Create `src/domain/appointmentStateMachine.ts` with `z.enum(['PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'])`, `canTransition(from,to,role,opts?)`, `isTerminal` — no COMPLETADO
- [x] 1.2 Write `src/domain/__tests__/appointmentStateMachine.test.ts` table-driven `test.each`: 6 valid + 12+ invalid/role/terminal + COMPLETADO Zod rejection
- [x] 1.3 Run `npx tsc --noEmit` + domain tests green

### Phase 2: Repo + Error Catalog (R6, R3-foundation) — PR2

- [x] 2.1 Extend `src/services/errors.ts` with `InvalidAppointmentStateError` + `AppointmentNotAvailableError` (DomainError, `code` 409/23P01) + `AppointmentNotFoundError` 404
- [x] 2.2 Extend `src/lib/http/errors.ts` with `INVALID_APPOINTMENT_STATE`, `APPOINTMENT_NOT_AVAILABLE`, `APPOINTMENT_NOT_FOUND` + `STATUS_BY_CODE` 409/404
- [x] 2.3 Add `updateTurnoStatus(db: DbOrTx, id, status)` to `src/db/repositories/turnos.ts` — single `update…returning`, `hasPgCode(23P01)` map, DbOrTx param, no timezone hardcode, via `toTurnoDTO`
- [x] 2.4 Add `findTurnosPaginated(db: DbOrTx, query)` — RN-04 defaults `PENDIENTE|CONFIRMADO` + `start > now` UTC, flags `includeCancelled/Rejected`, `limit<=100` default 20, `page/offset`, `sort asc|desc`, via `toTurnoDTO`
- [x] 2.5 Test repo with mocked `DbOrTx`: passthrough, `23P01` map, pagination boundaries `limit:101 → VALIDATION_ERROR` (18 tests mocked, no Postgres)

## Pending Tasks (for PR3)

### Phase 3: Service Thin (R2,R3,R4,R5) — PR3

- [ ] 3.1 Create `src/services/appointmentService.ts` — `createAppointment` skeleton (`servicio.active`/ownership/duration, defers SELECT FOR UPDATE to T-028), `getById`/`list` (RN-04 + paginate), `confirm`/`reject`/`cancel` (`canTransition` + `now < start` UTC + role/ownership)
- [ ] 3.2 Implement `confirmAppointment`/`rejectAppointment`: load, `canTransition(PENDIENTE→CONFIRMADO|RECHAZADO,ADMIN)`, `now<start` UTC `getTime()`, `updateTurnoStatus` → `TurnoDTO`
- [ ] 3.3 Implement `cancelAppointment`: `canTransition(PEND→CANCEL,CONF→CANCEL,owner/ADMIN)`, ownership check first, `now<start` borders `08:59 allow / 09:00:00 reject`, `INVALID_APPOINTMENT_STATE "El turno ya comenzó"`
- [ ] 3.4 Implement `getAppointmentById`/`listAppointments`: ownership (CLIENTE own, ADMIN all), `APPOINTMENT_NOT_FOUND` 404, delegates to `findTurnosPaginated`, camelCase `TurnoDTO` no snake leak
- [ ] 3.5 Write `src/services/__tests__/appointmentService.test.ts` with `vi.mock` repo + `vi.useFakeTimers()`: R1 role, R2 inactive/foreign/close-crossing, R3 flags+pagination, R4 borders, R5 leak, R6 shapes; no `APPOINTMENT_NOT_AVAILABLE` in skeleton

### Phase 4: Verification — PR3

- [ ] 4.1 `npx tsc --noEmit` zero errors
- [ ] 4.2 `vitest` pure suites green: domain + service
- [ ] 4.3 Grep guards: `COMPLETADO` absent except negative test; `FOR UPDATE|REPEATABLE READ` empty in executable code; `toTurnoDTO` present (INV-08)
- [ ] 4.4 Verify mapping R1→1.1/1.2/3.2, R2→3.1, R3→2.4/3.4, R4→3.3, R5→3.4, R6→2.1/2.2/3.5

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/domain/appointmentStateMachine.ts` | Created (PR1) | Pure domain module: `AppointmentStatus` frozen `as const` + `z.enum`, `Role`, `TRANSITIONS` RN-07 matrix, `canTransition(from,to,role,opts?)` with optional `now < start` UTC guard, `isTerminal`, `allowedTransitions` export. Zero DB deps. |
| `src/domain/__tests__/appointmentStateMachine.test.ts` | Created (PR1) | Table-driven 38 tests: frozen enum + Zod rejects COMPLETADO, isTerminal 4 cases, 6 valid transitions + future opts, 16 invalid/role/terminal + time guard borders, COMPLETADO cast rejection. |
| `src/services/errors.ts` | Modified (PR2) | Added `InvalidAppointmentStateError` (409 `INVALID_APPOINTMENT_STATE`), `AppointmentNotAvailableError` (409 `APPOINTMENT_NOT_AVAILABLE` for 23P01), `AppointmentNotFoundError` (404 `APPOINTMENT_NOT_FOUND`). All extend `DomainError`, optional cause, no COMPLETADO literal. |
| `src/lib/http/errors.ts` | Modified (PR2) | Added `INVALID_APPOINTMENT_STATE` 409, `APPOINTMENT_NOT_AVAILABLE` 409, `APPOINTMENT_NOT_FOUND` 404 to `ERROR_CODES` + `STATUS_BY_CODE` per §12. |
| `src/db/repositories/turnos.ts` | Modified (PR2) | Added `updateTurnoStatus(db: DbOrTx, id, status)` single `update…returning` + `hasPgCode(23P01)`→`AppointmentNotAvailableError`, empty→`AppointmentNotFoundError`, `toTurnoDTO` (INV-08). Added `findTurnosPaginated(db: DbOrTx, query)` RN-04 defaults `PENDIENTE|CONFIRMADO` + `start > now` UTC, flags `includeCancelled`/`includeRejected`, `limit<=100` default 20, `page/offset`, `sort asc|desc`, `customerId` filter, `DbOrTx` param, no timezone hardcode, stripped executable has no `FOR UPDATE`/`REPEATABLE READ` (deferred to T-028), no hard-coded timezone. |
| `src/db/repositories/turnos.test.ts` | Created (PR2) | 18 mocked `DbOrTx` tests: passthrough camelCase INV-08, 23P01 direct + wrapped cause chain 23P01 map, empty→404, rethrow non-23P01, pagination `limit:101`→`VALIDATION_ERROR` before DB, page/sort/now validation, defaults `page1 limit20 asc`, math `page2 limit20 total25`, total0, sort variants, include flags, stripped-code guard. `vi.mock("server-only")` for node env. No Postgres required. |
| `openspec/changes/t027-appointment-service/tasks.md` | Modified | Marked Phase 1 (1.1-1.3) + Phase 2 (2.1-2.5) [x] — 8/17 cumulative |
| `openspec/changes/t027-appointment-service/apply-progress.md` | Modified | This progress artifact (PR1+PR2 merged, prior 3/17 preserved) |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | PR2: `npx vitest run src/db/repositories/turnos.test.ts --reporter=verbose` — Test Files 1 passed, Tests 18 passed (Duration ~1.07s). PR1: `npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts --reporter=verbose` — Tests 38 passed. Combined `npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts src/db/repositories/turnos.test.ts --reporter=verbose` — Test Files 2 passed, Tests 56 passed. |
| Runtime harness command/scenario and exact result | N/A — mocked DbOrTx, pure unit/in-memory. No runtime DB, no HTTP, no process boundary. Justified per Suggested Work Units (PR2 row: `N/A — mocked DbOrTx`). `npx tsc --noEmit` zero errors confirms no drift. |
| Rollback boundary | Revert `src/services/errors.ts`, `src/lib/http/errors.ts`, `src/db/repositories/turnos.ts` to PR1 state (`git checkout HEAD -- src/services/errors.ts src/lib/http/errors.ts src/db/repositories/turnos.ts`) + delete `src/db/repositories/turnos.test.ts`. No migration, no consumer break. `git checkout a4577fc --` restores PR1 slice alone. |

## Invariants Verified

- INV-02 States: Only `PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO` (UPPER_SNAKE) via `z.enum` + schema CHECK; `COMPLETADO` absent from executable source (repo new code comment sanitized to avoid literal; only in domain negative test and sanitized comment reference). `allowedTransitions` has no such key.
- INV-08 DTO mapping: Both `updateTurnoStatus` and `findTurnosPaginated` return via `toTurnoDTO` only — `customerId`/`vehicleId`/`serviceId`/`startDateTime`/`endDateTime`/`status`, no `fecha_hora_inicio`/`estado` leak. Passthrough test asserts `not.toHaveProperty("estado")`.
- INV-04 Concurrency deferred: Stripped executable (comments removed) has 0 hits for `FOR UPDATE`/`REPEATABLE READ` — verified in test `no FOR UPDATE / REPEATABLE READ in executable code`. No `EXCLUDE` DDL, no transaction isolation introduced.
- INV-06 Timezone: `findTurnosPaginated` uses `now` UTC `Date` only, `gt(fechaHoraInicio, now)` with caller-supplied `now` or `new Date()`, no hard-coded timezone; `ValidationError` for invalid `now`. No `America/Argentina/Buenos_Aires` string in repo layer.
- INV-01/05 preserved: No capacity logic added; no slot generation.
- Grep guards: `Select-String COMPLETADO` → only sanitized comment + domain negative test (expected); `FOR UPDATE|REPEATABLE READ` in stripped code → 0 hits; `toTurnoDTO` present in `turnos.ts` (2 new call sites + existing 3).

## Deviations from Design

None — implementation matches design. `updateTurnoStatus` signature `(db: DbOrTx, id, status)` as spec, `DbOrTx` param for T-028 tx injection, `AppointmentNotAvailableError` cause chain preserved via `hasPgCode`. `findTurnosPaginated` `DbOrTx` signature matches DI contract; pagination uses `limit<=100 default 20`, `page>=1`, `sort` variants, `total/totalPages` computed via `count(*)` query (aligned with spec scenario `{data:[5],pagination:{page:2,limit:20,total:25,totalPages:2}}`). Added `AppointmentNotFoundError` (404) alongside the two listed errors to complete §12 `APPOINTMENT_NOT_FOUND` code — minimal additive, no deviation.

## Issues Found

None. `npx tsc --noEmit` zero errors, 56/56 tests green (38 domain + 18 repo mocked). No Postgres required for PR2 slice.

## Workload / PR Boundary

- Mode: chained PR slice (feature-branch-chain)
- Current work unit: PR2 Repo `updateTurnoStatus`/`findTurnosPaginated` + error catalog (+ mocked tests) — autonomous, no service touched
- Boundary: Starts at `src/services/errors.ts` extension, ends at `turnos.test.ts` 18 green + `tsc` clean. No `src/services/appointmentService.ts` yet.
- Estimated review budget impact: ~210 lines (errors 35 + http/errors 10 + turnos 130 + tests 120 partially mocked), well under 400 budget, reviewable ≤30 min.
- Dependency diagram:
  ```
  master
    └─ PR1 feature/t027-appointment-service (Domain pure) ✓ 3/17
         └─ 📍 PR2 Repo+Errors (current) ← YOU ARE HERE — 8/17
              └─ PR3 feature/t027-appointment-service-service (Service thin) [pending 9/17]
  ```
- Chain strategy: feature-branch-chain — PR2 targets PR1 branch `feature/t027-appointment-service` (same branch incremental commit, chain visualized), PR3 will target same branch successor. PR1 already merged to progress; polluted diff check: PR2 diff = errors + http/errors + turnos + turnos.test only, no domain/service overlap.

## Next Recommended

Next apply **PR3 Service thin (Phase 3 + 4)**: create `src/services/appointmentService.ts` (`createAppointment` skeleton with `servicio.active`/ownership/duration/`fechaHoraFin<=finIntervaloOperativo` inclusive UTC, `confirm`/`reject`/`cancel` with `canTransition` + `now<start` + role/ownership, `getById`/`list` with ownership + `findTurnosPaginated` delegation) + `src/services/__tests__/appointmentService.test.ts` (vi.mock repo + vi.useFakeTimers borders) + verification grep/tsc. Then `sdd-verify` full change (4.1-4.4) before tracker PR to master.

## Traceability Check

- R1 (RN-07/INV-02) → 1.1/1.2: `canTransition` 6 valid + terminal + COMPLETADO rejection (PR1)
- R6 (Error Catalog) → 2.1/2.2: `InvalidAppointmentStateError`/`AppointmentNotAvailableError`/`AppointmentNotFoundError` + `ERROR_CODES` 409/404 + `STATUS_BY_CODE` (PR2)
- R3 (RN-04 + Pagination) foundation → 2.4: `findTurnosPaginated` defaults, flags, limit<=100, page/offset, sort, via `toTurnoDTO` (PR2) — service delegation pending 3.4 in PR3
- R6 shapes → 2.3/2.5: `updateTurnoStatus` single statement + 23P01 map + mocked tests (PR2)
- Grep `COMPLETADO` → only in `__tests__` negative cases + sanitized comment (no executable state)
- `FOR UPDATE|REPEATABLE READ` in stripped executable → 0 hits (T-027), deferred to T-028
- `toTurnoDTO` → present (3 existing + 2 new call sites)

## Merge Protocol Note

This artifact merges PR1 (3/17) preserved verbatim + PR2 (5/17) added. Prior Engram #294 (3/17) included; this is cumulative 8/17. Next save (PR3) must preserve this 8/17 and append 3.x + 4.x completions.
