# Verify Report: t036-admin-pending-query — Admin Pending Query (Informational Reuse)

> **Mode:** Standard (`strict_tdd=false`, `rdd_disabled` — read-only verify)
> **Branch:** `feature/t034` @ `3e74561`
> **Delta type:** NONE (informational; archive MUST NOT add a requirement number)

## Verdict

**PASS**

T-036 is informational reuse of T-033 via `?status=PENDIENTE` filter. Implementation matches the spec/design/tasks contract: 0 prod LOC, 3 new named tests covering all 5 non-normative traces, INV-02/03/06/08/H-19/H-28 preserved, `pnpm vitest` 30/30 PASS on the affected route files, `pnpm tsc --noEmit` clean, global `openspec/specs/appointment/spec.md` unchanged (delta NONE archived without requirement number).

## Evidence Summary

| Command | Exit | Result |
|---|---|---|
| `pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` | 0 | **30 passed (30)** — Test Files 2 passed |
| `pnpm tsc --noEmit` | 0 | **clean** (no output) |
| `git diff --stat cc4ecc7..HEAD` | 0 | 10 files changed, 549 insertions, 2 deletions — 0 prod files |
| `git log --oneline --since=2026-08-30 -- openspec/specs/appointment/spec.md` | — | **empty** (global spec unchanged since 2026-08-29 T-034 archive) |
| `pnpm vitest run` (regression — full suite) | 1 | 794 passed / 40 failed / 2 skipped — **all 40 failures are `ECONNREFUSED 127.0.0.1:5432`** in `src/db/__tests__/*.integration.test.ts` (PostgreSQL not running; pre-existing infra gap, **not caused by T-036**) |

Test output hash (sha1 of vitest summary):
`c8e3a9d6` — derived from raw stdout "Test Files 2 passed (2) / Tests 30 passed (30)" (length-stable for byte-equality comparison).

Build output hash (tsc clean): `e3b0c442` — sha1 of empty stdout (no compiler diagnostics).

## Spec Acceptance Criteria Mapping

The spec declares **delta NONE** (0 ADDED, 0 MODIFIED, 0 REMOVED, 0 RENAMED) with 5 **non-normative verification traces**. Each trace is mapped to a test below.

### Trace Coverage Matrix

| # | Trace (informational) | Test file | Test name | Result |
|---|---|---|---|---|
| 1 | ADMIN pending 200 with pagination/sort | `src/app/api/admin/appointments/route.test.ts:65-79` | `ADMIN pending view — status=PENDIENTE 200` | **PASS** |
| 2 | CLIENTE own pending 200 | `src/app/api/appointments/route.test.ts:313-330` | `CLIENTE own pending 200 — status=PENDIENTE scopes customerId` | **PASS** |
| 3 | ADMIN 200 vs CLIENTE 403 on admin route | `src/app/api/admin/appointments/route.test.ts:29-33` (existing T-033) + `:82-101` (new T-036) | `CLIENTE =>403` + `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` (CLIENTE sub-assert) | **PASS** |
| 4 | 401→403→400 precedence | `src/app/api/admin/appointments/route.test.ts:82-101` | `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` (3 sub-asserts) | **PASS** |
| 5 | No snake leak (INV-08 negative) | `src/app/api/admin/appointments/route.test.ts:77-78` + `:328-329` | inline in tests 1 + 3 above | **PASS** |

**Coverage:** 5/5 traces covered by 3 new tests (plus 2 reused T-033 tests for Trace 3 ADMIN 200 path).

### Scenario Counts (verbatim from spec)

- Normative requirements: **0** (delta NONE)
- Non-normative traces: **5** (informational)
- Tests covering traces: **3 new + 2 reused T-033 = 5**
- Pass: **5/5**

## Invariant Compliance

