```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:36c2c5d3bfdc2d27c277fe3c5917d21770d46cb4bca9fadf2276b71a7cfaa603
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 11/11
test_command: npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts src/db/repositories/turnos.test.ts src/services/__tests__/appointmentService.test.ts --reporter=verbose
test_exit_code: 0
test_output_hash: sha256:b87c92e7d784b4d369afc027b4a18d5518bb42fd4c0a9af6b40cddbbb315ecbe
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: t027-appointment-service
**Version**: N/A
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

All 17 tasks from `openspec/changes/t027-appointment-service/tasks.md` are checked (Phase 1: 1.1-1.3, Phase 2: 2.1-2.5, Phase 3: 3.1-3.5, Phase 4: 4.1-4.4). No pending tasks block verification. `sdd-status` confirms `tasks: 17/17 complete`, `apply: all_done`, `verify: ready`. Branch `feature/t027-appointment-service` commits a4577fc, a1f26e4, 6c76202.

### Build & Tests Execution
**Build**: ✅ Passed
```text
Command: npx tsc --noEmit
Exit: 0
Output: (empty - no type errors)
Hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

**Tests**: ✅ 82 passed / ❌ 0 failed / ⏭ 0 skipped (3 test files)
```text
Command: npx vitest run src/domain/__tests__/appointmentStateMachine.test.ts src/db/repositories/turnos.test.ts src/services/__tests__/appointmentService.test.ts --reporter=verbose
Exit: 0
Hash: sha256:b87c92e7d784b4d369afc027b4a18d5518bb42fd4c0a9af6b40cddbbb315ecbe
Duration: 1.12s (transform 381ms, import 1.46s, tests 75ms)

 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > contains exactly PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > is readonly tuple length 4
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > AppointmentStatusSchema parses each valid status
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > rejects COMPLETADO via Zod
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > rejects arbitrary invalid strings
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > AppointmentStatus — frozen enum > allowedTransitions is pure object with no COMPLETADO key
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > isTerminal > isTerminal(RECHAZADO) === true
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > isTerminal > isTerminal(CANCELADO) === true
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > isTerminal > isTerminal(PENDIENTE) === false
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > isTerminal > isTerminal(CONFIRMADO) === false
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows PENDIENTE -> CONFIRMADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows PENDIENTE -> RECHAZADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows PENDIENTE -> CANCELADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows PENDIENTE -> CANCELADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows CONFIRMADO -> CANCELADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > allows CONFIRMADO -> CANCELADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > PENDIENTE->CANCELADO with future opts still allows
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — valid transitions (6) > CONFIRMADO->CANCELADO with future opts still allows
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE -> CONFIRMADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE -> RECHAZADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE -> PENDIENTE as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CONFIRMADO -> CONFIRMADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CONFIRMADO -> RECHAZADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CONFIRMADO -> PENDIENTE as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE -> CONFIRMADO as CLIENTE (duplicate)
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies RECHAZADO -> PENDIENTE as ADMINISTRADOR (terminal)
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies RECHAZADO -> CANCELADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies RECHAZADO -> CONFIRMADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CANCELADO -> PENDIENTE as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CANCELADO -> CONFIRMADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CANCELADO -> CANCELADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies RECHAZADO -> RECHAZADO as ADMINISTRADOR
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CONFIRMADO -> RECHAZADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE -> RECHAZADO as CLIENTE
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies PENDIENTE->CANCELADO when now >= start
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > denies CONFIRMADO->CANCELADO when now == start exactly
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — invalid / role / terminal > without opts, time guard is not enforced
 ✓ src/domain/__tests__/appointmentStateMachine.test.ts > canTransition — COMPLETADO rejection > Zod rejects COMPLETADO and canTransition returns false if cast
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > rejects inactive → INVALID_SERVICE
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > rejects foreign → FORBIDDEN
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > ADMIN bypasses foreign
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > rejects close-crossing 11:30+90>12:00 → VALIDATION_ERROR
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > allows inclusive 11:00+60==12:00
 ✓ src/services/__tests__/appointmentService.test.ts > createAppointment R2 > skeleton does not throw APPOINTMENT_NOT_AVAILABLE
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > confirm ADMIN allowed
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > confirm CLIENTE denied
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > reject ADMIN allowed
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > reject CLIENTE denied
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > confirm fails when now>=start → El turno ya comenzó
 ✓ src/services/__tests__/appointmentService.test.ts > confirm/reject R1 > unknown id → 404
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > border 08:59 allow
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > border 09:00:00 reject
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > border 09:00:01 reject
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > non-owner → FORBIDDEN before time guard
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > owner and ADMIN allowed CONFIRMADO→CANCELADO future
 ✓ src/services/__tests__/appointmentService.test.ts > cancel R4 borders + ownership-first > terminal → INVALID_APPOINTMENT_STATE
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > getById owner allowed, non-owner FORBIDDEN, ADMIN bypass
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > getById 404
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > list delegates RN-04 defaults pagination
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > list ADMIN respects flags
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > list CLIENTE overrides customerId
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > DTO camelCase no snake leak INV-08
 ✓ src/services/__tests__/appointmentService.test.ts > getById/list R3+R5 > limit:101 propagates VALIDATION_ERROR
 ✓ src/services/__tests__/appointmentService.test.ts > R6 shapes > codes correct
 ✓ src/db/repositories/turnos.test.ts > updateTurnoStatus — DbOrTx thin repo > passthrough returns TurnoDTO camelCase via toTurnoDTO
 ✓ src/db/repositories/turnos.test.ts > updateTurnoStatus — DbOrTx thin repo > maps 23P01 EXCLUDE violation → AppointmentNotAvailableError
 ✓ src/db/repositories/turnos.test.ts > updateTurnoStatus — DbOrTx thin repo > maps wrapped Drizzle cause chain 23P01 → AppointmentNotAvailableError
 ✓ src/db/repositories/turnos.test.ts > updateTurnoStatus — DbOrTx thin repo > throws AppointmentNotFoundError when returning empty
 ✓ src/db/repositories/turnos.test.ts > updateTurnoStatus — DbOrTx thin repo > rethrows non-23P01 errors unchanged
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > limit 101 → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { limit: +0 } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { limit: -1 } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { page: +0 } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { page: -2 } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { sort: 'invalid' } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > rejects { now: Invalid Date } → VALIDATION_ERROR
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > defaults: page 1 limit 20 asc, no timezone hardcode, returns paginated shape via toTurnoDTO
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > pagination math: page 2 limit 20 total 25 → offset 20, totalPages 2
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > total 0 → totalPages 0, empty data
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > accepts sort variants asc|desc|startAt:asc|startAt:desc
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > exposes include flags without throwing
 ✓ src/db/repositories/turnos.test.ts > findTurnosPaginated — RN-04 defaults > no FOR UPDATE / REPEATABLE READ in executable code
```

