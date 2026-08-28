# Proposal: T-026 Crear tests críticos de disponibilidad [EC-02]

## Intent

Close EC-02 traceability gap: no named coverage proving `200 {availableSlots: []}` means "no hay disponibilidad". Consolidate 7 T-026 minima into one pure suite without re-proving T-021..T-025 invariants.

## Scope

### In Scope
- New `t026-availability-critical.test.ts` — 7 minima via `getAvailableSlotsForDate` + mocked `fetchActiveTurnos` (no DB): empty, single overlap, count vs capacity, duration 30/60/90/120 + closure, fuera de apertura/closed, EC-02 full 60+90, `11:30+90` T-022b
- 1-2 EC-02 route assertions in `route.test.ts` — `200 []` no `error` key
- DI `workshopConfigSchema.parse({})`, BA fixtures `new Date('...-03:00')`, `server-only` mock

### Out of Scope
- Concurrency `REPEATABLE READ`/`FOR UPDATE`/`EXCLUDE` (T-029/T-060)
- DB `findActiveTurnosByDateRange` SQL (T-009/T-028)
- Booking `POST /api/appointments` + transitions (T-027..T-034)
- Observability (T-056b), catalog (T-016b), auth (T-050), UI (T-042)

## Capabilities

> Contract for sdd-spec. Coverage only, no behavior change.

### New Capabilities
- None

### Modified Capabilities
- None — `GET /api/availability` `200 []` already specified

## Approach

Exploration **Approach 1** — dedicated pure file + minimal route assertions.

- Pure wrapper `vi.fn()` fetch; range via `getBaDayUtcRange` oracle (`Intl` DST). Table-driven; references bounds, does not re-prove.
- Proves chain: generation → `<= finIntervalo` → `count < capacity` → `200 []`. Isolate generation before overlap.
- EC-02 names contain `EC-02`; ~185 lines (<400 budget), single PR, no DB/deps.

Alternatives: (2) expand existing files — bloats 395-line files; (3) DB integration — needs Postgres, covered by T-009/T-028. Both rejected.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/services/availability/__tests__/t026-availability-critical.test.ts` | New | 7 minima + EC-02 |
| `src/app/api/availability/route.test.ts` | Modified | EC-02 `200 []` |
| `availabilityService.ts` / `slotGenerator.ts` / `overlap.ts` | Read-only | Subjects under test |
| `vitest.config.ts` | None | No change |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `<=` vs `<` slip (12→10) | Med | Table `11:00+60` ok vs `11:30+60` fail |
| Count vs boolean (capacity 2) | Med | Table 1/blocked, 2+1/ok, 2+2/blocked |
| Duration vs occupancy | Low | Generation before overlap |
| Mock vs `ACTIVE_STATUSES` | Low | RECHAZADO not-blocking case |
| Hardcoded `-03:00` DST | Low | Oracle `getBaDayUtcRange` |

## Rollback Plan

Delete new test file + revert route additions. No migration; `vitest run` returns to prior green.

## Dependencies

- T-024 Availability Service — DONE
- T-025 Availability API — DONE
- T-019b WorkshopConfig, T-022b closure — DONE

## Success Criteria

- [ ] New file pure, mocked fetch, no DB/`@/db`, no hardcoded config
- [ ] 7 minima pass; EC-02 `[]` without `error` at service + route
- [ ] `vitest run` green without Postgres
- [ ] <200 lines (<400 budget), `sdd-verify` traces EC-02
