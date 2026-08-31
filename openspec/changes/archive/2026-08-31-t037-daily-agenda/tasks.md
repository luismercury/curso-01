# Tasks: t037-daily-agenda — Daily Agenda via Date Filter Reuse (FASE 7 T-037)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~50-70 (tests + 1 doc note) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (not needed — Low risk) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Name 5 agenda ?date traces | PR 1 | `npx vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` | vitest in-process | revert test files only — no prod LOC, no migration |

## Phase 1: Pre-flight Verification (T-033/T-035 reuse check)

- [x] 1.1 Read `src/lib/http/appointmentQuery.ts` `querySchema` + `parseAppointmentQuery` — confirm `date` regex/`isValidCalendarDate`, `date↔from/to` 400, `status↔include*` 400, `limit 1..100`, `sort asc|desc|startAt:*` whitelist
- [x] 1.2 Read `src/db/repositories/turnos.ts` `findTurnosPaginated` — confirm `getBaDayUtcRange` half-open `gte/lt` + `gt(now)` + shared `whereClause` + page-wins-offset + `toTurnoDTO` on map
- [x] 1.3 Read `src/services/availability/availabilityService.ts` `getBaDayUtcRange` — confirm DST oracle `baWallTimeToUtcDate` + `nextBaYmd`
- [x] 1.4 Read `src/services/config/workshopConfig.ts` (or equivalent) — confirm `WorkshopConfig.timezone = America/Argentina/Buenos_Aires` (INV-06)

## Phase 2: Named Agenda Trace Tests (Trace 1-5, 0 prod LOC)

- [x] 2.1 Trace 1 — add `it("agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037")` to `src/app/api/admin/appointments/route.test.ts`: ADMIN `GET /api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc` → `200 {data, pagination}` ordered asc, BA half-open + `gt(now)` asserted via `listAppointments` mock args
- [x] 2.2 Trace 2 — add `it("agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037")` to `src/app/api/appointments/route.test.ts`: CLIENTE `GET /api/appointments?date=2026-09-10&sort=startAt:asc` → `200` only own rows; assert repo receives `customerId=authUser.id`
- [x] 2.3 Trace 3 — add 4 cases to both test files: `it("agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037")` covering default excludes `CANCELADO|RECHAZADO`, `includeCancelled=true` adds cancelled, `includeRejected=true` adds rejected, both add all four statuses
- [x] 2.4 Trace 4 — add `it("agenda ?date=&limit=101 precedence 401→403→400 — T-037")` to `src/app/api/admin/appointments/route.test.ts`: no-JWT → `401` before `400`; CLIENTE on admin → `403` before `400` even with `limit=101`
- [x] 2.5 Trace 5 — add `it("agenda ?date= INV-08 no snake leak + H-28 envelope — T-037")` to both test files: assert `not.toHaveProperty("estado"|"fecha_hora_inicio"|"fecha_hora_fin")`, response shape `{data,pagination}` with `totalPages=ceil(total/limit)`

## Phase 3: Verification & Budget Guard

- [x] 3.1 Run `npx vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` — 37/37 PASS (admin 17 + client 20; baseline 30 → +7 new agenda traces)
- [x] 3.2 Run `npx vitest run src/app/api/appointments/route.test.ts` — Trace 2, 3 client, 5 client green
- [x] 3.3 Run `npx eslint src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` + `npx tsc --noEmit` — 0 errors (1 pre-existing `ForbiddenError` unused warning on line 15)
- [x] 3.4 Run `git diff --stat` — 108 insertions across 2 test files (admin +63, client +45), 0 prod files touched, no `src/app/api/**/route.ts` changed. Original forecast ~50-70 was optimistic — actual 108 well under 400-line review budget; line density ~16 lines/test matches T-036 precedent

## Phase 4: Archive Note & Single PR

- [x] 4.1 Tick success-criteria boxes in `openspec/changes/t037-daily-agenda/proposal.md` (5 traces confirmed, 0 LOC, H-19 preserved, single PR)
- [x] 4.2 Commit `test(t037): name agenda ?date traces — 0 prod LOC` (single work-unit: tests + doc note) — committed as `858a790` on master, 8 files, 576 insertions
- [ ] 4.3 Open single PR against `main`: `feat(t037): daily agenda via ?date reuse (delta NONE)` — body cites T-033/T-035 DONE, H-19 single-owner, delta NONE per T-036 precedent