**Coverage**: ➖ Not available (no --coverage threshold configured; pure unit suite focuses on behavioral compliance)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| State Transition Matrix via canTransition (RN-07, INV-02) | PENDIENTE→CONFIRMADO/RECHAZADO role-gated | `appointmentStateMachine.test.ts > canTransition — valid transitions > allows PENDIENTE -> CONFIRMADO as ADMINISTRADOR` + `denies PENDIENTE -> CONFIRMADO as CLIENTE` + `appointmentService.test.ts > confirm/reject R1 > confirm ADMIN allowed / CLIENTE denied` | ✅ COMPLIANT |
| State Transition Matrix via canTransition (RN-07, INV-02) | Cancel allow owner/admin, terminals blocked, COMPLETADO rejected | `appointmentStateMachine.test.ts > isTerminal + canTransition > denies RECHAZADO/CANCELADO -> * + rejects COMPLETADO via Zod + Zod rejects COMPLETADO and canTransition false` + `appointmentService.test.ts > cancel R4 > terminal → INVALID_APPOINTMENT_STATE + owner and ADMIN allowed` | ✅ COMPLIANT |
| Create Skeleton (validation only, defers atomicity) | Inclusive close passes | `appointmentService.test.ts > createAppointment R2 > allows inclusive 11:00+60==12:00` — 60min start 11:00 BA→UTC satisfies `<= 12:00` via `calculateEndAndValidate` + `config.timezone` | ✅ COMPLIANT |
| Create Skeleton (validation only, defers atomicity) | Reject inactive, foreign vehicle, close-crossing | `appointmentService.test.ts > createAppointment R2 > rejects inactive → INVALID_SERVICE + rejects foreign → FORBIDDEN + rejects close-crossing 11:30+90>12:00 → VALIDATION_ERROR` — no INSERT asserted | ✅ COMPLIANT |
| Query Filters RN-04 with Pagination | Default hides CANCELADO/RECHAZADO, flags opt-in | `turnos.test.ts > findTurnosPaginated > exposes include flags without throwing (default hides CANCELADO/RECHAZADO)` + `defaults: page 1 limit 20 asc` (statuses default PENDIENTE\|CONFIRMADO, gt(now)) + `appointmentService.test.ts > list ADMIN respects flags` | ✅ COMPLIANT |
| Query Filters RN-04 with Pagination | Pagination and sort | `turnos.test.ts > findTurnosPaginated > pagination math: page 2 limit 20 total 25 → offset 20 totalPages 2 + total 0 → totalPages 0 + accepts sort variants asc|desc|startAt:asc|startAt:desc` + `appointmentService.test.ts > getById/list R3+R5 > list delegates RN-04 defaults pagination + limit:101 propagates VALIDATION_ERROR` | ✅ COMPLIANT |
| Cancel Time Guard now < startDateTime (RN-05, INV-06) | Borders 08:59/09:00:00/09:00:01 | `appointmentService.test.ts > cancel R4 borders + ownership-first > border 08:59 allow + border 09:00:00 reject + border 09:00:01 reject` — UTC `getTime()` injected `now`, `INVALID_APPOINTMENT_STATE "El turno ya comenzó"` | ✅ COMPLIANT |
| Cancel Time Guard now < startDateTime (RN-05, INV-06) | Ownership before time guard | `appointmentService.test.ts > cancel R4 borders + ownership-first > non-owner → FORBIDDEN before time guard + owner and ADMIN allowed CONFIRMADO→CANCELADO future` — `assertOwnership` first, then `ensureFuture` | ✅ COMPLIANT |
| DTO Mapping INV-08 (snake → camelCase English) | No snake leak | `appointmentService.test.ts > getById/list R3+R5 > DTO camelCase no snake leak INV-08` (asserts `not.toHaveProperty("estado")` + has `startDateTime`/`endDateTime`/`status`) + `turnos.test.ts > passthrough returns TurnoDTO camelCase via toTurnoDTO` — 5 call sites `toTurnoDTO` in `turnos.ts` | ✅ COMPLIANT |
| Error Catalog §12 | Shapes | `appointmentService.test.ts > R6 shapes > codes correct` (400 VALIDATION_ERROR vs 409 INVALID_APPOINTMENT_STATE vs 404 APPOINTMENT_NOT_FOUND `{error:{code,message}}`) + `turnos.test.ts > maps 23P01 → AppointmentNotAvailableError` (409) + `STATUS_BY_CODE` 409/404 in `http/errors.ts` | ✅ COMPLIANT |
| Error Catalog §12 | Skeleton does not throw concurrency error | `appointmentService.test.ts > createAppointment R2 > skeleton does not throw APPOINTMENT_NOT_AVAILABLE` + `turnos.test.ts > no FOR UPDATE / REPEATABLE READ in executable code` (stripped `appointmentService.ts` and `turnos.ts` 0 hits, only `// TODO T-028` comment) | ✅ COMPLIANT |

