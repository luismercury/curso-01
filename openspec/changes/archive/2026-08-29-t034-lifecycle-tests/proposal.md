# Proposal: t034-lifecycle-tests — Exhaustive RN-07 Lifecycle Coverage (EC-03/EC-04, H-12/H-13)

## Intent

Close FASE 6 test-only gap after T-033 (74795b9). Existing tests cover 6 valid RN-07 edges and one H-12 border, missing exhaustive 32-cell matrix, 4 invalid 409s, `CONFIRMADO->CANCELADO` past EC-03, H-12 trio for cancel+confirm, H-13 `400/403` before lock, and H-11/EC-04 `RECHAZADO` visibility. No DB, no prod code.

## Scope

### In Scope
- `canTransition` 4×4×2 matrix (32 combos) + time-guard variants (pure unit)
- Service chains via mocked repos: `PENDIENTE->CONFIRMADO`/`RECHAZADO`/`CANCELADO`, `CONFIRMADO->CANCELADO`
- 4 invalids → `409 INVALID_APPOINTMENT_STATE`: `CONFIRMADO->CONFIRMADO`, `RECHAZADO->CONFIRMADO`, `CANCELADO->CONFIRMADO`, `PENDIENTE->PENDIENTE`
- H-12/EC-03 trio strict `<` UTC: `08:59 allow`, `09:00:00 reject`, `09:00:01 reject` for cancel+confirm (BA `09:00-03:00=12:00Z`)
- H-13 before lock: `activo=false→400`, foreign `vehiculo→403` (count not called)
- H-11/EC-04 `listAppointments` mocked: default hides `CANCELADO`/`RECHAZADO`, flags opt-in

### Out of Scope
- Slots, `durationMinutes`/`finIntervaloOperativo`, capacity `EXCLUDE`/`FOR UPDATE` count, 2-worker concurrency (T-028/T-029/T-060)
- UI, new routes, schema/migrations

## Capabilities

### New Capabilities
- None — test-only.

### Modified Capabilities
- `appointment`: Add lifecycle scenarios (RN-07 matrix, H-12 BA, H-13, EC-03/EC-04) — no endpoint change.

## Approach

| Approach | Verdict | Why |
|----------|---------|-----|
| **A. Pure unit + service mocked** — matrix + `AppointmentService` via `vi.mock`, `deps:{db:mock, config, now}` | **Selected** | No DB, <350 LOC, deterministic, fits budget |
| B. Thin-DB `db.select` chain | Rejected | Duplicates `turnos.query`, brittle |
| C. Live Postgres E2E | Rejected | Needs Docker, `ECONNREFUSED`, overkill |

Dates: `start=12:00Z` (09:00 BA), `now=11:59Z/12:00Z/12:00:01Z`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/services/__tests__/appointmentLifecycle.test.ts` | New | Chains, invalid 409s, H-12/EC-03, H-13, visibility (~250 LOC) |
| `src/domain/__tests__/appointmentLifecycle.matrix.test.ts` | New | Matrix (~80 LOC) |
| `src/domain/appointmentStateMachine.ts`, `src/services/appointmentService.ts` | Read-only | Via mocks only |
| `openspec/specs/appointment/spec.md` | Modified | Delta only |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| H-12 off-by-one | High | Strict `getTime() <`; assert `08:59→200`/`09:00:00→409` |
| Missing cell masked | Med | `it.each` 32 combos at domain |
| H-13 mock leak | Med | `clearAllMocks`; assert count not called |
| BA naive Date | Med | Always `Z`/`-03:00` |

## Rollback Plan

Delete new `*.test.ts` + revert delta. No prod/migration.

## Dependencies

- `T-028..T-033` done `74795b9`; `WorkshopConfig BA/1/30`; `T-027` owner, `T-028+T-029` atomic; `vitest` + `deps.now`; no infra. Blocks FASE 7.

## Success Criteria

- [ ] 32 cells + 3 time-guards + `isTerminal` covered
- [ ] 4 invalids → `409` at service
- [ ] H-12 trio cancel+confirm UTC, H-13 `400`/`403` before lock
- [ ] EC-03 past 409, EC-04 visibility via flags
- [ ] `vitest` green without DB; no capacity duplication
