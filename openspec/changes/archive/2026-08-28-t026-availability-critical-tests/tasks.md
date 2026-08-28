# Tasks: T-026 Availability Critical Tests [EC-02]

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 190-215 (new ~190 + route ~20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | T-026 service critical suite + route EC-02 contract (pure, no DB) | PR 1 (single) | `pnpm exec vitest run src/services/availability/__tests__/t026-availability-critical.test.ts src/app/api/availability/route.test.ts` | N/A — pure unit tests, no runtime harness; verifies `200 {availableSlots:[]}` contract without Postgres | Delete `t026-availability-critical.test.ts` + revert 2 `it("EC-02")` blocks in `route.test.ts` — `vitest run` returns to prior green |

## Phase 1: Service Critical Suite — `getAvailableSlotsForDate` via mocked `fetchActiveTurnos`

- [x] 1.1 Scaffold `src/services/availability/__tests__/t026-availability-critical.test.ts`: `vi.mock("server-only",()=>({}))`, imports `workshopConfigSchema`/`getAvailableSlotsForDate`/`getBaDayUtcRange`/`generateSlotsForDate`/`formatSlotsAsHHmm`, helpers `makeConfig(o)` via `parse({})` and `e(s,en,st)` BA wall `-03:00`, const `MON/SAT/CFG`
- [x] 1.2 Req1 Empty-Day (R1): `vi.fn(async()=>[])` → `getAvailableSlotsForDate({date:MON,durationMinutes:60})` returns 12 sorted `09:00..17:00`; assert DST oracle `getBaDayUtcRange("2026-09-07",CFG.timezone)` → `03:00Z` via `Intl`
- [x] 1.3 Req2 Single Occupancy (R2): `PENDIENTE` and `CONFIRMADO` `09:00-10:00` each block `09:00,09:30` not `10:00` (half-open `[)` via `getTime()`)
- [x] 1.4 Req3 Count vs Capacity (R3): `it.each` `capacity 1/1→blocked`, `2/1→available`, `2/2→blocked` with two `09:00-10:00` fixtures; `RECHAZADO/CANCELADO` does not increment (`count < capacity` DI)
- [x] 1.5 Req4 Duration Filtering (R4): `it.each` `30→14` (incl `11:30,17:30`), `60→12` (incl `11:00==12:00` valid), `90→10`, `120→8`; `11:30` never generated for `90` before overlap
- [x] 1.6 Req5 Outside Hours (R5): `SAT 2026-09-12` closed → `[]`; `13:00-14:00 PENDIENTE` gap does not affect morning slots
- [x] 1.7 Req6 EC-02 Service (R6): fully-booked `60`+`90` via `candidates.map(c=>({start:c.start,end:c.end,status:"PENDIENTE"}))` → `[]` no `error`, names contain `EC-02`
- [x] 1.8 Req7 Closing Boundary T-022b (R7): `90min` `11:30` absent, `10:30+90==12:00` present; `calculateEndAndValidate({start:BA 11:30,duration:90})` → `valid=false`

## Phase 2: Route EC-02 Contract — `GET /api/availability`

- [x] 2.1 Add `it("EC-02 fully booked 60/90 returns 200 [] without error")` to `src/app/api/availability/route.test.ts` delegation describe: mock `findActiveTurnosByDateRange` with all `60`/`90` candidates as `PENDIENTE`, assert `200 {date, availableSlots:[]}` no `error`, distinct from `400/404`
- [x] 2.2 Add `it("EC-02 closed Saturday returns 200 [] without error")` same describe: `date=2026-09-12` → `200 []`, `error` absent, `findActiveTurnosMock` called once via `getBaDayUtcRange`

## Phase 3: Verification & Gates

- [x] 3.1 Run `pnpm exec vitest run src/services/availability/__tests__/t026-availability-critical.test.ts src/app/api/availability/route.test.ts` — green without Postgres (no `@/db` in new file)
- [x] 3.2 Verify traceability: `grep -r "EC-02"` finds ≥5 hits; no hardcoded `capacityPerSlot=1`/`"America/Argentina/Buenos_Aires"` beyond `makeConfig` DI
