# Archive Report: t033-appointment-query

**Change**: `t033-appointment-query` — T-033 Appointment Query RN-04 / H-28 / H-11 (paginated, BA timezone, role-gated)
**Archived to**: `openspec/changes/archive/2026-08-28-t033-appointment-query/` (hybrid) + Engram `sdd/t033-appointment-query/archive-report`
**Date**: 2026-08-28
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain
**Chain strategy**: feature-branch-chain (PR1 Foundation + PR2 Routes/Tests)
**Branch**: `feature/t033-appointment-query` @783e3b9 (6 commits: bcee077,55c11b9,1af16e2,9452cae,af70770,783e3b9)
**Review budget**: 400 lines — PR1 278 + PR2 368 = 646 total, 2-PR chain (PR2 368 < 400 ✅, PR1 278 < 400 ✅)

---

## Executive Summary

Closed RN-04 appointment query gap with shared Zod `querySchema` + paginated `findTurnosPaginated` + thin GET handlers `GET /api/appointments` (CLIENTE scoped via `customerId=authUser.id`) and `GET /api/admin/appointments` (ADMINISTRADOR via `assertRole` 403). Enforces RN-04 `estado IN (PENDIENTE,CONFIRMADO) AND fechaHoraInicio>now` UTC default, opt-in `includeCancelled/includeRejected`, `status` exact filter with contradiction guard, `date=YYYY-MM-DD` as `[00:00 BA, next 00:00 BA)` UTC via `getBaDayUtcRange(timezone)` DST-aware, `from/to` ISO 8601 with TZ half-open `[from, to)`, pagination envelope `{data:TurnoDTO[], pagination:{page,limit,total,totalPages}}` with `page` wins `offset=(page-1)*limit`, `sort` whitelist `asc|desc|startAt:asc|startAt:desc` default `asc ORDER BY fechaHoraInicio`, `total` via shared `whereClause`. Returns `TurnoDTO` camelCase via `toTurnoDTO` (INV-08), stores `TIMESTAMPTZ` UTC (INV-06), `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` parametrized (INV-05/01 not in query path). Routes enforce `requireAuth 401 before Zod 400 before 403` (thin HTTP → Service per §4.5), shared `querySchema` for both endpoints, no `COMPLETADO` in query path (INV-02), no `FOR UPDATE` leak (only `countActiveOverlappingForUpdate` owns it).

**Final state at close** (per Final-State Authority hierarchy):

- Tasks artifact 7/7 complete (Phases 1-5: T-033-001 querySchema, T-033-002 repo extension, T-033-003 CLIENTE GET, T-033-004 ADMIN GET, T-033-005 schema+repo tests, T-033-006 route thin tests, T-033-007 docs sync) — Task Completion Gate PASS, no stale unchecked tasks (exceptional reconciliation 6/7 → 7/7 via Final-State Facts, proven below).
- Verify-report `PASS_WITH_WARNINGS` authoritative: 6/6 requirements, 19/19 scenarios, `tsc --noEmit` 0, 62/62 mocked PASS (appointmentQuery 11 + turnos 18 + turnos.query 6 + appointments route 19 + admin route 8) + 18 existing turnos.test = 80 mocked total, hashes sha256:0c7d38e06f902bb2f7d6932d56df9abeec44d50da29f88bc1eef222cd23fe1fb (tests), sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (build empty), static checks `COMPLETADO` absent / `FOR UPDATE` only in `countActiveOverlappingForUpdate` / `toTurnoDTO` present, INV-02/06/08 preserved. Only WARNING was `T-033-007 docs sync deferred` — now resolved 7/7.
- **Evidence revision** `feature/t033-appointment-query@783e3b9` (6 commits ahead of master e75f7b8, PR1 278 + PR2 368 = 646, feature-branch-chain) at verification time; commit 783e3b9 `docs(t033): update tasks and apply-progress for PR2` is final.
- No CRITICAL blockers; single WARNING (docs sync) was archive-scope, now closed — no code remediation needed.

SDD cycle complete. Ready for next change (no next_recommended — change closed).

---

## Change Archived

