# Apply Progress: T-026 Availability Critical Tests [EC-02]

**Change**: t026-availability-critical-tests
**Mode**: Standard (strict_tdd: false — no test runner TDD override)
**Delivery strategy**: auto-chain / single PR (no chaining needed, Low budget risk, 190-215 lines estimated)
**Status**: 12/12 tasks complete — Ready for verify
**Date**: 2026-08-28

## Completed Tasks

### Phase 1: Service Critical Suite — `getAvailableSlotsForDate` via mocked `fetchActiveTurnos`

- [x] 1.1 Scaffold `src/services/availability/__tests__/t026-availability-critical.test.ts` — vi.mock server-only, imports, makeConfig via parse({}), e() BA wall -03:00, MON/SAT/CFG
- [x] 1.2 Req1 Empty-Day (R1) — vi.fn([]) → 12 sorted 09:00..17:00, DST oracle getBaDayUtcRange → 03:00Z via Intl
- [x] 1.3 Req2 Single Occupancy (R2) — PENDIENTE/CONFIRMADO 09:00-10:00 blocks 09:00/09:30 not 10:00 half-open [)
- [x] 1.4 Req3 Count vs Capacity (R3) — it.each capacity 1/1 blocked, 2/1 available, 2/2 blocked; RECHAZADO/CANCELADO does not increment
- [x] 1.5 Req4 Duration Filtering (R4) — it.each 30→14,60→12,90→10,120→8; 11:30 never generated for 90 before overlap
- [x] 1.6 Req5 Outside Hours (R5) — SAT closed → [], 13:00-14:00 PENDIENTE gap no effect
- [x] 1.7 Req6 EC-02 Service (R6) — fully-booked 60+90 via candidates.map → [] no error, names contain EC-02
- [x] 1.8 Req7 Closing Boundary T-022b (R7) — 11:30+90 absent, 10:30+90==12:00 present; calculateEndAndValidate valid=false

### Phase 2: Route EC-02 Contract — `GET /api/availability`

- [x] 2.1 EC-02 fully booked 60/90 returns 200 [] without error — mock findActiveTurnosByDateRange with all candidates as PENDIENTE, assert 200 {date, availableSlots:[]} no error, distinct from 400/404
- [x] 2.2 EC-02 closed Saturday returns 200 [] without error — date=2026-09-12 → 200 [], error absent, findActiveTurnosMock called once via getBaDayUtcRange

### Phase 3: Verification & Gates

- [x] 3.1 Vitest run pure green without Postgres
- [x] 3.2 Traceability grep EC-02 ≥5 hits; no hardcoded capacityPerSlot/ timezone beyond makeConfig DI

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/services/availability/__tests__/t026-availability-critical.test.ts` | Created | 208 lines, 7 T-026 minima + EC-02 via getAvailableSlotsForDate wrapper with vi.fn fetch, DST oracle, table-driven it.each, pure server-only, no @/db |
| `src/app/api/availability/route.test.ts` | Modified | Added 2 EC-02 named it blocks in delegation & response describe (~35 lines): fully booked 60/90 and closed Saturday assert 200 [] no error |
| `openspec/changes/t026-availability-critical-tests/tasks.md` | Modified | Marked 12/12 tasks [x] |
| `openspec/changes/t026-availability-critical-tests/apply-progress.md` | Created | This progress artifact |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run src/services/availability/__tests__/t026-availability-critical.test.ts src/app/api/availability/route.test.ts` — Test Files 2 passed, Tests 43 passed (duration ~1.5s, transform 296ms) |
| Runtime harness command/scenario and exact result | N/A — pure unit tests, no runtime harness; verifies 200 {availableSlots:[]} contract without Postgres |
| Rollback boundary | Delete `src/services/availability/__tests__/t026-availability-critical.test.ts` + revert 2 `it("EC-02")` blocks in `route.test.ts` — `vitest run` returns to prior green |

## Invariants Verified

- INV-01 Capacity count-based `countOverlapping < capacityPerSlot` via isSlotAvailable DI, not boolean flag
- INV-05 Inclusive `fechaHoraFin <= finIntervaloOperativo` via calculateEndAndValidate (11:00+60==12:00 valid, 11:30+90 invalid)
- INV-06 TIMESTAMPTZ UTC via BA Intl `getBaDayUtcRange`/`baWallTimeToUtcDate`, no hardcoded offset beyond fixture BA wall -03:00, no naive TIMESTAMP
- INV-08 DTO naming N/A pure service — no DB snake_case leakage; route asserts no snake_case leakage already covered

## Deviations from Design

None — implementation matches design. Pure-test architecture via vi.fn fetch wrapper, table-driven it.each, generation→inclusive boundary→count<capacity→200 [] chain preserved.

## Issues Found

None. All 43 tests green without Postgres. Traceability grep EC-02 finds 6 hits (4 service + 2 route).

## Remaining Tasks

None — 12/12 complete.

## Workload / PR Boundary

- Mode: single PR
- Current work unit: T-026 service critical suite + route EC-02 contract (pure, no DB)
- Boundary: Creates t026-availability-critical.test.ts + modifies route.test.ts; no behavior mutation, no migration
- Estimated review budget impact: ~243 lines total (208 new + 35 route), under 400 budget, Low risk
- Chain strategy: pending (single PR, no chaining needed)

## Next Recommended

sdd-verify — independent verification of spec/design/tasks traceability, vitest gate, and EC-02 200 [] contract.

## Traceability Check

`Select-String EC-02` → 6 hits:
- src/services/availability/__tests__/t026-availability-critical.test.ts: describe EC-02, R6 EC-02 60min, R6 EC-02 90min, comment
- src/app/api/availability/route.test.ts: EC-02 fully booked 60/90, EC-02 closed Saturday

No hardcoded `America/Argentina/Buenos_Aires` in new file beyond DI; capacityPerSlot only via makeConfig DI.