**Compliance summary**: 11/11 scenarios compliant

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|-------------|--------|-------|
| State Transition Matrix via canTransition (RN-07, INV-02) | ✅ Implemented | `src/domain/appointmentStateMachine.ts` 79L pure: `z.enum(PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO)` frozen, `TRANSITIONS` RN-07 matrix, `canTransition(from,to,role,opts?)` role + `now.getTime()<start.getTime()` UTC guard, `isTerminal` RECHAZADO/CANCELADO. No `COMPLETADO` in executable — grep `COMPLETADO` 0 hits in domain/service/repo stripped; only negative tests. |
| Create Skeleton (validation only, defers atomicity) | ✅ Implemented | `src/services/appointmentService.ts` 244L `createAppointment`: `createInputSchema` zod, `findVehiculoById` + `assertOwnership` INV-03, `findServicioById` active check → `InvalidServiceError(INVALID_SERVICE)`, `calculateEndAndValidate` inclusive `fechaHoraFin<=finIntervaloOperativo` via `config.timezone=America/Argentina/Buenos_Aires` (INV-05/06), `TODO T-028` deferred atomics, `createTurno` with `TIMESTAMPTZ` UTC, no `FOR UPDATE`/`REPEATABLE READ` in stripped executable. |
| Query Filters RN-04 with Pagination | ✅ Implemented | `src/db/repositories/turnos.ts` `findTurnosPaginated` 62L: `statuses=[PENDIENTE,CONFIRMADO]` + `includeCancelled/Rejected` flags, `gt(fechaHoraInicio,now)` UTC, `limit 1..100 default 20` + `page>=1` + `offset=(page-1)*limit` + `totalPages=ceil(total/limit)`, `sort asc|desc|startAt:*` via drizzle `asc/desc`, `DbOrTx` param, `toTurnoDTO` per INV-08. Service `listAppointments` forces `customerId` for CLIENTE, injects `now` clock. |
| Cancel Time Guard now < startDateTime (RN-05, INV-06) | ✅ Implemented | `appointmentService.ts` `ensureFuture` + `canTransition(...,{now,startDateTime})` both via `getTime()` UTC; `cancelAppointment` ownership-first `assertOwnership` then `ensureFuture` then `canTransition`+`23P01` map; borders verified `08:59 allow` (`now<start`) and `09:00:00`/`09:00:01` reject (`INVALID_APPOINTMENT_STATE "El turno ya comenzó"`). `WorkshopConfig.timezone` DI only for `calculateEndAndValidate`. |
| DTO Mapping INV-08 (snake → camelCase English) | ✅ Implemented | `turnos.ts` all returns via `toTurnoDTO`: `cliente_id→customerId, vehiculo_id→vehicleId, servicio_id→serviceId, fecha_hora_inicio→startDateTime, fecha_hora_fin→endDateTime, estado→status`. Grep `toTurnoDTO` 5 call sites. Service never leaks snake; tests assert `not.toHaveProperty("estado")` for getById/list/confirm. |
| Error Catalog §12 | ✅ Implemented | `src/services/errors.ts` `InvalidAppointmentStateError` 409 `INVALID_APPOINTMENT_STATE`, `AppointmentNotAvailableError` 409 `APPOINTMENT_NOT_AVAILABLE` 23P01, `AppointmentNotFoundError` 404 `APPOINTMENT_NOT_FOUND`; `src/lib/http/errors.ts` `ERROR_CODES` + `STATUS_BY_CODE` 409/404. Skeleton never throws `APPOINTMENT_NOT_AVAILABLE` — 23P01 only mapped in `updateTurnoStatus`. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| State machine location `src/domain/appointmentStateMachine.ts` | ✅ Yes | Zero DB deps, single import for T-030..T-036, `isTerminal` + `allowedTransitions` exported, Zod frozen enum. |
| Status enum `z.enum` frozen + const union | ✅ Yes | `AppointmentStatusSchema = z.enum(AppointmentStatus)` rejects `COMPLETADO` at parse, tested via `rejects COMPLETADO via Zod`. |
| Clock injection `now: Date` param | ✅ Yes | `AppointmentServiceDeps{now?}` optional, `getNow(deps)` defaults `new Date()`; tests inject frozen `Date` for borders 08:59/09:00:00/09:00:01. No `Date.now()` direct call. |
| Repository pattern `DbOrTx` param | ✅ Yes | `updateTurnoStatus(db: DbOrTx,...)` and `findTurnosPaginated(db: DbOrTx, ...)` injectable, T-028 can pass `tx` without signature change. |
| Error mapping `23P01 → APPOINTMENT_NOT_AVAILABLE` in repo | ✅ Yes | `hasPgCode(error,"23P01")` in `turnos.ts` only, thin repo; service only sees domain errors via `AppointmentNotAvailableError`. Deferred `TODO T-028` marks atomic path. |
| DTO boundary `toTurnoDTO` reused | ✅ Yes | No new mapper; `turnos.ts` 5 call sites + service delegation preserves INV-08; no duplicate mapping risk. |
| No `SELECT FOR UPDATE` in T-027 diff | ✅ Yes | Stripped executable (comments removed `/\*[\s\S]*?\*/` + `//.*`) 0 hits for `FOR UPDATE`/`REPEATABLE READ` in `appointmentService.ts` and `turnos.ts`; only `// TODO T-028: wrap in REPEATABLE READ + SELECT FOR UPDATE` comment remains as spec requires. |
| Threat matrix N/A | ✅ Yes | No routing/shell/subprocess/VCS boundaries; verification preserves N/A. |

### Issues Found
**CRITICAL**: None
**WARNING**: None
**SUGGESTION**:
- `COMPLETADO` appears only in negative tests (`appointmentStateMachine.test.ts` `rejects COMPLETADO`, `turnos.test.ts` integrity negative insert) and pre-existing `t009` legacy — expected per grep guard.
- `FOR UPDATE`/`REPEATABLE READ` appear only in `// TODO T-028` comment and legacy `availability/overlap.ts` (`REPEATABLE READ` in doc comment) — T-027 executable is clean; T-028 will introduce atomics.
- `npx vitest run` full suite without DB shows integration failures when Postgres unavailable; unrelated to T-027 pure scope (3 pure suites 82 green without Docker).

### Verdict
PASS
All 17 tasks complete, 6/6 requirements and 11/11 scenarios compliant with passing covering tests; build green; grep guards clean; invariants INV-02/03/05/06/08 upheld; T-028 atomics correctly deferred.