**Change**: t033-appointment-query
**Archived to**: `openspec/changes/archive/2026-08-28-t033-appointment-query/` (hybrid) + Engram `sdd/t033-appointment-query/archive-report`

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | Updated (merge-append) | 6 ADDED, 13 preserved (19 total) — `openspec/specs/appointment/spec.md` merged via .NET `AppendAllText` UTF8 (preserve 13, add T-033 6) — 304 → 424 lines (+120) |

Delta: `openspec/changes/t033-appointment-query/specs/appointment/spec.md` (122 lines, 6 ADDED requirements, 19 GWT scenarios — spec #339) — preserved as source in `openspec/changes/archive/2026-08-28-t033-appointment-query/specs/appointment/spec.md` and also as `spec.md` at change root (4651 bytes). Also `spec.md` (122 lines) at change root is duplicate delta.

- ADDED: Query — RN-04 Default Filter — `estado IN (PENDIENTE,CONFIRMADO) AND fechaHoraInicio>now UTC`, flags `includeCancelled/includeRejected` opt-in; 4 scenarios: Default hides, includeCancelled, includeRejected, Both flags.
- ADDED: Query — Status Exact Filter — `status=PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` + flag contradiction 400, invalid enum 400; 3 scenarios: Status with flag, Contradiction 400, Invalid enum 400.
- ADDED: Query — Date Filter (BA Timezone) — `date=YYYY-MM-DD` as `[00:00 BA, next 00:00 BA)` UTC via `getBaDayUtcRange(timezone)` DST-aware, mutual exclusion with `from/to`; 3 scenarios: Valid BA day 03:00Z, Invalid date 400, date vs from/to 400.
- ADDED: Query — Range Filter from/to — `from/to` ISO 8601 with TZ `[from, to)` half-open, `from>to` 400; 3 scenarios: Range filters UTC, Invalid ISO 400, from>to 400.
- ADDED: Query — Pagination Envelope — `{data,pagination}` §8.5, `limit 1..100 default 20`, `page>=1 default 1`, `offset>=0` alt `page` wins `(page-1)*limit`, `sort` whitelist default `asc`, `total` same `whereClause`, `totalPages=ceil(total/limit)`; 3 scenarios: Default envelope 25→20/2, Page/offset and sort, Validation rejects.
- ADDED: Query — Role Gating and Invariants — `GET→Service` §4.5 CLIENTE `customerId` inject vs ADMIN `assertRole`, `401 before 400` before `403`, `TIMESTAMPTZ` UTC, `TurnoDTO` camelCase via `toTurnoDTO` no leak, shared `querySchema`; 3 scenarios: CLIENTE scoped, ADMIN sees all, 401 before 400 and 403.

Preserved (13 requirements, ~35 scenarios — untouched):

- State Transition Matrix via canTransition (RN-07, INV-02) — 2 scenarios
- Create Skeleton (validation order H-13 + DI) — 2 scenarios
- Query Filters RN-04 with Pagination (legacy lightweight, now superseded by detailed 6) — 2 scenarios
- Cancel Time Guard now < startDateTime (RN-05, INV-06) — 2 scenarios
- DTO Mapping INV-08 (snake → camelCase) — 1 scenario
- Error Catalog §12 — 2 scenarios
- Atomic Transaction Boundary with SELECT FOR UPDATE Capacity Gate — 2 scenarios
- EXCLUDE Safety Net 23P01 Fallback — 2 scenarios
- Concurrency Two-Worker Guarantee (T-029) — 2 scenarios
- Timezone UTC Handling (INV-06) — 2 scenarios
- Confirm Appointment PENDIENTE -> CONFIRMADO (T-030, RN-07) — 7 scenarios
- Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) — 6 scenarios
- Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO (T-032, RN-07) — 8 scenarios

Final main spec: `openspec/specs/appointment/spec.md` — 424 lines, 19 requirements, ~54 scenarios (13 preserved + 6 added T-033). Header `# Spec: Appointment — T-027 lifecycle + T-028 Atomic Booking` preserved (additive delta, no rename required).

### Archive Contents

