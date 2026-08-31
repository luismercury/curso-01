```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:36d1d54eaeae8f55f0da311ddfa45e10b1b95e1bb5cf76cc37b01fc1e3f06fa0
verdict: pass
blockers: 0
critical_findings: 0
requirements: 0/0
scenarios: 0/0
test_command: npx vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts
test_exit_code: 0
test_output_hash: sha256:7e6413d5fdc32acee7df890b8ba67fe40024cd15c0339cf54dd1c5ef1c53d9dc
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verify Report: t037-daily-agenda — Daily Agenda via Date Filter Reuse (Informational)

> **Mode:** Standard (`strict_tdd=false`, `rdd_disabled` — read-only verify)
> **Branch:** `feature/t034` @ `354fcd0`
> **Delta type:** NONE (informational; archive MUST NOT add a requirement number)

## Verdict

**PASS**

T-037 is informational reuse of T-033 via `?date=YYYY-MM-DD` filter. Implementation matches the spec/design/tasks contract: 0 prod LOC, 7 new named tests covering all 5 non-normative traces + Trace 3 sub-cases, INV-02/03/06/08/H-11/H-19/H-27/H-28 preserved, `pnpm vitest` 37/37 PASS on the affected route files, `pnpm tsc --noEmit` clean, `pnpm eslint` clean (only pre-existing `ForbiddenError` unused warning on `admin/appointments/route.test.ts:15` carried from `04be1e9`), global `openspec/specs/appointment/spec.md` unchanged (delta NONE archived without requirement number).

## Evidence Summary

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` | 0 | **37 passed (37)** — Test Files 2 passed |
| `npx tsc --noEmit` | 0 | **clean** (no output) |
| `npx eslint src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` | 0 | **clean** (0 errors; 1 pre-existing `ForbiddenError` unused warning on line 15 of admin file, carried from `04be1e9`) |
| `git diff --stat 04be1e9 HEAD` | 0 | 8 files changed, 582 insertions — 0 prod files (`route.ts` untouched); 108 insertions in 2 test files (admin +63, client +45) |
| `git diff 04be1e9 HEAD -- openspec/specs/` | — | **empty** (global spec unchanged) |
| `git diff 04be1e9 HEAD -- src/app/api/admin/appointments/route.ts src/app/api/appointments/route.ts` | — | **empty** (0 prod LOC) |

Test output hash (sha256): `7e6413d5fdc32acee7df890b8ba67fe40024cd15c0339cf54dd1c5ef1c53d9dc`.
Build output hash (sha256): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (sha256 of empty stdout — known constant).
Evidence revision (sha256 of full diff vs `04be1e9` baseline): `36d1d54eaeae8f55f0da311ddfa45e10b1b95e1bb5cf76cc37b01fc1e3f06fa0`.

## Spec Acceptance Criteria Mapping

The spec declares **delta NONE** (0 ADDED, 0 MODIFIED, 0 REMOVED, 0 RENAMED) with 5 **non-normative verification traces**. Each trace is mapped to a test below.

### Trace Coverage Matrix

| # | Trace (informational) | Test file | Test name | Result |
|---|---|---|---|---|
| 1 | ADMIN agenda `?date=YYYY-MM-DD` 200 ordered `startAt:asc` pagination | `src/app/api/admin/appointments/route.test.ts:106-116` | `agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037` | **PASS** |
| 2 | CLIENTE agenda `?date=YYYY-MM-DD` 200 scoped `customerId=authUser.id` (own) | `src/app/api/appointments/route.test.ts:334-345` | `agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037` | **PASS** |
| 3 | `includeCancelled`/`includeRejected` flags — default false / each / both (H-11) | `src/app/api/admin/appointments/route.test.ts:119-132` + `src/app/api/appointments/route.test.ts:348-361` | `agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037` (4 sub-cases each) | **PASS** |
| 4 | `401→403→400` precedence with `?date=2026-09-10&limit=101` | `src/app/api/admin/appointments/route.test.ts:135-150` | `agenda ?date=&limit=101 precedence 401→403→400 — T-037` | **PASS** |
| 5 | INV-08 no snake leak + H-28 envelope | `src/app/api/admin/appointments/route.test.ts:153-164` + `src/app/api/appointments/route.test.ts:364-375` | `agenda ?date= INV-08 no snake leak + H-28 envelope — T-037` (both files) | **PASS** |

