# Proposal: T-031 Implementar rechazo de turnos (matriz RN-07) PATCH /api/appointments/{id}/reject

## Intent

Thin `PATCH /api/appointments/{id}/reject` for `PENDIENTE→RECHAZADO` via `canTransition(ADMINISTRADOR)` (RN-07/INV-02). ADMIN-only, future appointments, no capacity logic. Mirror of T-030 confirm.

## Scope

### In Scope
- `PATCH /api/appointments/[id]/reject/route.ts`: `requireAuth → assertRole(ADMIN) → uuid → rejectAppointment → 200 TurnoDTO`
- Errors `401/403/400/404/409` via `toErrorBody` (`INVALID_APPOINTMENT_STATE`→409)
- `route.test.ts`: mocked auth/service, 401/403/400/404/409/200, no `estado` leak
- Reuse `WorkshopConfig` DI, `toTurnoDTO` (INV-08), UTC check (INV-06)

### Out of Scope
- `cancel`/query, capacity (`tstzrange`/`FOR UPDATE`/`EXCLUDE`), `COMPLETADO`, body payload

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: add PATCH reject requirement (role gate, state/time guard, envelope)

## Approach

Approach 1 copy-paste `confirm/route.ts` → `reject/route.ts` (exploration §Approaches).

- Route thin; `rejectAppointment` owns RN-07 + `now < startDateTime` (§4.5). No DB in route.
- Explicit `assertRole(ADMINISTRADOR)` → `CLIENTE` gets `403` not `409`; service stays defense-in-depth for state/terminal/`now>=start` → `409 "El turno ya comenzó"`.
- Order `requireAuth→assertRole→uuid→service`; no body; `server-only`.
- Rejected: A2 helper (premature for 2 routes; `cancel` diverges); A3 direct repo (duplicates matrix, breaks single-owner).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/reject/route.ts` | New | Thin PATCH, error map, DI `Pick<WorkshopConfig,…>` |
| `src/app/api/appointments/[id]/reject/route.test.ts` | New | Mocked tests |
| `src/services/appointmentService.ts#rejectAppointment` | Reuse | No change |
| `src/domain/appointmentStateMachine.ts` | Reuse | `canTransition` via service |
| `src/lib/auth/requireAuth.ts` | Reuse | `requireAuth`, `assertRole` |
| `src/lib/http/errors.ts` | Reuse | `toErrorBody` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 403 vs 409 conflation | Med | `assertRole`→403; service→409 only |
| Auth order leak | Low | 401 before 400; test it |
| Timezone misuse | Low | No `new Date()` in route; `deps.now` UTC |
| Snake leak | Low | Assert no `estado`/`fecha_hora_inicio` |
| Copy-paste drift | Low | `// Mirror of confirm — keep in sync` |

## Rollback Plan

Delete `src/app/api/appointments/[id]/reject/`; no migration. Revert commit → 404. Zero data impact.

## Dependencies

- T-027 `rejectAppointment` DONE; T-035 `assertRole` DONE (FASE 2.5)
- T-030 pattern archived 2026-08-28
- INV-02/03/06/08 locked; INV-01/04/05 untouched

## Success Criteria

- [ ] `ADMIN` + `PENDIENTE` future → `200 TurnoDTO status:RECHAZADO` camelCase
- [ ] `CLIENTE`→403, unauth→401 before 400, bad UUID→400, missing→404, wrong state/`now>=start`→409
- [ ] No `FOR UPDATE`/`EXCLUDE` in diff; <400 lines total
