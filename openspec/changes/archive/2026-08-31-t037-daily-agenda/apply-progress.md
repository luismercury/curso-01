# Apply Progress — t037-daily-agenda

## Status: done — ready for commit

## Phase 1: Pre-flight Verification — DONE

- [x] 1.1 Read `src/lib/http/appointmentQuery.ts` — `querySchema` validates `date` via `yyyymmddRegex` + `isValidCalendarDate`, `date↔from/to` superRefine → 400, `status CANCELADO without includeCancelled` → 400, `status RECHAZADO without includeRejected` → 400, `limit 1..100 default 20`, `sort` enum `asc|desc|startAt:asc|startAt:desc` default `asc`
- [x] 1.2 Read `src/db/repositories/turnos.ts` `findTurnosPaginated` — shared `whereClause` via `getBaDayUtcRange` half-open `gte(from)/lt(to)` + `gt(now)` conjunctive; `page` wins `offset`; `toTurnoDTO` on map
- [x] 1.3 Read `src/services/availability/availabilityService.ts` `getBaDayUtcRange` — DST oracle via `baWallTimeToUtcDate` + `nextBaYmd` for BA
- [x] 1.4 Read `src/config/workshopConfig.ts` — `timezone = "America/Argentina/Buenos_Aires"` (INV-06)

## Phase 2: Named Agenda Trace Tests — DONE

- [x] 2.1 Trace 1 — admin agenda `?date=YYYY-MM-DD` 200 ordered startAt:asc pagination (H-27+H-28) — added to `src/app/api/admin/appointments/route.test.ts`
- [x] 2.2 Trace 2 — client agenda `?date=YYYY-MM-DD` 200 scoped customerId own — added to `src/app/api/appointments/route.test.ts`
- [x] 2.3 Trace 3 — `?date` includeCancelled/includeRejected default false / each flag / both — H-11 (added to both admin and client files)
- [x] 2.4 Trace 4 — admin `?date=&limit=101` precedence 401→403→400 — added to admin file
- [x] 2.5 Trace 5 — `?date` INV-08 no snake leak + H-28 envelope (added to both admin and client files)

## Phase 3: Verification & Budget Guard — DONE

- [x] 3.1 `npx vitest run` both files — **37/37 PASS** (was 30, added 7 new agenda tests)
- [x] 3.2 `npx vitest run` client file — Trace 2, 3 client, 5 client green
- [x] 3.3 `npx eslint` + `npx tsc --noEmit` — 0 errors. Only pre-existing `ForbiddenError` unused warning on line 15 (not introduced by this change)
- [x] 3.4 `git diff --stat` — **108 insertions across 2 test files** (admin +63, client +45). 0 prod files touched. Original forecast ~50-70 was optimistic; actual 108 well under 400-line review budget. Line density ~16 lines/test matches T-036 precedent.

## Phase 4: Archive Note & Single PR — IN PROGRESS

- [x] 4.1 Tick success-criteria boxes in proposal.md
- [ ] 4.2 Commit `test(t037): name agenda ?date traces — 0 prod LOC`
- [ ] 4.3 Open single PR

## Constraints Verified

- 0 prod LOC: route.test.ts only — `route.ts` files unchanged
- INV-02/03/06/08 preserved
- H-11/H-19/H-27/H-28 preserved
- BA DST half-open via getBaDayUtcRange already (no alias build)
- No prod code touched

## Workload Forecast (updated)

| Field | Original | Actual |
|-------|----------|--------|
| Estimated changed lines | ~50-70 | 108 |
| 400-line budget risk | Low | Low (108 << 400) |
| Chained PRs recommended | No | No |
| Suggested split | single PR | single PR |

## Files Modified

- `src/app/api/admin/appointments/route.test.ts` — +63 lines (4 new tests: Trace 1, 3, 4, 5)
- `src/app/api/appointments/route.test.ts` — +45 lines (3 new tests: Trace 2, 3, 5)
- `openspec/changes/t037-daily-agenda/tasks.md` — Phase 1, 2, 3 boxes ticked
- `openspec/changes/t037-daily-agenda/proposal.md` — success-criteria boxes ticked

## New Tests (7 total)

### Admin (`src/app/api/admin/appointments/route.test.ts`)
1. `agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037`
2. `agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037` (4 sub-cases)
3. `agenda ?date=&limit=101 precedence 401→403→400 — T-037`
4. `agenda ?date= INV-08 no snake leak + H-28 envelope — T-037`

### Client (`src/app/api/appointments/route.test.ts`)
5. `agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037`
6. `agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037` (4 sub-cases)
7. `agenda ?date= INV-08 no snake leak + H-28 envelope — T-037`