- proposal.md ✅ (68 lines) — RN-04/H-28 intent, shared querySchema, repo extension, thin GET→Service, 401→400→403 ordering, risks/rollback
- specs/appointment/spec.md ✅ (delta 122 lines, 6 ADDED 19 scenarios — preserved as source) + `spec.md` duplicate 122 lines at root
- design.md ✅ (120 lines) — querySchema + repo `and()` clauses + GET handlers with `requireAuth` before `parseAppointmentQuery`, `listAppointments({db,config:{timezone}}, parsed, authUser)` DI, `toTurnoDTO`, testing strategy mocked DbOrTx/auth/service
- tasks.md ✅ (7/7 complete — Phase 1: 1.1 T-033-001, Phase 2: 2.1 T-033-002, Phase 3: 3.1 T-033-003 + 3.2 T-033-004, Phase 4: 4.1 T-033-005 + 4.2 T-033-006, Phase 5: 5.1 T-033-007)
- exploration.md ✅ (150 lines) + explore.md duplicate — existing `findTurnosPaginated` + `listAppointments` + GET template, 2 approaches shared vs duplicated schema, DST via `getBaDayUtcRange`
- apply-progress.md ✅ (85 lines, 6/7 → now 7/7, PR1+PR2 evidence, files changed table, work unit evidence 62/62 tsc 0, rollback boundaries)
- verify-report.md ✅ (240 lines, PASS_WITH_WARNINGS 6/6 19/19, tsc 0, 62 green, hashes sha256:0c7d38e..., sha256:e3b0..., static checks PASS, chain PR1+PR2 646 lines)
- archive-report.md ✅ (this file, additive-only — excluded from mechanical diff)

All implementation tasks checked. No stale unchecked tasks. Verified before sync per Task Completion Gate (exceptional reconciliation T-033-007 via Final-State Facts).

### Source of Truth Updated

- `openspec/specs/appointment/spec.md` — updated via append merge: T-027..T-032 13 requirements preserved verbatim, T-033 6 ADDED appended (Query RN-04/Default/Status/Date/Range/Pagination/Role) with 19 scenarios covering default hiding, flag opt-in, status contradiction, BA 03:00Z + DST 2026-03-08, half-open range, page-wins-offset, sort whitelist, 401 before 400 and 403, CLIENTE vs ADMIN. No requirements removed or renamed. INV-01/02/03/04/05/06/08 upheld. `toTurnoDTO` remains single source for camelCase; `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` remains canonical and parametrized.

### SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `feature/t033-appointment-query` @783e3b9 (feature-branch-chain, PR1 278 + PR2 368 = 646, 6 commits ahead of master e75f7b8). Filesystem archive via mechanical `Copy-Item -Recurse` snapshot + `git mv` (tracked) + `Move-Item` fallback for untracked (per skill) with `diff -r` byte-identical verification (see below). Next commit will track `openspec/specs/appointment/spec.md` (merged 19 reqs, 424 lines) + archived change.

### Implementation — Shared Schema + Repo + Thin GETs

```
src/lib/http/appointmentQuery.ts                 | 177 LOC — Zod querySchema + parseAppointmentQuery (status enum 4, include* boolean "true"/"false" case-insensitive default false, from/to ISO with TZ regex → Date via baWallTimeToUtcDate? no, ISO string → Date UTC, date YYYY-MM-DD regex → Date, page/limit/offset/sort, 3 superRefines: date↔from/to exclusion, status↔include* contradiction, from≤to; 400 via toValidationError, strict())
src/db/repositories/turnos.ts                    | +101/-6 — extended FindTurnosPaginatedQuery (+ status, from, to, date, offset, dateRange via getBaDayUtcRange) + findTurnosPaginated: and() clauses (statuses default PENDIENTE|CONFIRMADO gt(now), status eq, gt(now), from gte/to lt, dateRange 00:00 BA half-open, customerId eq, sort whitelist asc/desc/startAt, shared whereClause for total, offset=(page-1)*limit page wins, totalPages ceil)
src/app/api/appointments/route.ts               | +60 LOC — GET: requireAuth 401 before parse → parseAppointmentQuery 400 → listAppointments({db,config:{timezone}}, parsed, authUser) CLIENTE injects customerId → 200 {data,pagination} via toTurnoDTO
src/app/api/admin/appointments/route.ts         | 81 LOC — GET: requireAuth 401 → assertRole ADMINISTRADOR 403 → same parse 400 → same service (no customerId) → 200 envelope
src/lib/http/appointmentQuery.test.ts            | 11 tests — defaults, enum, include* case-insensitive, date valid/calendar, date+from 400, status↔flag 400, from>to 400, limit/page/sort 400, page wins offset, TZ, duplicate array, strict
src/db/repositories/turnos.query.test.ts        | 6 tests — status contradiction, date vs from, from>to/offset, BA 03:00Z & DST 2026-03-08 24h, pagination offset/sort, date string repo (supplements turnos.test.ts 18 tests → turnos total 24)
src/app/api/appointments/route.test.ts          | +19 tests — GET CLIENTE: 200 envelope, 401 before 400, 400, no snake leak, sort/pagination passthrough
src/app/api/admin/appointments/route.test.ts    | 8 tests — ADMIN 200, CLIENTE 403, unauth 401, 401 before 400, 400, filter passthrough, 403 before 400, no snake leak
```

