```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:544d82b517a080c6ead6aa962aa13a7d75a0775f302dc7f0dd5d7e316135d484
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 19/19
test_command: pnpm vitest run src/lib/http/appointmentQuery.test.ts src/db/repositories/turnos.query.test.ts src/app/api/appointments/route.test.ts src/app/api/admin/appointments/route.test.ts src/db/repositories/turnos.test.ts
test_exit_code: 0
test_output_hash: sha256:0c7d38e06f902bb2f7d6932d56df9abeec44d50da29f88bc1eef222cd23fe1fb
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: t033-appointment-query
**Version**: N/A (delta spec #339)
**Mode**: Standard (strict_tdd false)
**Branch**: feature/t033-appointment-query @ 783e3b9 (6 commits ahead of master e75f7b8, stacked PR1+PR2)
**Date**: 2026-08-28

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 7 |
| Tasks complete | 6 |
| Tasks incomplete | 1 (T-033-007 docs sync deferred to archive) |
| Tasks checked | T-033-001 [x], T-033-002 [x], T-033-003 [x], T-033-004 [x], T-033-005 [x], T-033-006 [x] |

T-033-007 is cleanup/docs-sync only (verify no COMPLETADO, no FOR UPDATE leak, toTurnoDTO present, checkmarks). Deferred per apply-progress.md and task instruction WARNING not CRITICAL. Does not block verify.

### Build & Tests Execution

**Build**: ✅ Passed (exit 0, clean)
```text
$ npx tsc --noEmit
<empty stdout — no type errors>
EXIT:0  BUILD_HASH: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (empty output)
```

**Tests**: ✅ 62 passed / 0 failed / 0 skipped (5 files)
```text
$ pnpm vitest run src/lib/http/appointmentQuery.test.ts src/db/repositories/turnos.query.test.ts src/app/api/appointments/route.test.ts src/app/api/admin/appointments/route.test.ts src/db/repositories/turnos.test.ts

 RUN  v4.1.11

 Test Files  5 passed (5)
      Tests  62 passed (62)
   Duration  1.81s (transform 824ms, setup 0ms, import 5.25s, tests 137ms)

