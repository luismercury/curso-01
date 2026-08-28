# Apply Progress: T-027 Appointment Service (FASE 6) — PR1+PR2+PR3 COMPLETE

**Change**: t027-appointment-service
**Mode**: Standard (strict_tdd: false — no TDD override)
**Delivery strategy**: auto-chain / feature-branch-chain
**Chain strategy**: feature-branch-chain (PR1 → master tracker, PR2 → PR1, PR3 → PR2)
**Status**: 17/17 tasks complete — PR1 Domain + PR2 Repo/Errors + PR3 Service + Verification complete
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

### Phase 3: Service Thin (R2,R3,R4,R5) — PR3

- [x] 3.1 Create `src/services/appointmentService.ts` with `AppointmentServiceDeps{db,config,now?}`; `createAppointment` validates schema, `servicio.active`, ownership via `assertOwnership`, `calculateEndAndValidate` + `fechaHoraFin<=finIntervaloOperativo` inclusive UTC via `config.timezone`, `TODO T-028` (no REPEATABLE READ/SELECT FOR UPDATE in executable)
- [x] 3.2 Implement `confirmAppointment`/`rejectAppointment`: load via `findTurnoById`, `canTransition(PENDIENTE→CONFIRMADO|RECHAZADO,ADMIN)`, `now<start` UTC `getTime()`, `updateTurnoStatus` → `TurnoDTO` (404 → `AppointmentNotFoundError`, invalid → `INVALID_APPOINTMENT_STATE`)
- [x] 3.3 Implement `cancelAppointment`: `canTransition(PEND→CANCEL,CONF→CANCEL,owner/ADMIN)` with ownership check first (`assertOwnership`), `now<start` borders `08:59 allow / 09:00:00 reject / 09:00:01 reject` UTC, `INVALID_APPOINTMENT_STATE "El turno ya comenzó"`
- [x] 3.4 Implement `getAppointmentById`/`listAppointments`: ownership (CLIENTE own via `assertOwnership`, ADMIN all), `APPOINTMENT_NOT_FOUND` 404, delegates to `findTurnosPaginated` with CLIENTE `customerId` forced, camelCase `TurnoDTO` no snake leak (INV-08)
- [x] 3.5 Write `src/services/__tests__/appointmentService.test.ts` with `vi.mock` repo + injected `now`: R1 role (table-driven 4 valid/invalid), R2 inactive/foreign/close-crossing/inclusive, R3 flags+pagination delegation, R4 borders 08:59/09:00:00/09:00:01 + ownership-first, R5 INV-08 leak check, R6 error shapes; 26 tests mocked, no Postgres, no `APPOINTMENT_NOT_AVAILABLE` in skeleton

### Phase 4: Verification — PR3