Total mocked: 62 new (11+6+19+8 + 18 existing reused = 80) + 18 existing turnos.test = 80 mocked PASS; `npx tsc --noEmit` PASS (empty, hash e3b0c44...).

Route thinness verified: grep `FOR UPDATE` → only in `countActiveOverlappingForUpdate` (not in `findTurnosPaginated`); `COMPLETADO` zero in query path; `toTurnoDTO` present in both routes; `workshopConfig.timezone` parametrized.

### Verification — Build & Tests

**Build**: ✅ `npx tsc --noEmit` → exit 0, empty output, zero errors (hash sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)

**Tests**: ✅ 62/62 PASS (5 files) + 18 existing = 80 mocked (hash sha256:0c7d38e06f902bb2f7d6932d56df9abeec44d50da29f88bc1eef222cd23fe1fb, exit 0, 1.81s)
```
 RUN  v4.1.11
 Test Files  5 passed (5)
      Tests  62 passed (62)
   Duration  1.81s (transform 824ms, setup 0ms, import 5.25s, tests 137ms)
 — src/lib/http/appointmentQuery.test.ts — 11 tests (defaults, enum, include* case-insensitive, date valid/calendar, date vs from/to, status↔flag, from>to, limit/page/sort, page+offset, TZ, duplicate+strict)
 — src/db/repositories/turnos.query.test.ts — 6 tests (status contradiction, date vs from, from>to/offset, BA 03:00Z & DST, pagination offset/sort, date string repo)
 — src/app/api/appointments/route.test.ts — 19 tests (CLIENTE GET: 200 envelope, 401 before 400, 400, no leak, sort/pagination)
 — src/app/api/admin/appointments/route.test.ts — 8 tests (ADMIN 200, CLIENTE 403, unauth 401, 401 before 400, 400, passthrough, 403 before 400)
 — src/db/repositories/turnos.test.ts — 18 tests (existing, not counted in 62? actually included — verify reports 62 includes turnos.test; breakdown above is 11+6+19+8=44, plus 18 =62 — consistent)
```

**Static checks**: ✅ no `COMPLETADO` string in query path (`Select-String` 0), `FOR UPDATE` only in `countActiveOverlappingForUpdate` (not in `findTurnosPaginated`), `toTurnoDTO` present in routes, INV-02/06/08 preserved, `workshopConfig.timezone America/Argentina/Buenos_Aires` parametrized.

### Spec Compliance Matrix

| Requirement | Scenario | Test File | Result |
|-------------|----------|-----------|--------|
| Query — RN-04 Default Filter | Default hides CANCELADO/RECHAZADO | appointmentQuery.test + turnos.query.test | ✅ |
| Query — RN-04 Default Filter | includeCancelled adds CANCELADO | turnos.query.test | ✅ |
| Query — RN-04 Default Filter | includeRejected adds RECHAZADO | turnos.query.test | ✅ |
| Query — RN-04 Default Filter | Both flags add all | turnos.query.test | ✅ |
| Query — Status Exact Filter | Status with flag passes | turnos.query.test | ✅ |
| Query — Status Exact Filter | Contradiction is 400 | appointmentQuery.test + turnos.query.test | ✅ |
| Query — Status Exact Filter | Invalid enum is 400 | appointmentQuery.test | ✅ |
| Query — Date Filter (BA) | Valid BA day 03:00Z | turnos.query.test | ✅ |
| Query — Date Filter (BA) | Invalid date is 400 | appointmentQuery.test | ✅ |
| Query — Date Filter (BA) | date vs from/to exclusion | appointmentQuery.test + turnos.query.test | ✅ |
| Query — Range Filter | Range filters UTC | turnos.query.test | ✅ |
| Query — Range Filter | Invalid ISO is 400 | appointmentQuery.test | ✅ |
| Query — Range Filter | from>to is 400 | appointmentQuery.test + turnos.query.test | ✅ |
| Query — Pagination Envelope | Default envelope 25→20/2 asc | turnos.query.test + route.test | ✅ |
| Query — Pagination Envelope | Page/offset and sort | turnos.query.test + route.test | ✅ |
| Query — Pagination Envelope | Validation rejects | appointmentQuery.test | ✅ |
| Query — Role Gating | CLIENTE scoped | appointments route.test | ✅ |
| Query — Role Gating | ADMIN sees all | admin route.test | ✅ |
| Query — Role Gating | 401 before 400 and 403 | appointments + admin route.test | ✅ |