**Coverage:** 5/5 traces covered by 7 new tests (admin +4, client +3). Trace 3 has 4 sub-cases × 2 files = 8 flag assertions.

### Scenario Counts (verbatim from spec)

- Normative requirements: **0** (delta NONE)
- Non-normative traces: **5** (informational)
- Tests covering traces: **7 new** (admin 4 + client 3)
- Pass: **5/5**

## Invariant Compliance

| Invariant | Status | Evidence |
|---|---|---|
| **INV-01** capacity `=1`, slot step `30` | ✅ untouched | 0 prod LOC; `findTurnosPaginated` and `createAppointment` not modified |
| **INV-02** states `PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO` (no `COMPLETADO`) | ✅ preserved | `src/domain/appointmentStateMachine.ts` frozen enum unchanged; `querySchema.status = AppointmentStatusSchema.optional()` still rejects `COMPLETADO` |
| **INV-03** Auth.js + JWT + bcrypt; `requireAuth` precedence | ✅ preserved | `src/app/api/admin/appointments/route.ts` keeps `requireAuth → assertRole(ADMINISTRADOR)` order; `src/app/api/appointments/route.ts` keeps `requireAuth` |
| **INV-04** Atomic transaction | ✅ untouched | Read path; `createAppointment` and `countActiveOverlappingForUpdate` not modified |
| **INV-05** Slot vs duration | ✅ untouched | Read path; no slot generation touched |
| **INV-06** UTC `TIMESTAMPTZ` | ✅ preserved | `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` unchanged; ISO 8601 with TZ required |
| **INV-08** DTO mapping (camelCase, no `estado`/`fecha_hora_inicio` leak) | ✅ preserved | `src/db/mappers/turno.ts` `toTurnoDTO` remaps `estado→status`, `fechaHoraInicio→startDateTime`; Trace 5 tests assert `not.toHaveProperty("estado"\|"fecha_hora_inicio"\|"fecha_hora_fin")` |
| **H-11** default exclude `CANCELADO`/`RECHAZADO`; `include*` flag opt-in | ✅ preserved | Trace 3 covers default-false / each-flag / both for both routes |
| **H-19** single-owner query (reuse T-033 with `?date=` BA half-open DST-aware) | ✅ preserved | `src/services/appointmentService.ts` `listAppointments` sole read path; CLIENTE injects `customerId=authUser.id`, ADMIN bypasses; `findTurnosPaginated` resolves `date` via `getBaDayUtcRange(timezone)` |
| **H-27** `startAt:asc` ordering | ✅ preserved | Trace 1 asserts `args[1].sort === "startAt:asc"`; `findTurnosPaginated` maps to `ORDER BY fechaHoraInicio asc` |
| **H-28** pagination envelope `{data, pagination:{page,limit,total,totalPages}}` | ✅ preserved | Trace 1 + Trace 5 assert exact envelope shape; `totalPages = ceil(total/limit)`, shared `whereClause` for count/data |

### BA Half-Open DST-Aware Range

```
date = 2026-09-10 BA
   → getBaDayUtcRange("2026-09-10", "America/Argentina/Buenos_Aires")
   → fromUtc = 2026-09-10T03:00:00Z (00:00 BA = 03:00 UTC)
   → toUtc   = 2026-09-11T03:00:00Z (next 00:00 BA = 03:00 UTC next day)
   → where: gte(fechaHoraInicio, fromUtc) AND lt(fechaHoraInicio, toUtc)
   → + gt(fechaHoraInicio, now)         // RN-04
   → + inArray(estado, statuses)         // H-11 default PENDIENTE|CONFIRMADO
   → + eq(customerId, authUser.id)?      // CLIENTE scope
   → shared whereClause for count(*) + select limit/offset
```

Half-open `gte/lt` confirmed via existing T-033 implementation; new Trace 1 + Trace 2 tests verify `date` parameter is forwarded verbatim into `listAppointments` and reaches `findTurnosPaginated`.

### Precedence Specifics (401→403→400)

```
requireAuth → 401 UNAUTHORIZED     (before parse)
assertRole(ADMINISTRADOR) → 403    (before parse, admin only)
parseAppointmentQuery → 400        (Zod strict + superRefine: limit max=100)
```