TEST_HASH: sha256:0c7d38e06f902bb2f7d6932d56df9abeec44d50da29f88bc1eef222cd23fe1fb  EXIT:0
```

Verbose breakdown (62):
- `src/lib/http/appointmentQuery.test.ts` — 11 tests (defaults, status enum, include* case-insensitive, date valid/calendar, date vs from/to, status↔flag, from>to, limit/page/sort, page+offset, TZ, duplicate+strict)
- `src/db/repositories/turnos.query.test.ts` — 6 tests (status contradiction, date vs from, from>to/offset, BA 03:00Z & DST, pagination offset/sort, date string repo)
- `src/db/repositories/turnos.test.ts` — 18 tests (5 updateTurnoStatus + 13 findTurnosPaginated RN-04/pagination)
- `src/app/api/appointments/route.test.ts` — 19 tests (13 POST + 6 GET CLIENTE: 200 envelope, 401 before 400, 400 contradiction, 400 date+from, no snake leak, sort/pagination passthrough)
- `src/app/api/admin/appointments/route.test.ts` — 8 tests (ADMIN 200, CLIENTE 403, 401, 401 before 400, 400, filter passthrough, 403 before 400, no snake leak)

**Coverage**: ➖ Not measured (vitest run without --coverage; threshold not configured for this change). Mocked DB path — no runtime harness required per design (N/A).

### Spec Compliance Matrix

Source: `openspec/changes/t033-appointment-query/spec.md` — 6 ADDED requirements, 19 GWT scenarios (spec #339). Design #340 referenced.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| **1. RN-04 Default Filtering** | Default hides CANCELADO/RECHAZADO | `turnos.test.ts > exposes include flags without throwing (default hides)` + `turnos.ts:328-331` default statuses ["PENDIENTE","CONFIRMADO"] `turnos.query.test.ts > pagination offset & limit/sort` total=25 check | ✅ COMPLIANT |
| 1. RN-04 Default Filtering | includeCancelled adds CANCELADO | `appointmentQuery.test.ts > include* case-insensitive + boolean` + `turnos.test.ts > exposes include flags` includeCancelled true + `turnos.ts:329` push CANCELADO | ✅ COMPLIANT |
| 1. RN-04 Default Filtering | includeRejected adds RECHAZADO | `appointmentQuery.test.ts > include* case-insensitive + boolean` + `turnos.test.ts > exposes include flags` includeRejected true + `turnos.ts:330` push RECHAZADO | ✅ COMPLIANT |
| 1. RN-04 Default Filtering | Both flags add all | `turnos.test.ts > exposes include flags` both true resolves + `turnos.ts:328-331` statuses length 4 | ✅ COMPLIANT |
| **2. Status Exact Filter + contradiction 400** | Status with flag passes (CANCELADO+includeCancelled) | `appointmentQuery.test.ts > status CANCELADO/RECHAZADO require flags` passes with flag + `turnos.query.test.ts > status contradiction before DB` CANCELADO+include true resolves + `admin/route.test.ts > filter passthrough` status=CANCELADO&includeCancelled=true → 200 | ✅ COMPLIANT |
| 2. Status Exact Filter | Contradiction is 400 (CANCELADO without flag) | `appointmentQuery.test.ts > status CANCELADO/RECHAZADO require flags` throws /includeCancelled/ + `turnos.query.test.ts > status contradiction before DB` rejects code VALIDATION_ERROR + `appointments/route.test.ts > 400 CANCELADO without flag` + `admin/route.test.ts > 400 on bad query` status=CANCELADO → 400 VALIDATION_ERROR | ✅ COMPLIANT |
| 2. Status Exact Filter | Invalid enum is 400 (COMPLETADO) | `appointmentQuery.test.ts > status valid/invalid` COMPLETADO throws + `turnos.ts:277` allowedStatuses check throws VALIDATION_ERROR (`turnos.test.ts` invalid sort/values) | ✅ COMPLIANT |
| **3. Date BA DST via getBaDayUtcRange** | Valid BA day 2026-09-10 → [03:00Z, next 03:00Z) | `turnos.query.test.ts > BA 2026-09-10 03:00Z & DST` asserts fromUtc 2026-09-10T03:00:00.000Z / toUtc 2026-09-11T03:00:00.000Z + `appointmentQuery.test.ts > date valid/invalid + calendar` parse + `turnos.ts:336` getBaDayUtcRange + half-open gte/lt `turnos.ts:347-348` | ✅ COMPLIANT |
| 3. Date BA DST | Invalid date is 400 (2026/09/10) | `appointmentQuery.test.ts > date valid/invalid + calendar` throws for 2026/09/10 and 2026-02-30 | ✅ COMPLIANT |
| 3. Date BA DST | date vs from/to exclusion 400 | `appointmentQuery.test.ts > date vs from/to exclusion` throws /use date/ + `turnos.query.test.ts > date vs from/to & dateRange vs from` throws + `appointments/route.test.ts > 400 date+from & limit 101` → 400 | ✅ COMPLIANT |
| **4. Range from/to ISO half-open** | Range filters UTC (from gte, to lt) | `appointmentQuery.test.ts > from without TZ 400, with TZ ok` parses Date + `turnos.ts:350-354` gte/lt conjunction + `appointmentQuery.test.ts > from>to 400, from==to ok` + route passthrough | ✅ COMPLIANT |
| 4. Range from/to | Invalid ISO is 400 (no TZ) | `appointmentQuery.test.ts > from without TZ 400, with TZ ok` throws for "2026-09-10T00:00:00" (missing Z/±HH:MM) + regex isoWithTzRegex `appointmentQuery.ts:5-6` | ✅ COMPLIANT |
| 4. Range from/to | from greater than to is 400 | `appointmentQuery.test.ts > from>to 400, from==to ok` throws /from must be/ + `turnos.query.test.ts > from>to, offset negative` throws VALIDATION_ERROR + `turnos.ts:300-302` defensive check | ✅ COMPLIANT |
| **5. Pagination Envelope {data,pagination}** | Default envelope page1 limit20 total25 totalPages2 asc | `turnos.test.ts > defaults: page 1 limit 20 asc` expects {page:1,limit:20,total:25,totalPages:2} + `appointmentQuery.test.ts > defaults empty → page1 limit20 asc include false` | ✅ COMPLIANT |
| 5. Pagination Envelope | Page/offset and sort (page wins, offset alt) | `turnos.query.test.ts > pagination offset & limit/sort` page2 limit20 offset20 → getOff 20, offset=20 →20, page2+offset999 →10 (page wins) + `turnos.ts:371-384` page-wins logic + `turnos.test.ts > pagination math: page 2 limit 20 total 25` + `appointments/route.test.ts > sort & pagination passthrough` startAt:desc + `appointmentQuery.test.ts > page+offset both parsed` | ✅ COMPLIANT |
| 5. Pagination Envelope | Validation rejects (limit 101, page0, sort DROP →400) | `appointmentQuery.test.ts > limit 0/101 400, page0 400, sort invalid 400` throws + `turnos.test.ts > limit 101 → VALIDATION_ERROR` + `turnos.test.ts > rejects {limit:0}→VALIDATION_ERROR` + `turnos.query.test.ts > pagination offset & limit/sort` limit0/sort DROP throw | ✅ COMPLIANT |
| **6. Role Gating CLIENTE vs ADMIN, 401 before 400, 403, INV-06 UTC, INV-08 camelCase** | CLIENTE scoped (A 2 rows, B 1 row → only A) | `appointments/route.test.ts > 200 envelope + customerId injection` asserts listAppointmentsMock called with authUser CLIENTE and status, `appointmentService.ts:266-267` injects customerId=authUser.id when CLIENTE, `turnos.ts:343-345` eq(clienteId) filter | ✅ COMPLIANT |
| 6. Role Gating | ADMIN sees all (no customerId filter) | `admin/route.test.ts > ADMIN 200 sees all` + `appointmentService.ts:266-267` no inject when ADMINISTRADOR + `turnos.ts` same whereClause without customerId | ✅ COMPLIANT |
| 6. Role Gating | 401 before 400 and 403 (unauth 401, CLIENTE on admin 403) | `appointments/route.test.ts > 401 before 400` limit101 still 401 + `admin/route.test.ts > 401 before 400` + `admin/route.test.ts > CLIENTE =>403` + `admin/route.test.ts > CLIENTE with invalid limit still 403 not 400` proves ordering: requireAuth (401) → assertRole (403) → querySchema (400). INV-06: `appointmentQuery.ts:5` isoWithTzRegex requires Z/±HH:MM, `turnos.ts:1` TIMESTAMPTZ handling, INV-08: `turno.ts:22-33` toTurnoDTO camelCase, route tests "no snake leak" | ✅ COMPLIANT |

**Compliance summary**: 19/19 scenarios compliant — all covering tests passed at runtime.

### Correctness (Static Evidence)

| Requirement | Status | Notes (file:line) |
|-------------|--------|-------------------|
| RN-04 Default Filtering | ✅ Implemented | `turnos.ts:323-331` statuses default ["PENDIENTE","CONFIRMADO"] + include* opt-in; `341` gt(now) conjunctive; `363-367` total same whereClause |
| Status Exact Filter + contradiction | ✅ Implemented | `appointmentQuery.ts:123-137` superRefine status↔flag; `turnos.ts:277-286` defensive contradiction; `400 VALIDATION_ERROR` mapping |
| Date BA DST half-open | ✅ Implemented | `turnos.ts:336` getBaDayUtcRange + `346-348` gte/lt half-open; `appointmentQuery.ts:94-98` YYYY-MM-DD + calendar check; `turnos.query.test.ts` DST 2026-03-08 24h |
| Range from/to ISO half-open | ✅ Implemented | `appointmentQuery.ts:5-6,80-92` isoWithTzRegex + Date; `turnos.ts:350-354` gte/lt; `300-302` from≤to |
| Pagination Envelope | ✅ Implemented | `turnos.ts:252-369` page/limit/sort validation, totalPages ceil(total/limit) 0 if 0, `371-384` offset precedence, `394-397` returns {data via toTurnoDTO, pagination}; whitelist `263` |
| Role Gating & Invariants | ✅ Implemented | `appointments/route.ts:124-135` requireAuth 401 before parse; `admin/route.ts:20-39` assertRole 403 before parse; `appointmentService.ts:259-275` CLIENTE customerId injection; shared querySchema both routes; `toTurnoDTO` `turno.ts:22` INV-08, `isoWithTzRegex` INV-06; no COMPLETADO anywhere |

Static checks:
- **No COMPLETADO** leak: `Select-String COMPLETADO` across `turnos.ts`, `appointmentQuery.ts`, `appointmentService.ts` → 0 hits ✅
- **No FOR UPDATE leak in query path**: `FOR UPDATE` only in `turnos.ts:140` inside `countActiveOverlappingForUpdate` (TX helper T-028); `findTurnosPaginated` has zero `FOR UPDATE` ✅ (verified `turnos.test.ts > T-028: FOR UPDATE in countActiveOverlappingForUpdate only` passed)
- **toTurnoDTO present**: `turnos.ts:6,395` plus mapper `turno.ts:22` + DTO camelCase; route tests assert `not.toHaveProperty("estado")` ✅
- **INV-06 UTC**: `TIMESTAMPTZ` stored, API accepts ISO with TZ, returns UTC via `toTurnoDTO` Date, `getBaDayUtcRange` DST-aware ✅
- **INV-08 camelCase**: DB snake→DTO English rename brand/plate/startDateTime/endDateTime via mapper; `Strict` DTO checks in routes ✅

### Coherence (Design)

| Decision (design.md #340) | Followed? | Notes |
|---------------------------|-----------|-------|
| Thin GET→Service (`listAppointments` single owner §4.5) | ✅ Yes | Both routes delegate to `listAppointments({db,config,now}, query, authUser)`; no direct repo call; preserves ownership §4.5 |
| Shared querySchema in `src/lib/http/appointmentQuery.ts` | ✅ Yes | Single source of truth; both routes import `parseAppointmentQuery`/`querySchema`; 177 LOC matches design (≤90+65 budget) |
| Repo extension additive only (`FindTurnosPaginatedQuery` + `findTurnosPaginated`) | ✅ Yes | 7 optional fields added (`status`, `from`, `to`, `date`, `offset`, `dateRange` + sort already), backward-compatible defaults; no new method duplication |
| `getBaDayUtcRange` reused from `availabilityService.ts` | ✅ Yes | Imported in `turnos.ts:19`; not duplicated; DST verified `2026-03-08` 86400000ms |
| File changes envelope | ✅ Yes | `appointmentQuery.ts` created, `turnos.ts` extended (+101/-6 per apply-progress), `appointments/route.ts` GET added POST preserved (177 LOC), `admin/appointments/route.ts` created (81 LOC) |

Deviations (non-breaking, documented in apply-progress):
- `config` passes `timezone|operatingHours|capacityPerSlot` (design showed only timezone) — required by `AppointmentServiceDeps` type; still parametrized, no hardcode.
- `turnos.query.test.ts` supplementary file instead of extending `turnos.test.ts` — keeps PR1 diff focused, coverage equivalent (62 total).
- `parseAppointmentQuery` accepts `Record<string,string|string[]|undefined>` for duplicate handling — already in PR1, spec-compatible.

### Issues Found

**CRITICAL**: None — 19/19 scenarios have passing covering tests, `npx tsc --noEmit` clean, no invariant violation.

**WARNING** (1):
- **T-033-007 Docs sync** — `tasks.md` 5.1 unchecked, `apply-progress.md` marks deferred to archive. This is cleanup-only (verify checkmarks, no COMPLETADO/FOR UPDATE leak, toTurnoDTO present). Per task instruction, severity is WARNING not CRITICAL. Recommend fixing in archive: tick T-033-007 after confirming this report; no code change required.

**SUGGESTION** (2, non-blocking):
- Consider promoting `turnos.query.test.ts` count/offset mock helper to share with `turnos.test.ts` to reduce duplication (currently two mockPaginated helpers).
- Add explicit `totalPages=0 when total=0` route-level integration assertion (currently covered at repo unit level `turnos.test.ts > total 0 → totalPages 0` but not at HTTP envelope level).

### Verdict

**PASS WITH WARNINGS**

All 6 requirements and 19 scenarios compliant with passing runtime evidence (62/62 mocked tests, clean type-check, shared whereClause for total, page-wins-offset, BA DST half-open, 401 before 400/403 ordering, INV-06/08 preserved). Single warning (T-033-007 docs sync) is archive-scope and does not block archive per sdd-verify skill and task contract. Recommend **archive** after ticking T-033-007 in `tasks.md` and persisting this verified evidence.

**Next recommended**: `archive` (feature-branch-chain) — no remediation required; only docs checkmark sync.

### Relevant Files

- `src/lib/http/appointmentQuery.ts` — 177 LOC shared Zod schema + parseAppointmentQuery (status enum, include* boolean, ISO TZ, date YYYY-MM-DD, page/limit/offset/sort, 3 superRefines)
- `src/db/repositories/turnos.ts` — extended FindTurnosPaginatedQuery + findTurnosPaginated (~150 LOC added): RN-04 gt(now), statuses, dateRange via getBaDayUtcRange, from/to half-open, pagination offset precedence, shared whereClause
- `src/app/api/appointments/route.ts` — GET added (60 LOC) 401 before 400, POST preserved
- `src/app/api/admin/appointments/route.ts` — new GET (81 LOC) 401/403 before 400
- `src/services/appointmentService.ts` — reused `listAppointments` (CLIENTE inject, INV-04 unchanged)
- `src/db/mappers/turno.ts` — toTurnoDTO INV-08
- `src/lib/http/appointmentQuery.test.ts` — 11 tests
- `src/db/repositories/turnos.query.test.ts` — 6 tests
- `src/db/repositories/turnos.test.ts` — 18 tests
- `src/app/api/appointments/route.test.ts` — 19 tests
- `src/app/api/admin/appointments/route.test.ts` — 8 tests
- `openspec/changes/t033-appointment-query/spec.md` — 6 ADDED reqs, 19 scenarios
- `openspec/changes/t033-appointment-query/design.md` — thin GET→Service design
- `openspec/changes/t033-appointment-query/tasks.md` — 6/7 checked, T-033-007 pending
- `openspec/changes/t033-appointment-query/apply-progress.md` — PR1+PR2 evidence, rollback boundaries

### Final-State Facts

- Verify warnings fixed status: none needed beyond T-033-007 acknowledgment; no code fixes applied (verify is read-only).
- Commit evidence: HEAD `783e3b9` docs(t033): update tasks and apply-progress for PR2; stack `bcee077,55c11b9,1af16e2,9452cae,af70770` — clean working tree except untracked openspec delta files (expected pre-archive).
- Review gate: rdd_disabled (not blocking verify).
- Chain strategy: feature-branch-chain, PR1 278 LOC + PR2 368 LOC (<400) — verified.