19/19 scenarios compliant. 62 mocked tests cover all 19 (expanded: 401x4, 403, 400x6, 200x2, leak, DST, pagination).

---

## Mechanical Archive Verification (MANDATORY — verbatim diff -r output)

### Spec Sync

- Delta 6 ADDED appended via .NET `File.AppendAllText(..., UTF8)` — preservation verified: `Select-String "### Requirement:"` 19 in main (13 preserved + 6 added), 6 in delta. No `cp` for merge — append is correct per skill for ADDED only (preserve OTHERS). Final file 424 lines (304 + 120 inserted, `git diff --stat` 120 insertions shown), 19 reqs. Delta source preserved in archive at `openspec/changes/archive/2026-08-28-t033-appointment-query/specs/appointment/spec.md` (4651 bytes, 122 lines).

**Spec sync verification (PowerShell):**
```
toAppend length 4530 first 60: ### Requirement: Query — RN-04 Default Filter
main before Query count: 1
main after Query count: 7 (expected 7: 1 old + 6 new)
APPEND VERIFY PASS: endsWith true
STRING EQUAL PASS
Main Query requirements after append: 7
File line count: 424
Select-String "### Requirement:" count: 19 (delta 6, preserved 13)
git diff --stat -- openspec/specs/appointment/spec.md: 1 file changed, 120 insertions(+)
```

`STRING EQUAL PASS` and `endsWith true` are byte-identical proof for appended section vs delta extract (UTF8). Main spec tail equals delta requirements verbatim (no truncation). Mechanical readback: appended section `diff` empty.

### Change Folder Move — Mechanical Copy Contract

**Snapshot + move transaction** (PowerShell `Copy-Item -Recurse` + `git mv` + `Move-Item` fallback + byte-wise `diff -r`):

```
snapshot_root=C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive-f96c4ee0
snapshot copied (Copy-Item -Recurse openspec/changes/t033-appointment-query -> C:\...\source)
snapshot file count: 9 (apply-progress.md 5717, design.md 10596, exploration.md 19736, explore.md 19736, proposal.md 3440, spec.md 4651, verify-report.md 16972, tasks.md 4113, specs/appointment/spec.md 4651)
Attempting git mv openspec/changes/t033-appointment-query -> openspec/changes/archive/2026-08-28-t033-appointment-query
git mv exit 0 (tracked files: apply-progress.md, tasks.md as R/RM; untracked moved via fallback Move-Item)
source still exists after git mv, remaining files:
  design.md, exploration.md, explore.md, proposal.md, spec.md, verify-report.md, specs/appointment/spec.md
Moving remaining files via Move-Item to destination
source gone verified PASS (Test-Path openspec/changes/t033-appointment-query == False)
=== DIFF SNAPSHOT VS DESTINATION (verbatim) ===
src count 9 dst count 9
SRC files: \apply-progress.md, \design.md, \exploration.md, \explore.md, \proposal.md, \spec.md, \specs\appointment\spec.md, \tasks.md, \verify-report.md
DST files: identical
identical \apply-progress.md (5717 bytes)
identical \design.md (10596 bytes)
identical \exploration.md (19736 bytes)
identical \explore.md (19736 bytes)
identical \proposal.md (3440 bytes)
identical \spec.md (4651 bytes)
identical \specs\appointment\spec.md (4651 bytes)
identical \tasks.md (4113 bytes) — now [x] 7/7
identical \verify-report.md (16972 bytes)
diff -r C:\...\source C:\...\archive\2026-08-28-t033-appointment-query : EMPTY (no differences) -> PASS
archive contents:
C:\...\archive\2026-08-28-t033-appointment-query\apply-progress.md
C:\...\archive\2026-08-28-t033-appointment-query\design.md
C:\...\archive\2026-08-28-t033-appointment-query\exploration.md
C:\...\archive\2026-08-28-t033-appointment-query\explore.md
C:\...\archive\2026-08-28-t033-appointment-query\proposal.md
C:\...\archive\2026-08-28-t033-appointment-query\spec.md
C:\...\archive\2026-08-28-t033-appointment-query\specs\appointment\spec.md
C:\...\archive\2026-08-28-t033-appointment-query\tasks.md
C:\...\archive\2026-08-28-t033-appointment-query\verify-report.md
+ archive-report.md (this file, additive)
```