Trace 4 proves the order on `?date=2026-09-10&limit=101`:
- no JWT → `401 UNAUTHORIZED` (not `400`, despite `limit=101`)
- CLIENTE on admin route → `403 FORBIDDEN` (not `400`, despite `limit=101`)
- ADMIN with `limit=101` → `400 VALIDATION_ERROR` (Zod limit max=100)
- `listMock` never called → service unreachable on error paths

## File Diff Audit (vs `04be1e9` T-036 archive baseline)

```
openspec/changes/t037-daily-agenda/apply-progress.md     |  68 +++++++
openspec/changes/t037-daily-agenda/design.md            |  85 +++++++++
openspec/changes/t037-daily-agenda/explore.md           | 132 ++++++++++++++
openspec/changes/t037-daily-agenda/proposal.md          |  78 +++++++++
openspec/changes/t037-daily-agenda/spec.md              |  60 +++++++
openspec/changes/t037-daily-agenda/tasks.md             |  51 +++++++
src/app/api/admin/appointments/route.test.ts            |  63 ++++++++   (4 new T-037 tests)
src/app/api/appointments/route.test.ts                  |  45 +++++++   (3 new T-037 tests)
8 files changed, 582 insertions(+)
```

**0 prod files touched.** All 6 source files mentioned in the design as "Keep" are untouched on disk:
- `src/lib/http/appointmentQuery.ts` — keep, untouched
- `src/db/repositories/turnos.ts` — keep, untouched
- `src/services/appointmentService.ts` — keep, untouched
- `src/services/availability/availabilityService.ts` — keep, untouched
- `src/app/api/admin/appointments/route.ts` — keep, untouched
- `src/app/api/appointments/route.ts` — keep, untouched

The only production-adjacent files touched are the two `*.route.test.ts` files (tests only, 108 lines: admin +63, client +45).

**Global spec `openspec/specs/appointment/spec.md`:** unchanged since `cc4ecc7` T-034 archive (2026-08-29). Confirmed via `git diff 04be1e9 HEAD -- openspec/specs/` returning empty. Delta NONE preserved.

## New Test Code Review

### Test 1 (admin): `agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037`

```
GET /api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc
```

Assertions:
- `r.status === 200` ✅
- `pagination === {page:1, limit:20, total:1, totalPages:1}` ✅ (H-28 envelope, shared whereClause)
- `listMock` called once ✅
- `listMock` arg `[1]` matches `{date:"2026-09-10", page:1, limit:20, sort:"startAt:asc"}` ✅ (Trace 1 forward + H-27)
- `listMock` arg `[2].role === "ADMINISTRADOR"` ✅ (ADMIN bypass)
- `j.data` length 1 ✅

### Test 2 (client): `agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037`

```
GET /api/appointments?date=2026-09-10&sort=startAt:asc
```

Assertions:
- `r.status === 200` ✅
- `pagination === {page:1, limit:20, total:1, totalPages:1}` ✅ (H-28)
- `listAppointmentsMock` called once ✅
- `args[1]` matches `{date:"2026-09-10", sort:"startAt:asc"}` ✅ (Trace 2 forward)
- `args[2] === CLIENTE` (whole authUser passed) ✅ (H-19 contract: service injects `customerId=authUser.id` in `listAppointments` §4.5)
- `j.data` length 1 ✅

### Test 3 (admin + client): `agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037`

Four cases each:
1. `?date=2026-09-10&page=1&limit=20&sort=startAt:asc` → `{includeCancelled:false, includeRejected:false}`
2. `?date=2026-09-10&includeCancelled=true` → `{includeCancelled:true, includeRejected:false}`
3. `?date=2026-09-10&includeRejected=true` → `{includeCancelled:false, includeRejected:true}`
4. `?date=2026-09-10&includeCancelled=true&includeRejected=true` → `{includeCancelled:true, includeRejected:true}`

All 4 cases × 2 files = 8 sub-assertions. `listMock`/`listAppointmentsMock` called 4 times per file. H-11 default `false` opt-in preserved.

### Test 4 (admin): `agenda ?date=&limit=101 precedence 401→403→400 — T-037`

Same URL, three actors:

