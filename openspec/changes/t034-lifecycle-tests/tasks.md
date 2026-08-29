# Tasks: t034-lifecycle-tests — Exhaustive RN-07 Lifecycle Coverage

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (80+70+50+60+60+10) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR: t034-lifecycle-tests -> main |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Matrix + service lifecycle, H-12/H-13, visibility (test-only) | PR 1 -> main | `pnpm vitest run src/domain/__tests__/t034.lifecycle.matrix.test.ts src/services/__tests__/appointmentLifecycle.test.ts` | N/A — mocked deps, deps.now UTC, no DB | Delete 2 new test files |

## Phase 1: Domain Matrix — Pure Unit

- [x] 1.1 T-034-001 Create `src/domain/__tests__/t034.lifecycle.matrix.test.ts` — `it.each` 32 cells (4 from x 4 to x 2 roles) `canTransition(from,to,role)` without opts; time-guard rows `PENDIENTE|CONFIRMADO->CANCELADO` with `start=12:00Z` (09:00 BA) vs `now=11:59Z/12:00Z/12:00:01Z` strict `<`; plus `isTerminal` and `COMPLETADO` rejection. Spec: 32-cell, Time guard, Terminals. Deps: none. Est: ~80 LOC.

## Phase 2: Service Chains — Mocked AppointmentService

- [x] 2.1 T-034-002 Create `src/services/__tests__/appointmentLifecycle.test.ts` harness `vi.mock` turnos/vehiculos/servicios, `deps:{db:mock,config,now}` — 4 valid chains: `PENDIENTE->CONFIRMADO ADMIN` (confirm), `PENDIENTE->RECHAZADO ADMIN` (reject), `PENDIENTE->CANCELADO owner CLIENTE` (cancel `now<start`), `CONFIRMADO->CANCELADO` owner and ADMIN. Assert `updateTurnoStatus` called. Spec: Lifecycle Chains. Deps: T-034-001. Est: ~70 LOC.
- [x] 2.2 T-034-003 Same file — 4 invalids `409 INVALID_APPOINTMENT_STATE` (`CONFIRMADO->CONFIRMADO`, `RECHAZADO->CONFIRMADO`, `CANCELADO->CONFIRMADO`, `PENDIENTE->PENDIENTE`) plus terminal `RECHAZADO|CANCELADO->CANCELADO` 409; assert `Cannot transition` and no `updateTurnoStatus`. Add EC-03 `CONFIRMADO` past (`now>=start`) `409 "El turno ya comenzó"` and role/ownership checks. Spec: Invalid 409, Terminal cancel, EC-03. Deps: T-034-002. Est: ~50 LOC.

## Phase 3: H-12 Borders, H-13 Guards, Visibility

- [x] 3.1 T-034-004 Same file — H-12 trios `start=12:00Z` with `deps.now` `11:59Z allow / 12:00Z reject / 12:00:01Z reject` for cancel (`PENDIENTE|CONFIRMADO->CANCELADO` owner) and confirm/reject (`PENDIENTE->CONFIRMADO/RECHAZADO ADMIN`) via `ensureFuture` strict `getTime()<`. Explicit `Z` dates, `beforeEach vi.clearAllMocks()`. Spec: H-12 Cancel/Confirm borders, EC-03. Deps: T-034-003. Est: ~60 LOC.
- [x] 3.2 T-034-005 Same file — H-13 before lock: `createAppointment` inactive `servicio.active=false` -> `400 INVALID_SERVICE` and foreign `vehiculo.customerId!=authUser.id` -> `403 FORBIDDEN`; both assert `countActiveOverlappingForUpdate` not called. H-11/EC-04: `listAppointments` mocked `findTurnosPaginated` — default hides `CANCELADO|RECHAZADO` (`includeCancelled:false, includeRejected:false`), flags opt-in, `RECHAZADO` non-active. Assert `customerId` injection for CLIENTE. Spec: H-13 x2, H-11/EC-04 x3. Deps: T-034-004. Est: ~60 LOC.

## Phase 4: Cleanup and Verification

- [x] 4.1 T-034-006 Verify no `COMPLETADO` leak, no prod changes, `pnpm vitest run` green without DB, `pnpm tsc --noEmit` passes. Rollback: delete 2 test files. Spec: all 6 ADDED. Deps: T-034-005. Est: ~10 LOC.