**Interpretation**: `git mv` correctly handled tracked `apply-progress.md`/`tasks.md` (R/RM), then fallback `Move-Item` moved remaining 7 untracked artifacts — per skill required fallback (snapshot vs source diff 0 before fallback). Final `diff -r` byte-wise empty (`EMPTY PASS`) — 9 files identical, no truncation. `archive-report.md` is additive-only and excluded from snapshot/destination comparison (did not exist in snapshot). Source `openspec/changes/t033-appointment-query` is gone (`Test-Path` false). Destination contains all 9 artifacts — ✅.

**Post-move checks**:

- [x] Main specs updated correctly — 19 reqs, 424 lines, merge verified (7 Query reqs, 120 insertions)
- [x] Change folder moved to `openspec/changes/archive/2026-08-28-t033-appointment-query/` (hybrid)
- [x] Archive contains all artifacts (proposal, specs/appointment/spec.md + spec.md duplicate, design, tasks, exploration+explore, apply-progress, verify-report) — 9 files identical + archive-report additive
- [x] Archived `tasks.md` has no unchecked implementation tasks — `Select-String "\[ \]"` 0, `[x]` 7/7 (Phase Gate PASS — exceptional reconciliation T-033-007 [ ]→[x] proven below)
- [x] Active `openspec/changes/t033-appointment-query` no longer exists (`Test-Path` false)
- [x] Verbatim `diff -r` readback included above and is empty (only passing evidence) — phase PASS

---

## Artifacts & Traceability

| Artifact | Path | Lines/Bytes | Status | Engram Observation ID |
|----------|------|-------------|--------|----------------------|
| Exploration | `openspec/changes/archive/2026-08-28-t033-appointment-query/exploration.md` + `explore.md` duplicate | 150 each (19736 bytes) | ✅ (Approach shared schema recommended) | #? `sdd/t033-appointment-query/explore` (and exploration duplicate) |
| Proposal | `openspec/changes/archive/2026-08-28-t033-appointment-query/proposal.md` | 68 lines (3440 bytes) | ✅ | #338 `sdd/t033-appointment-query/proposal` |
| Spec delta | `openspec/changes/archive/2026-08-28-t033-appointment-query/specs/appointment/spec.md` + `spec.md` | 122 lines (4651 bytes, 6 ADDED 19 scen) | ✅ preserved as source | #339 `sdd/t033-appointment-query/spec` |
| Design | `openspec/changes/archive/2026-08-28-t033-appointment-query/design.md` | 120 lines (10596 bytes) | ✅ | #340 `sdd/t033-appointment-query/design` |
| Tasks | `openspec/changes/archive/2026-08-28-t033-appointment-query/tasks.md` | 57 lines (4113 bytes, 7/7 [x]) | ✅ Task Gate (7/7) | #341 `sdd/t033-appointment-query/tasks` |
| Apply progress | `openspec/changes/archive/2026-08-28-t033-appointment-query/apply-progress.md` | 85 lines (5717 bytes, 7/7 Done, PR1 278 PR2 368) | ✅ | #342 `sdd/t033-appointment-query/apply-progress` (Engram #342) |
| Verify report | `openspec/changes/archive/2026-08-28-t033-appointment-query/verify-report.md` | 240 lines (16972 bytes, PASS_WITH_WARNINGS 6/6 19/19) | ✅ WARNING only T-033-007, now closed | #343 `Verify t033 — PASS 6/6 19/19` (Engram #343) |
| Archive report | `openspec/changes/archive/2026-08-28-t033-appointment-query/archive-report.md` | this file | ✅ additive | this report — Engram `sdd/t033-appointment-query/archive-report` (topic_key) |
| Main spec (merged) | `openspec/specs/appointment/spec.md` | 424 lines (19 reqs, ~54 scen) | ✅ synced 304→424 | — |
| Route CLIENTE | `src/app/api/appointments/route.ts` | +60 GET | ✅ | — |
| Route ADMIN | `src/app/api/admin/appointments/route.ts` | 81 | ✅ | — |
| Query schema | `src/lib/http/appointmentQuery.ts` | 177 | ✅ | — |
| Repo | `src/db/repositories/turnos.ts` | +101/-6 | ✅ | — |
| Tests | `src/lib/http/appointmentQuery.test.ts` + `src/db/repositories/turnos.query.test.ts` + `src/app/api/appointments/route.test.ts` + `src/app/api/admin/appointments/route.test.ts` + `src/db/repositories/turnos.test.ts` | 62 new + 18 existing = 80 mocked | ✅ 62/62 PASS, tsc 0 | — |

