# Proposal: T-027 Implementar Appointment Service (FASE 6)

## Intent

Single owner for turno lifecycle before atomic booking/routes. Pure `canTransition(from,to,role)` per RN-07 (`PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO`, no `COMPLETADO`) + `AppointmentService` (create/query/confirm/reject/cancel). Enforces INV-02/03/05/06/08; prevents matrix duplication.

## Scope

### In Scope
- `src/domain/appointmentStateMachine.ts` — pure `AppointmentStatus`, `canTransition`, `isTerminal` (RN-07, zero DB deps).
- `src/services/appointmentService.ts` — thin: `createAppointment` skeleton (`servicio.active`/ownership/duration, defers `SELECT FOR UPDATE` to T-028), `getById`/`list` (RN-04 + `paginate`), `confirm`/`reject`/`cancel` (`canTransition` + `now < start` UTC + role/ownership).
- `src/db/repositories/turnos.ts` — `updateTurnoStatus`, `findTurnos` (paginated, filters, `DbOrTx`).
- Errors — `AppointmentNotAvailableError`/`InvalidAppointmentStateError` + `APPOINTMENT_NOT_AVAILABLE`/`INVALID_APPOINTMENT_STATE` + `23P01` map in `src/services/errors.ts` + `src/lib/http/errors.ts`.

### Out of Scope
- `REPEATABLE READ`/`SELECT FOR UPDATE`/`EXCLUDE` — T-028/T-029.
- Routes `POST/PATCH/GET /api/appointments` — T-028..T-033.
- `EXCLUDE` DDL, DB-backed `WorkshopConfig` (T-036b), UI.

## Capabilities

### New Capabilities
- `appointment`: lifecycle + state machine + validations + DTO + errors. → `openspec/specs/appointment/spec.md`.

### Modified Capabilities
- None.

## Approach

Approach 2: pure domain + thin service. Machine is RN-07 source for T-030..T-036; table-tested to 80%. Service validates then delegates via `toTurnoDTO` (INV-08); time via UTC `getTime()` + injected `now` (INV-06). `create` pre-checks only, marked `TODO T-028`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/appointmentStateMachine.ts` | New | RN-07 matrix |
| `src/services/appointmentService.ts` | New | Thin service |
| `src/db/repositories/turnos.ts` | Modified | `updateTurnoStatus`, `findTurnos` |
| `src/services/errors.ts` | Modified | 2 errors |
| `src/lib/http/errors.ts` | Modified | codes + status map |
| `src/services/appointmentGuard.ts` | Removed | Superseded |
| `src/db/mappers/turno.ts` | Reused | No change |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate `canTransition` | Med | Single import; review bans inline checks |
| `COMPLETADO` added | Low | Frozen `z.enum`; test rejects it |
| `snake_case` leak | Low | `toTurnoDTO` only |
| `FOR UPDATE` in T-027 | Med | Review bans those strings |
| `now < start` TZ bug | Med | UTC `getTime()` + injected `now` |
| Role/ownership mix | Med | `canTransition(role)` + `assertOwnership` |

## Rollback Plan

Revert 2 new files + repo/error patches. No migration. No routes yet — no consumer break. Partial: delete domain/service files, revert `turnos.ts`/`errors.ts`, keep guard fallback.

## Dependencies

- DONE: `T-024` AvailabilityService, `T-050/051/035` Auth, `T-009` schema (`EXCLUDE`, `TIMESTAMPTZ`).
- Blocks: `T-028/T-029` (TX) and `T-030..T-034` (routes/tests).

## Success Criteria

- [ ] `canTransition` table tests: 6 valid + invalid + role, no `COMPLETADO`.
- [ ] Service validates `canTransition` + `now < start` (injected clock) + ownership/role, returns `TurnoDTO`.
- [ ] Repo `DbOrTx` single-statement; `23P01 -> APPOINTMENT_NOT_AVAILABLE`.
- [ ] `createAppointment` validates `servicio.active` + `fechaHoraFin <= finIntervaloOperativo` without atomic logic (`TODO T-028`).
- [ ] <400 lines; no `FOR UPDATE`/`REPEATABLE READ` in diff.
