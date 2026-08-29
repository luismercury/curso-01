# Tasks: T-033 Appointment Query — RN-04 / H-28 / H-11

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~560 (90+65+65+65+275) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 T-033-001→002 → PR2 T-033-003→006 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | querySchema + repo extension | PR1 → base feature/t033-appointment-query | `pnpm vitest run src/lib/http/appointmentQuery.test.ts src/db/repositories/turnos.test.ts` | N/A — mocked DB | Delete appointmentQuery.ts + revert turnos.ts |
| 2 | GET handlers + route tests | PR2 → base PR1 | `pnpm vitest run src/app/api/appointments/route.test.ts src/app/api/admin/appointments/route.test.ts && npx tsc --noEmit` | N/A — mocked auth/service | Delete admin route + revert GET |

## Phase 1: Foundation

- [x] 1.1 T-033-001 Shared querySchema — Create `src/lib/http/appointmentQuery.ts` with Zod schema + `parseQuery` (status enum, include* boolean, from/to ISO→Date, date YYYY-MM-DD, page/limit/offset/sort, refinements date↔from/to, status↔include*, from≤to; 400 via toValidationError).
  Files: `src/lib/http/appointmentQuery.ts` | Deps: none | Est: ~90 | AC: Pagination/Status/Date/Range 400 GWT + §12

## Phase 2: Core — Repository

- [x] 2.1 T-033-002 Extend `findTurnosPaginated` — Add `status/from/to/date/offset/dateRange` to `FindTurnosPaginatedQuery`; add `and()` clauses (statuses default, status eq, gt(now), from gte/to lt, dateRange via `getBaDayUtcRange`, customerId, sort whitelist, shared whereClause, offset=(page-1)*limit page wins, totalPages).
  Files: `src/db/repositories/turnos.ts` | Deps: T-033-001 | Est: ~65 | AC: RN-04 default+include*, status/date/range, pagination total/offset/sort

## Phase 3: Integration — Routes

- [x] 3.1 T-033-003 GET `/api/appointments` CLIENTE — Add GET: requireAuth 401 before parse → querySchema 400 → listAppointments({db,config:{timezone}},query,authUser) (CLIENTE injects customerId) → 200 {data,pagination} via toTurnoDTO.
  Files: `src/app/api/appointments/route.ts` | Deps: T-033-001,T-033-002 | Est: ~65 | AC: CLIENTE scoped, 401 before 400, envelope, INV-08/06

- [x] 3.2 T-033-004 GET `/api/admin/appointments` ADMIN — Create route with requireAuth 401 → assertRole ADMINISTRADOR 403 → same querySchema 400 → same service (no customerId) → 200 envelope.
  Files: `src/app/api/admin/appointments/route.ts` | Deps: T-033-001,T-033-002 | Est: ~65 | AC: ADMIN sees all, CLIENTE→403, shared schema, 401→400 order

## Phase 4: Testing

- [x] 4.1 T-033-005 Unit tests schema+repo — querySchema branches (enum, include* transform, date invalid, date+from 400, status↔flag 400, from>to 400, limit/page/sort 400, page wins offset) + parseQuery dateRange; repo mocked DbOrTx (RN-04, flags, BA range 03:00Z, DST 2026-03-08, from/to, pagination).
  Files: `src/lib/http/appointmentQuery.test.ts`, `src/db/repositories/turnos.test.ts` | Deps: T-033-001,T-033-002 | Est: ~140 | AC: 19 GWT validation + DST

- [x] 4.2 T-033-006 Route thin tests — Mock requireAuth/assertRole/listAppointments; cover 401 before 400, 400, 403, 200 envelope page/limit/sort/offset, no snake leak, `npx tsc --noEmit` clean.
  Files: `src/app/api/appointments/route.test.ts`, `src/app/api/admin/appointments/route.test.ts` | Deps: T-033-003,T-033-004 | Est: ~135 | AC: Role gating 401/403 + envelope GWT + INV-08 + §4.5

## Phase 5: Cleanup

- [x] 5.1 T-033-007 Docs sync — Update checkmarks, verify no COMPLETADO/FOR UPDATE leak, toTurnoDTO present.
  Files: `openspec/changes/t033-appointment-query/tasks.md` | Deps: T-033-006 | Est: ~10 | AC: No drift, INV-02/08

Threat matrix: N/A (no shell/VCS boundary).
