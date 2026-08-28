# Proposal: T-028 Creación atómica bloqueante H-13 + T-029 concurrencia

## Intent

Promote `createAppointment` skeleton to blocking atomic TX: `REPEATABLE READ` + `SELECT FOR UPDATE` + `count < capacityPerSlot` on `tstzrange &&` + `EXCLUDE USING gist` safety net. Enforces H-13 order and prevents double-booking the same slot (INV-04/INV-01).

## Scope

### In Scope
- `appointmentService.ts`: extend `config` with `capacityPerSlot`, TX `ownership->service.active->duration->FOR UPDATE count->INSERT PENDIENTE`, `23P01->APPOINTMENT_NOT_AVAILABLE`.
- `turnos.ts`: `countActiveOverlappingForUpdate(tx,range)` with `tstzrange && AND estado IN ('PENDIENTE','CONFIRMADO') FOR UPDATE` + `23P01` on insert.
- `POST /api/appointments` thin route + mapper (409/403/400).
- Tests: mocked TX units + `tests/integration/appointmentConcurrency.test.ts` 2-worker gate.

### Out of Scope
- `confirm/reject/cancel` routes (T-030..), observability (FASE 9), DB-backed WorkshopConfig (T-036b), `COMPLETADO`.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: add atomic creation — TX boundary, `SELECT FOR UPDATE` count, `23P01` handling, 2-worker guarantee.

## Approach

Hybrid Approach 1 (spec §10): single `db.transaction` in `createAppointment`. Prefer `isolationLevel:'repeatable read'`, fallback `SET TRANSACTION`. DI `capacityPerSlot/slotStepMinutes/timezone` via `calculateEndAndValidate` (INV-05 inclusive `<=`). `count < capacity` generalizes to `>1`; `EXCLUDE WHERE estado IN (…)` defends `capacity=1`. Outer `hasPgCode('23P01')` -> same 409.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/services/appointmentService.ts` | Modified | Atomic TX, config extension |
| `src/db/repositories/turnos.ts` | Modified | FOR UPDATE helper + 23P01 map |
| `src/app/api/appointments/route.ts` | New | Thin HTTP adapter |
| `src/lib/errors.ts` / `src/services/errors.ts` | Modified | Reuse `PG_CODES.23P01` |
| `tests/integration/appointmentConcurrency.test.ts` | New | 2-worker PG test |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reusing non-locking helper in TX | Med | Dedicated FOR UPDATE helper |
| Hardcoded `cnt>=1` | Med | DI `capacity>=1`; test `capacity=2` |
| Lock before ownership (H-13 leak) | Med | Ownership before FOR UPDATE |
| Drizzle `isolationLevel` drift | Low | Fallback `SET TRANSACTION` + file test |
| `400` vs `409` confusion | Low | `>finIntervalo` =400, overlap=409 |
| TZ drift | Low | `endDateTime` inside TX from same config |

## Rollback Plan

Revert `appointmentService.ts` to `TODO T-028` skeleton, remove helper, delete `route.ts`. Keep `0004 EXCLUDE` migration. No downstream consumer yet.

## Dependencies

- DONE: `T-027`, `T-051` auth, `T-019b` WorkshopConfig (`1`/`30`/`America/Argentina/Buenos_Aires`), `0004 EXCLUDE`.
- Blocks: `T-030..T-034`, `T-060` E2E.
- Invariants: INV-04, INV-01, INV-05, INV-06.

## Success Criteria

- [ ] TX `REPEATABLE READ` + `FOR UPDATE` + `count < capacity`; `23P01->409`.
- [ ] H-13 order; `11:30+90>12:00` rejects as `400`.
- [ ] 2-worker same slot `capacity=1`: 1 PENDIENTE + 1 `APPOINTMENT_NOT_AVAILABLE`; adjacent `10-11` vs `11-12` no collision.
- [ ] Route maps `{error:{code,message}}` correctly; <400 authored lines.