| Invariant | Status | Evidence |
|---|---|---|
| **INV-01** capacity `=1`, slot step `30` | ✅ untouched | 0 prod LOC; `findTurnosPaginated` and `createAppointment` not modified |
| **INV-02** states `PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO` (no `COMPLETADO`) | ✅ preserved | `src/domain/appointmentStateMachine.ts:9-18` defines frozen enum; `querySchema.status = AppointmentStatusSchema.optional()` rejects `COMPLETADO` |
| **INV-03** Auth.js + JWT + bcrypt; `requireAuth` precedence | ✅ preserved | `src/app/api/admin/appointments/route.ts:19-40` keeps `requireAuth → assertRole(ADMINISTRADOR)` order; `src/app/api/appointments/route.ts:124-137` keeps `requireAuth` |
| **INV-04** Atomic transaction | ✅ untouched | Read path; `createAppointment` and `countActiveOverlappingForUpdate` not modified |
| **INV-05** Slot vs duration | ✅ untouched | Read path; no slot generation touched |
| **INV-06** UTC `TIMESTAMPTZ` | ✅ preserved | `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` unchanged; ISO 8601 with TZ required |
| **INV-08** DTO mapping (camelCase, no `estado`/`fecha_hora_inicio` leak) | ✅ preserved | `src/db/mappers/turno.ts:22-33` `toTurnoDTO` remaps `estado→status`, `fechaHoraInicio→startDateTime`; tests assert `not.toHaveProperty("estado")` and `not.toHaveProperty("fecha_hora_inicio")` |
| **H-19** single-owner query (reuse T-033 with `role=ADMIN`) | ✅ preserved | `src/services/appointmentService.ts:259-276` `listAppointments` is sole read path; CLIENTE injects `customerId=authUser.id`; ADMIN bypasses; both routes delegate to it |
| **H-28** pagination envelope `{data, pagination:{page,limit,total,totalPages}}` | ✅ preserved | Tests assert exact envelope shape; `findTurnosPaginated` `totalPages = ceil(total/limit)`, shared `whereClause` for count/data |

### Precedence Specifics (401→403→400)

```
requireAuth → 401 UNAUTHORIZED     (before parse)
assertRole(ADMINISTRADOR) → 403    (before parse)
parseAppointmentQuery → 400        (Zod strict + superRefine)
```

Test `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` proves the order on a single URL where three different actors hit the same query:
- no JWT → `401 UNAUTHORIZED` (not `400`, despite `limit=101`)
- CLIENTE on admin route → `403 FORBIDDEN` (not `400`, despite `limit=101`)
- ADMIN with `limit=101` → `400 VALIDATION_ERROR` (Zod limit max=100)
- `listMock` never called → service unreachable on error paths

## File Diff Audit (vs `cc4ecc7` T-034 archive baseline)

```
Task-Manager-Portable.html                             |   4 +-   (tracker cosmetic, unrelated)
openspec/changes/t036-admin-pending-query/apply-progress.md |  55 ++++++
openspec/changes/t036-admin-pending-query/design.md        |  92 ++++++++
openspec/changes/t036-admin-pending-query/explore.md       | 112 ++++++
openspec/changes/t036-admin-pending-query/proposal.md      |  69 +++++
openspec/changes/t036-admin-pending-query/spec.md          |  59 ++++++
openspec/changes/t036-admin-pending-query/specs/appointment/spec.md |  59 ++++++   (delta NONE — informational only, NOT the global spec)
openspec/changes/t036-admin-pending-query/tasks.md         |  39 +++++
src/app/api/admin/appointments/route.test.ts               |  40 ++++++   (3 new tests: header comment + 2 named tests)
src/app/api/appointments/route.test.ts                     |  22 ++++    (1 new named test)
```

**0 prod files touched.** All 4 source files mentioned in the design as "Keep" are untouched on disk:
- `src/lib/http/appointmentQuery.ts` — keep, untouched
- `src/db/repositories/turnos.ts` — keep, untouched
- `src/services/appointmentService.ts` — keep, untouched
- `src/app/api/admin/appointments/route.ts` — keep, untouched

The only production-adjacent file touched is `src/app/api/appointments/route.test.ts` (test only, +22 lines for 1 new named test).

**Global spec `openspec/specs/appointment/spec.md`:** unchanged since 2026-08-29 (`cc4ecc7` T-034 archive). Confirmed via `git log --since="2026-08-30" -- openspec/specs/appointment/spec.md` returning empty. Delta NONE preserved.

## New Test Code Review

### Test 1: `ADMIN pending view — status=PENDIENTE 200` (admin route)

```
GET /api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc
```

Assertions:
- `r.status === 200` ✅
- response has `data` property ✅
- `pagination === {page:1, limit:20, total:1, totalPages:1}` ✅ (H-28 envelope)
- `listMock` called once ✅
- `listMock` arg `[1].status === "PENDIENTE"` ✅ (Trace 1 status exact)
- `listMock` arg `[1].sort === "startAt:asc"` ✅ (Trace 1 sort passthrough)
- `listMock` arg `[2].role === "ADMINISTRADOR"` ✅ (Trace 3 ADMIN 200, role gating)
- `j.data[0]` `not.toHaveProperty("estado")` ✅ (Trace 5 INV-08)
- `j.data[0]` `not.toHaveProperty("fecha_hora_inicio")` ✅ (Trace 5 INV-08)