- [x] 4.1 `npx tsc --noEmit` zero errors
- [x] 4.2 `vitest` pure suites green: domain (38) + repo (18) + service (26) = 82 green
- [x] 4.3 Grep guards: `COMPLETADO` absent except negative test; `FOR UPDATE|REPEATABLE READ` empty in stripped executable (comments removed); `toTurnoDTO` present (INV-08) in `turnos.ts`
- [x] 4.4 Verify mapping R1→1.1/1.2/3.2, R2→3.1, R3→2.4/3.4, R4→3.3, R5→3.4, R6→2.1/2.2/3.5

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/domain/appointmentStateMachine.ts` | Created (PR1) | Pure domain: `AppointmentStatus` frozen `as const` + `z.enum`, `Role`, `TRANSITIONS` RN-07 matrix, `canTransition(from,to,role,opts?)` with optional `now < start` UTC guard, `isTerminal`, `allowedTransitions`. Zero DB deps. |
| `src/domain/__tests__/appointmentStateMachine.test.ts` | Created (PR1) | 38 table-driven tests: frozen enum + Zod rejects COMPLETADO, isTerminal 4, 6 valid + 16 invalid/role/terminal + time guard borders. |
| `src/services/errors.ts` | Modified (PR2) | Added `InvalidAppointmentStateError` (409 `INVALID_APPOINTMENT_STATE`), `AppointmentNotAvailableError` (409 `APPOINTMENT_NOT_AVAILABLE` 23P01), `AppointmentNotFoundError` (404 `APPOINTMENT_NOT_FOUND`). |
| `src/lib/http/errors.ts` | Modified (PR2) | Added `INVALID_APPOINTMENT_STATE` 409, `APPOINTMENT_NOT_AVAILABLE` 409, `APPOINTMENT_NOT_FOUND` 404 to `ERROR_CODES` + `STATUS_BY_CODE`. |
| `src/db/repositories/turnos.ts` | Modified (PR2) | Added `updateTurnoStatus` + `findTurnosPaginated` RN-04 defaults, `limit<=100 default 20`, `page/offset`, `sort`, `customerId` filter, `DbOrTx`, via `toTurnoDTO`, no `FOR UPDATE`/`REPEATABLE READ` executable. |
| `src/db/repositories/turnos.test.ts` | Created (PR2) | 18 mocked `DbOrTx` tests: passthrough INV-08, 23P01 map, pagination boundaries. |
| `src/services/appointmentService.ts` | Created (PR3) | Thin service: `AppointmentServiceDeps{db,config,now?}`, `createAppointment` (schema, active, ownership, `calculateEndAndValidate` inclusive, UTC via `config.timezone`, `TODO T-028`), `confirmAppointment`/`rejectAppointment` (`canTransition` + `now<start` UTC), `cancelAppointment` (ownership-first + borders), `getAppointmentById`/`listAppointments` (ownership + `findTurnosPaginated` delegation, INV-08). 201 lines, `server-only`, no `COMPLETADO`, stripped has no `FOR UPDATE`/`REPEATABLE READ`. |
| `src/services/__tests__/appointmentService.test.ts` | Created (PR3) | 26 mocked tests (`vi.mock` repo, injected `now`): R1 role table-driven, R2 inactive/foreign/close-crossing/inclusive, R3 flags+pagination, R4 borders 08:59/09:00:00/09:00:01 + ownership-first, R5 leak, R6 shapes. Concise table-driven, 170 lines <200. |
| `openspec/changes/t027-appointment-service/tasks.md` | Modified | Marked Phase 3 (3.1-3.5) + Phase 4 (4.1-4.4) [x] — 17/17 cumulative |
| `openspec/changes/t027-appointment-service/apply-progress.md` | Modified | This progress artifact (PR1+PR2+PR3 merged, 17/17 complete) |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | PR3: `npx vitest run src/services/__tests__/appointmentService.test.ts --reporter=verbose` — Test Files 1 passed, Tests 26 passed (Duration ~0.7s). Combined `npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts src/db/repositories/turnos.test.ts src/services/__tests__/appointmentService.test.ts --reporter=verbose` — Test Files 3 passed, Tests 82 passed (38 domain + 18 repo + 26 service). `npx tsc --noEmit` zero errors. PR2+PR1 prior: 56 passed preserved. |
| Runtime harness command/scenario and exact result | N/A — mocked DbOrTx / pure unit + injected `now`. No runtime DB, no HTTP. `node -e "strip comments → no FOR UPDATE/REPEATABLE READ"` → false/false (clean). `grep COMPLETADO` only in `__tests__` negative cases. Justified per work-unit row `N/A — mocked DbOrTx`. |
| Rollback boundary | Delete `src/services/appointmentService.ts` + `src/services/__tests__/appointmentService.test.ts` (`git rm` both) to revert PR3. No migration, no consumer break. `git checkout HEAD -- src/services/errors.ts src/lib/http/errors.ts src/db/repositories/turnos.ts` reverts PR2 if needed. PR2/PR1 rollback via `git checkout a4577fc --` restores domain slice. |

## Invariants Verified

- INV-02 States: Only `PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO` (UPPER_SNAKE) via `z.enum` + schema CHECK; `COMPLETADO` absent from executable source (verified via `Select-String` → only in `__tests__` negative cases). `allowedTransitions` has no such key.
- INV-08 DTO mapping: Service returns `TurnoDTO` via repo `toTurnoDTO` only — `customerId`/`vehicleId`/`serviceId`/`startDateTime`/`endDateTime`/`status`, no `fecha_hora_inicio`/`estado` leak. Tests assert `not.toHaveProperty("estado")` for getById/list/confirm.
- INV-04 Concurrency deferred: Stripped executable (comments removed via `replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')`) has 0 hits for `FOR UPDATE`/`REPEATABLE READ` in `appointmentService.ts` and `turnos.ts` — deferred to T-028. `TODO T-028` comment only.
- INV-06 Timezone: DB stores `TIMESTAMPTZ` UTC; API accepts `Date` UTC; `calculateEndAndValidate` uses `config.timezone = America/Argentina/Buenos_Aires` via `Intl` for inclusive `fechaHoraFin<=finIntervaloOperativo`; time guards use UTC `getTime()` only with injected `now`. No naive `TIMESTAMP`.
- INV-01/05 preserved: No capacity logic added; slot step 30 via `WorkshopConfig`; slot generation filtered by `durationMinutes` validated inclusive (`11:00+60==12:00` pass, `11:30+90>12:00` reject).
- INV-03 Auth: `assertOwnership` enforces `vehiculo.customerId == authUser.id` and `turno.customerId == authUser.id`; `ADMINISTRADOR` bypasses; `requireAuth`/`ForbiddenError` for 403.
- Grep guards: `COMPLETADO` → only negative tests (expected); `FOR UPDATE|REPEATABLE READ` in stripped code → 0 hits; `toTurnoDTO` present in `turnos.ts` (5 call sites).

## Deviations from Design

