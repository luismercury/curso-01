# Proposal: T-030 Implementar confirmación de turnos (matriz RN-07) PATCH /api/appointments/{id}/confirm

## Intent

Thin `PATCH /api/appointments/{id}/confirm` for `PENDIENTE→CONFIRMADO` via `canTransition` + `ADMINISTRADOR` only. Delegates to existing `confirmAppointment`; no capacity logic.

## Scope

### In Scope
- `PATCH /api/appointments/[id]/confirm/route.ts`: `requireAuth → assertRole(ADMINISTRADOR) → uuid → confirmAppointment → 200 TurnoDTO`
- Errors: `401/400/403/404/409` via `toErrorBody` (`INVALID_APPOINTMENT_STATE` → 409)
- `route.test.ts`: mocked auth/service, 401/403/400/404/409/200, no `estado` leak
- Reuse `WorkshopConfig` DI, `toTurnoDTO` (INV-08), UTC (INV-06)

### Out of Scope
- `reject`/`cancel`/query, capacity (`tstzrange`, `FOR UPDATE`, `EXCLUDE`), `COMPLETADO`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: add PATCH confirm requirement (role gate, state guard, envelope)

## Approach

Approach 2 explicit `assertRole` before service (exploration #308).

- Route thin; service owns RN-07 matrix + `now < startDateTime` (Technical-spec §4.5).
- `CLIENTE` → `403`; wrong state/`now>=start`/terminal → `409` via service.
- Order `requireAuth→assertRole→uuid→service`; no body; `server-only`.

Rejected: A1 service-only 403/409 conflation; A3 direct repo duplicates matrix.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/confirm/route.ts` | New | Thin PATCH, maps errors |
| `src/app/api/appointments/[id]/confirm/route.test.ts` | New | Mocked tests |
| `src/services/appointmentService.ts` | Reuse | `confirmAppointment` unchanged |
| `src/domain/appointmentStateMachine.ts` | Reuse | `canTransition` via service |
| `src/lib/auth/requireAuth.ts` | Reuse | `requireAuth`, `assertRole` |
| `src/lib/http/errors.ts` | Reuse | `toErrorBody` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 403 vs 409 conflation | Med | `assertRole`→403, service→409 |
| Auth order leak | Low | 401 before 400; test it |
| Timezone misuse | Low | No `new Date()` in route; `deps.now` UTC |
| Snake leak | Low | Assert no `estado`/`fecha_hora_inicio` |
| Capacity creep | Low | Reject `FOR UPDATE` in review |

## Rollback Plan

Delete `src/app/api/appointments/[id]/confirm/`; no migration. Revert commit → 404.

## Dependencies

- T-027 `confirmAppointment` DONE; T-035 `assertRole` DONE (FASE 2.5 blocking)
- INV-02/03/06/08 locked

## Success Criteria

- [ ] `ADMIN` + `PENDIENTE` future → `200` camelCase DTO
- [ ] `CLIENTE`→403, unauth→401, bad UUID→400, missing→404, wrong state/`now>=start`→409
- [ ] No capacity logic, no snake leak, <400 lines
