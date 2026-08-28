# Tasks: T-027 Appointment Service (FASE 6)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 570 (domain 80 + repo 40 + service 200 + tests 250) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Domain → PR2 Repo/Errors → PR3 Service (feature-branch-chain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Domain `canTransition`/`isTerminal` + tests (R1) | PR1 | `npm run test -- src/domain/appointmentStateMachine.test.ts` | N/A — pure unit | Delete `src/domain/appointmentStateMachine.ts` |
| 2 | Repo `updateTurnoStatus`/`findTurnosPaginated` + errors (R6,R3) | PR2 | `npm run test -- src/db/repositories/turnos.test.ts` | N/A — mocked DbOrTx | Revert `turnos.ts`, `errors.ts`, `http/errors.ts` |
| 3 | Service `AppointmentService` + verification (R2,R3,R4,R5) | PR3 | `npm run test -- src/services/appointmentService.test.ts && npx tsc --noEmit` | `grep -R "FOR UPDATE" src/` clean | Delete `appointmentService.ts`, revert repo |

## Phase 1: Domain Pure (R1 — RN-07/INV-02)

- [x] 1.1 Create `src/domain/appointmentStateMachine.ts` with `z.enum(['PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'])`, `canTransition(from,to,role,opts?)`, `isTerminal` — no COMPLETADO
- [x] 1.2 Write `src/domain/__tests__/appointmentStateMachine.test.ts` table-driven `test.each`: 4 valid + 12 invalid/role/terminal + COMPLETADO Zod rejection
- [x] 1.3 Run `npx tsc --noEmit` + domain tests green

## Phase 2: Repo + Error Catalog (R6, R3-foundation)

- [x] 2.1 Extend `src/services/errors.ts` with `InvalidAppointmentStateError` + `AppointmentNotAvailableError` (DomainError, `code` 409/23P01) + `AppointmentNotFoundError` 404
- [x] 2.2 Extend `src/lib/http/errors.ts` with `INVALID_APPOINTMENT_STATE`, `APPOINTMENT_NOT_AVAILABLE`, `APPOINTMENT_NOT_FOUND` + `STATUS_BY_CODE` 409/404
- [x] 2.3 Add `updateTurnoStatus(db: DbOrTx, id, status)` to `src/db/repositories/turnos.ts` — single `update…returning`, `hasPgCode(23P01)` map
- [x] 2.4 Add `findTurnosPaginated(db: DbOrTx, query)` — RN-04 defaults `PENDIENTE|CONFIRMADO` + `start > now` UTC, flags `includeCancelled/Rejected`, `limit<=100` default 20, `page/offset`, `sort asc|desc`, via `toTurnoDTO`
- [x] 2.5 Test repo with mocked `DbOrTx`: passthrough, `23P01` map, pagination boundaries `limit:101 → VALIDATION_ERROR`

## Phase 3: Service Thin (R2,R3,R4,R5)

- [x] 3.1 Create `src/services/appointmentService.ts` with `AppointmentServiceDeps{db,config,now?}`; `createAppointment` validates schema, `servicio.active`, ownership, `calculateEndAndValidate` + `fechaHoraFin<=finIntervaloOperativo` inclusive, UTC via `config.timezone`, `TODO T-028`
- [x] 3.2 Implement `confirmAppointment`/`rejectAppointment`: load, `canTransition(PENDIENTE→CONFIRMADO|RECHAZADO,ADMIN)`, `now<start` UTC `getTime()`, `updateTurnoStatus` → `TurnoDTO`
- [x] 3.3 Implement `cancelAppointment`: `canTransition(PEND→CANCEL,CONF→CANCEL,owner/ADMIN)`, ownership check first, `now<start` borders `08:59 allow / 09:00:00 reject`, `INVALID_APPOINTMENT_STATE "El turno ya comenzó"`
- [x] 3.4 Implement `getAppointmentById`/`listAppointments`: ownership (CLIENTE own, ADMIN all), `APPOINTMENT_NOT_FOUND` 404, delegates to `findTurnosPaginated`, camelCase `TurnoDTO` no snake leak
- [x] 3.5 Write `src/services/__tests__/appointmentService.test.ts` with `vi.mock` repo + `vi.useFakeTimers()`: R1 role, R2 inactive/foreign/close-crossing, R3 flags+pagination, R4 borders, R5 leak, R6 shapes; no `APPOINTMENT_NOT_AVAILABLE` in skeleton

## Phase 4: Verification

- [x] 4.1 `npx tsc --noEmit` zero errors
- [x] 4.2 `vitest` pure suites green: domain + service
- [x] 4.3 Grep guards: `COMPLETADO` absent except negative test; `FOR UPDATE|REPEATABLE READ` empty in T-027 diff; `toTurnoDTO` present (INV-08)
- [x] 4.4 Verify mapping R1→1.1/1.2/3.2, R2→3.1, R3→2.4/3.4, R4→3.3, R5→3.4, R6→2.1/2.2/3.5