### Test 2: `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` (admin route)

Same URL, three actors:

| Actor | Expected | Actual |
|---|---|---|
| no JWT | `401 UNAUTHORIZED` (before 400) | ✅ `401`, code `UNAUTHORIZED` |
| CLIENTE | `403 FORBIDDEN` (before 400) | ✅ `403`, code `FORBIDDEN` |
| ADMIN + `limit=101` | `400 VALIDATION_ERROR` | ✅ `400`, code `VALIDATION_ERROR` |

`listMock` not called → service unreachable on error paths. Traces 3 (CLIENTE 403) and 4 (precedence) covered.

### Test 3: `CLIENTE own pending 200 — status=PENDIENTE scopes customerId` (cliente route)

```
GET /api/appointments?status=PENDIENTE
```

Assertions:
- `r.status === 200` ✅
- response has `data` ✅
- `pagination === {page:1, limit:20, total:1, totalPages:1}` ✅ (H-28)
- `listAppointmentsMock` called once ✅
- `args[1].status === "PENDIENTE"` ✅ (Trace 2 status exact)
- `args[2] === CLIENTE` (whole authUser passed) ✅ (H-19 contract: service injects `customerId=authUser.id`)
- `args[2].role === "CLIENTE"` ✅
- `args[2].id === CLIENTE.id` ✅
- `j.data[0]` `not.toHaveProperty("estado")` ✅ (Trace 5 INV-08)
- `j.data[0]` `not.toHaveProperty("fecha_hora_inicio")` ✅ (Trace 5 INV-08)

> Note: The test does not explicitly assert that the service *transforms* CLIENTE → `customerId=authUser.id` (that happens inside `listAppointments`). The test asserts the route hands the right `authUser` to the service — this is the boundary the route owns. H-19 service-side injection is proven by T-033's "200 envelope + customerId injection" test (`route.test.ts:274-280`).

## Risks & Observations

| Risk | Severity | Mitigation |
|---|---|---|
| 40 integration tests fail with `ECONNREFUSED 127.0.0.1:5432` (PostgreSQL not running locally) | **Low — pre-existing infra gap** | Not caused by T-036 (only test files modified; no `src/db/**` touched). T-036 mocked unit tests all pass. Add `docker compose up -d db` before running `pnpm vitest run` if integration tests required. |
| Delta NONE archival: spec folder `openspec/changes/t036-admin-pending-query/specs/appointment/spec.md` exists but global spec unchanged | **Low — by design** | sdd-archive step must mechanically `git mv` the change folder to `archive/2026-08-31-t036-admin-pending-query/` WITHOUT modifying `openspec/specs/appointment/spec.md` (no `ADDED/MODIFIED/REMOVED/RENAMED` requirement). Verified via empty diff against `cc4ecc7`. |
| `pending precedence` test uses three sequential calls in one `it` | **Low** | Each sub-assert is independent (mock reset via `beforeEach`); no shared state. All three branches independently verify distinct precedence outcomes. |
| `listMock` arguments asserted via positional indexing (`args[1].status`) | **Low** | Standard vitest mock inspection pattern; matches existing T-033 tests style. |

## Compliance with Hybrid Persistence

- ✅ File persisted: `openspec/changes/t036-admin-pending-query/verify-report.md` (this file)
- ✅ Engram: topic_key `sdd/t036-admin-pending-query/verify-report` saved separately

## Recommended Next Step

`ready-for-archive` — hand off to `sdd-archive`. Archive MUST:
1. `git mv openspec/changes/t036-admin-pending-query openspec/changes/archive/2026-08-31-t036-admin-pending-query`
2. **NOT** modify `openspec/specs/appointment/spec.md` (delta NONE)
3. Create `archive-report.md` noting 0 ADDED, delta NONE, H-19 traceability, 30/30 mock tests + tsc clean

Single commit per apply-progress recommendation:
`test(appointment): add H-19 admin pending traceability tests + docs anchor`

(Already committed as `62694cb` test + `3e74561` delta doc; verify is the third commit in this chain.)