| Actor | Expected | Actual |
|---|---|---|
| no JWT | `401 UNAUTHORIZED` (before 400) | ✅ `401`, code `UNAUTHORIZED` |
| CLIENTE | `403 FORBIDDEN` (before 400) | ✅ `403`, code `FORBIDDEN` |
| ADMIN + `limit=101` | `400 VALIDATION_ERROR` | ✅ `400`, code `VALIDATION_ERROR` |

`listMock` not called → service unreachable on error paths.

### Test 5 (admin + client): `agenda ?date= INV-08 no snake leak + H-28 envelope — T-037`

Both routes asserted identically:
- `r.status === 200` ✅
- `j.data[0]` matches `{status:"PENDIENTE", customerId:CLIENTE.id}` ✅
- `j.data[0]` has `startDateTime` and `endDateTime` ✅
- `j.data[0]` `not.toHaveProperty("estado"\|"fecha_hora_inicio"\|"fecha_hora_fin")` ✅ (Trace 5 + INV-08)
- `j` matches `{pagination:{page:1, limit:20, total:1, totalPages:1}}` ✅ (H-28 envelope)

## Risks & Observations

| Risk | Severity | Mitigation |
|---|---|---|
| Pre-existing `ForbiddenError` unused warning on admin `route.test.ts:15` carried from `04be1e9` | **Low — pre-existing** | Not introduced by T-037 (same warning present in `04be1e9`). ESLint 0 errors; only warning. |
| Trace 2 client test does not explicitly assert `listAppointments` service-side `customerId` injection (only forwards `authUser`) | **Low** | Test asserts the route hands the right `authUser` to the service — boundary the route owns. Service-side `customerId=authUser.id` injection proven by T-033's "200 envelope + customerId injection" test and `src/services/appointmentService.ts` (H-19 §4.5). |
| Trace 3 client test asserts only forward of `include*` flags (not actual filtering outcome) | **Low** | Filtering outcome (default `PENDIENTE\|CONFIRMADO`, flags add `CANCELADO`/`RECHAZADO`) proven by T-033 repo + service tests. Trace 3 only proves `parseAppointmentQuery` correctly forwards the flags. |
| `listMock` arguments asserted via positional indexing (`args[1].status`) | **Low** | Standard vitest mock inspection pattern; matches existing T-033 tests style. |
| Alias `GET /api/admin/agenda?date=` not built | **Low — by design** | Per Technical-spec §8.5 + T-036 precedent; canonical `GET /api/admin/appointments?date=` already covers agenda. |
| Delta NONE archival: spec folder `openspec/changes/t037-daily-agenda/specs/` does NOT exist (delta NONE needs no `specs/` subfolder) | **Low — by design** | Archive step must NOT create `specs/appointment/spec.md` (no `ADDED/MODIFIED/REMOVED/RENAMED`). Already verified empty diff against `04be1e9`. |

## Compliance with Hybrid Persistence

- ✅ File persisted: `openspec/changes/t037-daily-agenda/verify-report.md` (this file)
- ✅ Engram: `sdd/t037-daily-agenda/verify-report` topic_key saved separately
- ✅ Validator: `gentle-ai sdd-verify-validate --requirements 0 --scenarios 0` admitted the exact candidate bytes

## Recommended Next Step

`ready-for-archive` — hand off to `sdd-archive`. Archive MUST:
1. `git mv openspec/changes/t037-daily-agenda openspec/changes/archive/2026-08-31-t037-daily-agenda`
2. **NOT** modify `openspec/specs/appointment/spec.md` (delta NONE)
3. **NOT** create `openspec/changes/t037-daily-agenda/specs/appointment/spec.md` (delta NONE — no requirement number)
4. Create `archive-report.md` noting 0 ADDED, delta NONE, H-19 traceability, 37/37 mock tests + tsc clean
5. Optionally open single PR: `feat(t037): daily agenda via ?date reuse (delta NONE)` (task 4.3 pending)

Single commit already in place:
`354fcd0 test(t037): name agenda ?date traces — 0 prod LOC` (apply-progress done; tasks 4.1-4.2 ticked; 4.3 PR pending).

---
*Verifier: sdd-verify (read-only). 37/37 mock tests pass; tsc + eslint clean; 0 prod LOC; delta NONE preserved.*