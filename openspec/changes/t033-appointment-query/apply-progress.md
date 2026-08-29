# Apply Progress — T-033 Appointment Query

**Change**: `t033-appointment-query`
**Mode**: Standard (strict_tdd false)
**Branch**: `feature/t033-appointment-query`
**PR Slice**: PR1 Foundation T-033-001+002 + PR2 Routes+Tests T-033-003→006
**Date**: 2026-08-28

## Completed Tasks

- [x] 1.1 T-033-001 Shared querySchema — `src/lib/http/appointmentQuery.ts` (177 lines)
- [x] 2.1 T-033-002 Extend `findTurnosPaginated` — `src/db/repositories/turnos.ts` (+101/-6)
- [x] 3.1 T-033-003 GET `/api/appointments` CLIENTE — `src/app/api/appointments/route.ts` GET adds requireAuth 401 before parse, parseAppointmentQuery 400, listAppointments delegation 200 {data,pagination}
- [x] 3.2 T-033-004 GET `/api/admin/appointments` ADMIN — `src/app/api/admin/appointments/route.ts` new route with requireAuth 401 + assertRole 403 before Zod
- [x] 4.1 T-033-005 Unit tests schema+repo — `src/lib/http/appointmentQuery.test.ts` + `src/db/repositories/turnos.query.test.ts` (supplements turnos.test.ts)
- [x] 4.2 T-033-006 Route thin tests — `src/app/api/appointments/route.test.ts` GET block + `src/app/api/admin/appointments/route.test.ts`
- [ ] 5.1 T-033-007 Docs sync (deferred to archive)

**Progress**: 6/7 tasks complete (PR1+PR2). Estimated review budget impact: ~368 changed lines for PR2 (<400) + 278 PR1 = ~646 total feature, 368 PR2 slice.

## Files Changed (PR1+PR2)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/lib/http/appointmentQuery.ts` | Created (PR1) | Zod `querySchema` + `parseAppointmentQuery` with strict, superRefine date↔from/to, status↔include*, from≤to |
| `src/db/repositories/turnos.ts` | Modified (PR1) | Extended `FindTurnosPaginatedQuery` + `findTurnosPaginated` with status/from/to/date/offset/dateRange, validations, `getBaDayUtcRange`, page-wins offset |
| `src/app/api/appointments/route.ts` | Modified (PR2) | Added `GET` (60 lines): requireAuth 401 before parse → parseAppointmentQuery Zod400/Validation400 → listAppointments({db,config,now},parsed,authUser) → 200 |
| `src/app/api/admin/appointments/route.ts` | Created (PR2) | `GET` (81 lines): same but assertRole ADMINISTRADOR 403 before parse |
| `src/lib/http/appointmentQuery.test.ts` | Created (PR2) | 12 tests: defaults, enum, include* case-insensitive, date valid/invalid/calendar, date+from, status↔flag, from>to, limit/page/sort, offset, TZ, duplicate array, strict |
| `src/db/repositories/turnos.query.test.ts` | Created (PR2) | 6 tests: contradiction, date vs from, from>to, BA 03:00Z + DST 2026-03-08, pagination offset precedence, limit/sort |
| `src/app/api/appointments/route.test.ts` | Modified (PR2) | Added GET CLIENTE block: 200 envelope, 401 before 400, 400, no snake leak, sort/pagination passthrough |
| `src/app/api/admin/appointments/route.test.ts` | Created (PR2) | 8 tests: ADMIN 200, CLIENTE 403, unauth 401, 401 before 400, 400, filter passthrough, 403 before 400, no snake leak |

## Work Unit Evidence (PR2)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run src/lib/http/appointmentQuery.test.ts src/db/repositories/turnos.query.test.ts src/app/api/appointments/route.test.ts src/app/api/admin/appointments/route.test.ts src/db/repositories/turnos.test.ts` — 62/62 PASS (plus 18 existing = 80 total mocked); `npx tsc --noEmit` — PASS (no output) |
| Runtime harness command/scenario and exact result | N/A — mocked DB (DbOrTx) + mocked auth/service; no live DB required; `getBaDayUtcRange` DST-aware verified via unit logic (03:00Z for 2026-09-10, 03:00Z DST 2026-03-08 24h) |
| Rollback boundary | Delete `src/app/api/admin/appointments/route.ts` + `src/lib/http/appointmentQuery.test.ts` + `src/db/repositories/turnos.query.test.ts` + `src/app/api/admin/appointments/route.test.ts` + revert GET in `src/app/api/appointments/route.ts` + revert GET tests. Repo `turnos.ts` unchanged in PR2. |

## Deviations from Design

- `config` in GET routes passes full `Pick<WorkshopConfig, timezone|operatingHours|capacityPerSlot>` to satisfy `AppointmentServiceDeps` type (requires capacityPerSlot) — design showed only timezone, but service signature requires all three; no behavior change, still DI parametrized.
- `turnos.query.test.ts` created as supplementary file instead of extending `turnos.test.ts` directly to keep PR1 file untouched and review diff focused; both files together cover RN-04.
- `parseAppointmentQuery` widened to `Record<string,string|string[]|undefined>` for duplicate handling (already in PR1).

## Issues Found

- `server-only` throws in vitest — mitigated via `vi.mock("server-only")` in all new test files.
- `getBaDayUtcRange` DST 2026-03-08 returns 24h range — verified no offset bug for BA.

## Workload / PR Boundary

- Mode: chained PR slice (`feature-branch-chain`)
- Current work unit: PR2 GET handlers + route tests (T-033-003→006)
- Boundary: starts from `feature/t033-appointment-query@55c11b9` (after PR1), ends with admin route + 4 test files + GET in appointments route
- Chain: PR1 → `feature/t033-appointment-query`; PR2 stacks on same branch (commits 1af16e2, 9452cae, af70770)
- Estimated review budget impact: PR2 ~368 lines (<400)

## Commits

- `bcee077` feat(appointment): add shared appointment query schema T-033-001
- `55c11b9` feat(appointment): extend findTurnosPaginated with status/date/range/offset T-033-002
- `1af16e2` feat(appointment): add GET query CLIENTE T-033-003
- `9452cae` feat(appointment): add GET query ADMIN T-033-004
- `af70770` test(appointment): add query validation and route tests T-033-005/006

## Status

6/7 tasks complete. Ready for verify (only T-033-007 docs sync deferred to archive). Not yet `all_done`.
