# Proposal: T-032 Implementar cancelación de turnos (matriz RN-07) PATCH /api/appointments/{id}/cancel

## Intent

Thin `PATCH /api/appointments/{id}/cancel` for `PENDIENTE|CONFIRMADO → CANCELADO` via owner-or-ADMIN. Service owns `canTransition` + `now < startDateTime` UTC (H-12 `08:59` allow, `09:00:00`/`09:00:01` reject), ownership-first to avoid timing oracle.

## Scope

### In Scope
- `route.ts`: `requireAuth` → `uuid` → `cancelAppointment({db,config},id,authUser)` → `200 TurnoDTO`
- Errors `401/403/400/404/409` via `toErrorBody` (`INVALID_APPOINTMENT_STATE` for time/terminal)
- `route.test.ts`: mocked auth/service, ownership (owner, ADMIN, non-owner 403), H-12 borders, no snake leak
- Reuse `WorkshopConfig` DI, `toTurnoDTO` (INV-08), UTC compare (INV-06)

### Out of Scope
- Query/capacity (`tstzrange &&`, `FOR UPDATE`, `EXCLUDE`, `capacityPerSlot` check), `confirm`/`reject` changes, `COMPLETADO`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: add PATCH cancel (owner-or-ADMIN, ownership-first, time guard, envelope)

## Approach

Approach 1 thin route → `cancelAppointment` — mirror `confirm`/`reject` without `assertRole`.

- Route: `requireAuth` only; service owns `assertOwnership` (owner CLIENTE or ADMIN) → `ensureFuture` → `canTransition(...,CANCELADO,role,{now,startDateTime})` → `updateTurnoStatus` (single owner §4.5).
- Order `requireAuth → uuid → service`: `401 before 400`, `403 before 409` avoids timing oracle.
- No `new Date()` in route; service `getNow(deps)` is canonical UTC.

Rejected: A2 route `assertOwnership` (duplicate read, drift); A3 helper (premature, `owner-or-ADMIN` ≠ boolean).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/cancel/route.ts` | New | Thin PATCH, error map, DI `Pick<WorkshopConfig,...>` |
| `src/app/api/appointments/[id]/cancel/route.test.ts` | New | Mocked ownership + border + error tests |
| `src/services/appointmentService.ts#cancelAppointment` | Reuse | No change — owns transition |
| `src/domain/appointmentStateMachine.ts` | Reuse | `canTransition` via service |
| `src/lib/auth/requireAuth.ts` | Reuse | `requireAuth` only |
| `src/lib/http/errors.ts` | Reuse | `toErrorBody`, `toValidationError` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `assertRole` copy-paste blocks owner | High | Omit `assertRole`; checklist asserts absent |
| Ownership vs time oracle | Med | Service order `assertOwnership→ensureFuture→canTransition`; no route guard |
| Clock drift (H-12) | Low | No `new Date()` in route; service `getNow` UTC |
| Snake leak | Low | Assert `customerId/startDateTime/status`, no `estado` |
| Capacity creep | Low | Reject `FOR UPDATE`/`tstzrange` in diff |

## Rollback Plan

Delete `src/app/api/appointments/[id]/cancel/`; no migration. Revert → `404`. Zero data impact.

## Dependencies

- T-027 `cancelAppointment` DONE; T-051 resource auth DONE; T-030/T-031 pattern archived 2026-08-28
- INV-02/03/06/08 locked; INV-01/04/05 untouched

## Success Criteria

- [ ] Owner CLIENTE or ADMIN + `PENDIENTE|CONFIRMADO` future → `200 TurnoDTO status:CANCELADO` camelCase
- [ ] Non-owner CLIENTE → `403` before time; unauth → `401` before `400`
- [ ] Terminal or `now>=start` → `409 INVALID_APPOINTMENT_STATE "El turno ya comenzó"`
- [ ] No `FOR UPDATE`/`EXCLUDE`/`assertRole` in diff; <400 lines