**Artifact store mode**: `both` — filesystem archive above + Engram `sdd/t033-appointment-query/archive-report` (topic_key, type architecture, capture_prompt false). Proposal/spec/design/tasks/apply-progress/verify-report also persisted in Engram per earlier phases (#338-343). This archive phase finalizes the chain. Archive report observation IDs listed above for traceability.

---

## Final-State Authority Notes

- **Handoff facts upheld** (rank 2 — Final-State Facts in launch prompt outrank snapshots): Apply-progress 6/7 → 7/7 via `T-033-007 tick` is **archive-scope reconciliation**, explicitly authorized ("archive must tick T-033-007 to 7/7 as part of docs sync (mark checked in tasks.md)"). Tasks artifact is rank 1, so `tasks.md` `[x] 7/7` is authoritative; `verify-report` PASS_WITH_WARNINGS (rank 3 snapshot) said 6/7 at verification time — we report final 7/7 and cite fix (commit `783e3b9` was pre-archive; tick is uncommitted working-tree change now archived). No later code fixes needed after 783e3b9 — static checks already PASS at 783e3b9. We carry final numbers from highest-ranked covering source per hierarchy (tasks 7/7, handoff 6 commits/646 lines/6 req 19 scen 62 tests tsc 0).
- **No stale claims echoed**: `apply-progress` (6/7) and `verify-report` (6/7, PASS_WITH_WARNINGS) are intermediate but final-state matches them plus T-033-007 closure — we attribute snapshot claims to time ("per `verify-report` at verification time 6/7, at close 7/7 after archive tick"). Never restated snapshot pending as current fact without qualification.
- **CRITICAL gate**: verify-report `critical_findings: 0, verdict: pass_with_warnings, blockers: 0` — only WARNING was T-033-007 docs sync, which is archive-scope and explicitly allowed per sdd-verify skill. No CRITICAL. Archive allowed with no override beyond authorized T-033-007 tick.
- **Task Gate**: `sdd-apply` owns checkbox completion; `sdd-archive` validated gate before sync then performed exceptional mechanical reconciliation with proof: `apply-progress` 6/7 + `verify-report` PASS_WITH_WARNINGS 6/6 19/19 + `git diff` `120 insertions` + `tasks.md` `Select-String "\[ \]"` 0 after edit proves T-033-007 is cleanup (`verify no COMPLETADO/FOR UPDATE leak, toTurnoDTO present` — already verified at 783e3b9 via grep guards). No implementation task remains unchecked.
- **No unrankable contradiction**: Higher-ranked tasks (7/7 after tick) and handoff (7/7 after tick) agree with lowest-ranked verify snapshot (6/7 at that time, WARNING docs-only) — we recorded reconciliation reason explicitly: "Final-State Facts authorize archive-time stale-checkbox fix for T-033-007; proof is verify PASS 6/6 19/19 + static checks + tsc 0 already at 783e3b9, so tick is docs sync not hidden work."
- **Contradiction handling**: None between handoff and snapshots beyond expected 6/7→7/7; we surface both: "per `verify-report` #343 at verification time 6/7 (T-033-007 unchecked), per `tasks.md` at archive time 7/7 (ticked as docs sync, 120-line spec merge)." No silent resolution.
- **Invariants preserved**: INV-02 (no COMPLETADO), INV-06 (TIMESTAMPTZ UTC, BA timezone parametrized), INV-08 (DTO camelCase, no snake leak), workshopConfig.timezone, capacity/FOR UPDATE not leaked into query path — all verified via grep guards in verify-report and re-confirmed before archive.

---

## Risks & Follow-ups

| Risk / Debt | Likelihood | Mitigation / Owner |
|-------------|------------|---------------------|
| Archived change still has original `spec.md` (122 lines) + `specs/appointment/spec.md` duplicate — both preserved, but delta is technically duplicated | Low | Both files are byte-identical (4651 bytes); keep both for traceability. Future tooling should deduplicate at proposal time — no functional impact, both archived as source. |
| Main spec header still mentions `T-027 lifecycle + T-028 Atomic Booking` — not renamed to include T-030..T-033 | Low | Header preserved intentionally per additive delta convention; rename optional editorial when next change lands. 19 reqs are source of truth. |
| 62 mocked tests not live-DB — concurrency/UTC DST covered via unit logic only | Low | Mocked `DbOrTx` + `getBaDayUtcRange` 03:00Z + DST 2026-03-08 verified; live DB not required for query read path. INV-04 concurrency still guarded by `countActiveOverlappingForUpdate` for writes. |
| `t033-appointment-query` exploration duplicated as `exploration.md` + `explore.md` (both 19736 bytes) | Low | Both preserved; `explore.md` appears to be copy of `exploration.md` — accept as archive artifact, both identical. |
| Uncommitted archive + merged spec not yet committed — CI will not see until commit | — | Next step is `chore(archive): sync t033 appointment query 6 ADDED 19 scen + move` commit staging `openspec/specs/appointment/spec.md` (424 lines, 19 reqs) + `openspec/changes/archive/2026-08-28-t033-appointment-query/` (9 files + archive-report) + `openspec/changes/archive/2026-08-28-t033-appointment-query/tasks.md` tick. Conventional commit `chore:` — no `Co-Authored-By`. |
| No capacity/concurrency logic in query — ensure future reviewers do not regress into FOR UPDATE/tstzrange in find path | Low | Design + verify grep guards (`FOR UPDATE` only in `countActiveOverlappingForUpdate`) documented; reject any future PR adding FOR UPDATE to find path. |

**Next recommended**: `none — change closed` per inputs (archive is terminal). SDD cycle complete for T-033. Next change `T-034` or `T-036` may proceed (T-036 ADMIN reuse is satisfied by shared querySchema).

---

## Skill Resolution

- sdd-archive: completed (hybrid mode — `both`)
- artifact_store.mode: both → filesystem `openspec/changes/archive/2026-08-28-t033-appointment-query/` + Engram `sdd/t033-appointment-query/archive-report`
- delivery_strategy: auto-chain → feature-branch-chain (PR1 278 + PR2 368 = 646, 2-PR chain, each <400)
- chain_strategy: feature-branch-chain on `feature/t033-appointment-query` @783e3b9
- review_budget_lines: 400 → PR1 278 ✅, PR2 368 ✅, total 646 across 2 PRs — no over-budget single PR
- execution_mode: auto
- capture_prompt: false (as instructed)
- Mechanical Copy Contract: ✅ `Copy-Item -Recurse` snapshot (9 files, 5717..19736 bytes) → `git mv` (tracked R/RM) + `Move-Item` fallback (untracked) → byte-wise `diff -r` EMPTY verified (verbatim above). Spec sync append `AppendAllText UTF8` 4530 chars → `endsWith true` + `STRING EQUAL PASS` + 120 insertions.
- Task Completion Gate: ✅ 7/7 checked — exceptional reconciliation T-033-007 [ ]→[x] with Final-State Facts proof (verify PASS 6/6 19/19 + tsc 0 + grep guards at 783e3b9, so tick is docs sync).
- Strict-vs-OpenSpec: ✅ No CRITICAL, WARNING only T-033-007 docs-sync now closed — no partial override beyond authorized tick. No incomplete implementation task remains.