None — implementation matches design. `AppointmentServiceDeps{db,config,now?}` as spec, `DbOrTx` param for T-028 tx injection. `createAppointment` skeleton validates `servicio.active` → `InvalidServiceError (INVALID_SERVICE)`, ownership → `ForbiddenError`, duration inclusive via `calculateEndAndValidate` → `ValidationError`, defers atomic `TODO T-028`, delegates to `createTurno` with `customerId` derived from `vehicle.customerId`. `confirm`/`reject`/`cancel` use `canTransition` + `now<start` UTC `getTime()` + `updateTurnoStatus`. `getById`/`list` enforce ownership and delegate to `findTurnosPaginated` with CLIENTE `customerId` forced. All errors map per §12.

## Issues Found

None. `npx tsc --noEmit` zero errors, 82/82 pure tests green. No Postgres required for PR3 slice. Service 201 + tests 170 = 371 lines <400 budget (concise table-driven kept under limit).

## Workload / PR Boundary

- Mode: chained PR slice (feature-branch-chain)
- Current work unit: PR3 Service thin `AppointmentService` + verification (R2,R3,R4,R5 + 4.1-4.4) — autonomous, verification included
- Boundary: Starts at `src/services/appointmentService.ts` creation, ends at `appointmentService.test.ts` 26 green + `tsc` clean + grep guards clean. No repo/error overlap beyond delegation.
- Estimated review budget impact: ~371 lines (service 201 + tests 170), well under 400 budget, reviewable ≤30 min. Cumulative chain 17/17: PR1 3/17 + PR2 5/17 + PR3 9/17 = 17/17.
- Dependency diagram:
  ```
  master
    └─ PR1 feature/t027-appointment-service (Domain pure) ✓ 3/17
         └─ PR2 Repo+Errors ✓ 8/17 (PR1+PR2)
              └─ 📍 PR3 Service+Verification (current) ✓ 17/17 — FINAL
  ```
- Chain strategy: feature-branch-chain — PR3 incremental commit on same `feature/t027-appointment-service` branch; polluted diff check: PR3 diff = `appointmentService.ts` + `appointmentService.test.ts` + `tasks.md` + `apply-progress.md` only; no domain/repo overlap.

## Next Recommended

`sdd-verify` full change (artifacts and traceability validate, then `sdd-archive` delta specs sync).

## Traceability Check

- R1 (RN-07/INV-02) → 1.1/1.2 + 3.2/3.3: `canTransition` 6 valid + terminal + COMPLETADO rejection (PR1) + service `confirm`/`reject`/`cancel` role gating (PR3)
- R2 (Create Skeleton validation) → 3.1: `servicio.active` → `INVALID_SERVICE`, ownership → `FORBIDDEN`, `calculateEndAndValidate` inclusive `fechaHoraFin<=finIntervaloOperativo` via `config.timezone` (PR3) — inclusive test `11:00+60==12:00` pass, `11:30+90>12:00` reject
- R3 (RN-04 + Pagination) → 2.4 foundation + 3.4 delegation: `findTurnosPaginated` defaults + flags `includeCancelled/Rejected` + `limit<=100 default 20` + `page/offset` + `sort asc|desc` via `toTurnoDTO` (PR2) → service `listAppointments` CLIENTE `customerId` forced, ADMIN flags passthrough (PR3)
- R4 (Cancel Time Guard) → 3.3: `now<start` UTC `getTime()` with injected `now`, borders `08:59 allow / 09:00:00 reject / 09:00:01 reject` → `INVALID_APPOINTMENT_STATE "El turno ya comenzó"`, ownership-first `FORBIDDEN` before time guard (PR3)
- R5 (DTO Mapping INV-08) → 3.4: `toTurnoDTO` camelCase no snake leak via `getById`/`list`/`confirm` (PR3) — test asserts `not.toHaveProperty("estado")`
- R6 (Error Catalog §12) → 2.1/2.2 + 3.5: `InvalidAppointmentStateError` 409, `AppointmentNotFoundError` 404, `ValidationError` 400, `FORBIDDEN` 403, `INVALID_SERVICE` 400 as `{error:{code,message}}`; `APPOINTMENT_NOT_AVAILABLE` deferred to T-028, not thrown in skeleton (PR2+PR3)
- Grep `COMPLETADO` → only in `__tests__` negative cases + turnos integrity negative insert (no executable state)
- `FOR UPDATE|REPEATABLE READ` in stripped executable → 0 hits (T-027), `TODO T-028` comment only
- `toTurnoDTO` → present (5 call sites in `turnos.ts`, delegation in service)

## Merge Protocol Note

This artifact merges PR1 (3/17) preserved verbatim + PR2 (5/17) preserved verbatim + PR3 (9/17) added — cumulative 17/17 complete. Prior progress #294 3/17 and PR1+PR2 8/17 preserved; next `sdd-archive` delta syncs `openspec/specs/appointment/spec.md` (no further apply needed).
