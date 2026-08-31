# Archive Report: t037-daily-agenda

**Change**: `t037-daily-agenda` — T-037 Daily Agenda via Date Filter Reuse (Informational Reuse of T-033 via `?date=YYYY-MM-DD`)
**Archived to**: `openspec/changes/archive/2026-08-31-t037-daily-agenda/` (hybrid) + Engram `sdd/t037-daily-agenda/archive-report` (observation `#386`)
**Date**: 2026-08-31
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain
**Branch**: `master` @ `354fcd0` (1 commit ahead of T-036 archive baseline `04be1e9`)
**Review budget**: 400 lines — actual **108 lines test+docs** (37/37 PASS, +7 tests in `route.test.ts × 2`), **0 prod LOC**, single PR (no chain required)

---

## Executive Summary

T-037 is **already shipped by T-033** via filter reuse per H-19. Daily agenda = `GET /api/admin/appointments?date=YYYY-MM-DD` (ADMIN all) and `GET /api/appointments?date=YYYY-MM-DD` (CLIENTE own). Both routes share `querySchema` + `AppointmentService.listAppointments` (single owner, §4.5) + `findTurnosPaginated` with `getBaDayUtcRange` (BA half-open DST-aware). The change locked this contract with **7 new named traceability tests** covering **5 non-normative verification traces** (Trace 3 has 4 sub-cases × 2 files = 8 flag assertions), and `delta NONE` against the global spec. No endpoint, alias, schema, migration, or service was added.

**Final state at close** (per Final-State Authority hierarchy):

- Apply (`#383`, 2026-08-31 15:26:56) confirms **37/37 PASS** (was 30, +7 agenda traces), 108 insertions (admin +63, client +45), **0 prod LOC**, `npx tsc --noEmit` clean, `npx eslint` clean.
- Verify (`#385`, 2026-08-31 15:40:44) verdict **PASS**: 5/5 traces covered; `git diff 04be1e9 HEAD -- openspec/specs/` → **empty** (delta NONE preserved); `git diff 04be1e9 HEAD -- src/app/api/**/route.ts` → **empty** (0 prod LOC); INV-02/03/06/08 + H-11/H-19/H-27/H-28 all preserved.
- Task Completion Gate: Phases 1-3 (13 tasks) + 4.1 (tick success-criteria) + 4.2 (commit `354fcd0`) all `[x]`. **Task 4.3 (open single PR) intentionally left unchecked** — workflow follow-up outside archive scope. Apply-progress and verify-report prove implementation completeness. Orchestrator handoff explicitly authorized archive (`Ready to archive as informational reuse per H-19 (as T-036)`).
- No CRITICAL blockers; no WARNINGs introduced.

SDD cycle complete for T-037. **Single PR recommended**; ready for next change.

---

## Change Archived

**Change**: t037-daily-agenda
**Archived to**: `openspec/changes/archive/2026-08-31-t037-daily-agenda/` (hybrid)

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | **NONE** (no sync) | Delta NONE — global `openspec/specs/appointment/spec.md` **unchanged** since T-036 archive baseline `04be1e9`. Verified via `git diff 04be1e9 HEAD -- openspec/specs/` returning empty. Archive MUST NOT add a requirement number (per `openspec/changes/t037-daily-agenda/spec.md` line 3). |

The delta spec at `openspec/changes/t037-daily-agenda/spec.md` is preserved as-is inside the archive folder for traceability — it documents the 0 ADDED / 0 MODIFIED / 0 REMOVED / 0 RENAMED decision and the 5 non-normative traces. The `specs/appointment/` subfolder is empty (intentional — delta NONE has no delta file). It is **not** a delta to be merged into the global spec; it is informational.

### Archive Contents

| Artifact | Status | Notes |
|----------|--------|-------|
| `proposal.md` | ✅ (78 lines, 3507 bytes) | H-19 reuse lock, 3 capability table (none/trace-only), 2 alternatives rejected (alias/duplication), risk/rollback |
| `explore.md` | ✅ (132 lines, 22038 bytes) | Gap assessment, 3 approaches, recommended Approach 1 (pure reuse), H-19 cite, Open Questions |
| `spec.md` | ✅ (60 lines, 4509 bytes) | Delta NONE declaration, H-19 verbatim quote, evidence table of 5 existing requirements covering agenda view, 5 non-normative traces, ADDED/MODIFIED/REMOVED/RENAMED = None |
| `specs/appointment/` | ✅ (empty by design) | Empty per delta NONE — no ADDED/MODIFIED requirement to merge |
| `design.md` | ✅ (85 lines, 7258 bytes) | 0 LOC prod decision, 4 architecture decisions (shared querySchema, single owner, additive repo, reject alias), BA half-open DST-aware data flow precedence 401→403→400, file action table (all 6 prod files Keep), interfaces, testing strategy, threat matrix N/A |
| `tasks.md` | ✅ (51 lines, 4642 bytes, **13/16 complete, 4.3 deferred**) | Phase 1: 1.1-1.4 preflight; Phase 2: 2.1-2.5 named traces; Phase 3: 3.1-3.4 verifications; Phase 4: 4.1-4.2 done, 4.3 (open PR) intentionally deferred. Review workload forecast: `Low`, `No chain`, `Single PR` |
| `apply-progress.md` | ✅ (68 lines, 4082 bytes) | 13/13 implementation tasks done; files changed +108/-0 (route.test.ts × 2 only); verification evidence; INV/constraint compliance; next recommended step |
| `verify-report.md` | ✅ (179 lines, 15341 bytes) | **PASS** verdict; evidence table (vitest 37/37, tsc clean, git diff empty on global spec, 5/5 traces covered); invariant compliance INV-02/03/06/08/H-11/H-19/H-27/H-28; file diff audit (0 prod files touched); new test code review with assertions; risks & observations; recommended next step |
| `archive-report.md` | ✅ (this file) | Additive-only — created during archive, excluded from mechanical diff readback |

**Mechanical archive verification (MANDATORY per Mechanical Copy Contract):**

```
diff -r (PowerShell SHA-256 hash-equivalent on Windows):
  Snapshot path: <temp>/sdd-archive-snap-<id>/t037-daily-agenda
  Destination path: openspec\changes\archive\2026-08-31-t037-daily-agenda
  Files in snapshot: 7
  Files in destination: 7
  EMPTY DIFF — PASS: byte-identical (7/7 files match)
  Empty specs/appointment/ dir preserved: snapshot=True dest=True
```

Move mechanism: `git mv openspec/changes/t037-daily-agenda openspec/changes/archive/2026-08-31-t037-daily-agenda` succeeded for all 6 originally tracked files (git status shows `R` renames staged); `verify-report.md` was untracked at move time but moved physically into the destination along with the OS-level directory rename. Source directory removed cleanly.

Per-file SHA-256 manifest (snapshot == destination):

| File | Bytes | SHA-256 (12 chars) |
|------|-------|---------------------|
| apply-progress.md | 4082 | `e9c35f3e786c` |
| design.md | 7258 | `dd22e7efeca3` |
| explore.md | 22038 | `fd04bd135f75` |
| proposal.md | 3507 | `2cbc2b3633f2` |
| spec.md | 4509 | `63b69a6cde62` |
| tasks.md | 4642 | `904d9fc7d37a` |
| verify-report.md | 15341 | `e56eefe3899a` |

Empty directory `specs/appointment/` preserved (snapshot exists, dest exists).

### Source of Truth

The following global artifacts are **unchanged** (delta NONE preserved):

- `openspec/specs/appointment/spec.md` — last touched T-036 archive baseline `04be1e9`; remains at 25 requirements (~54 scenarios); H-19 contract for single-owner query is already documented under `Query — Role Gating and Invariants`.

No spec sync required. No requirements added, modified, removed, or renamed. The 25 existing requirements (T-027..T-034) cover `?date=YYYY-MM-DD` end-to-end via the existing Date Calendar Filter, RN-04 Default Filter, Pagination Envelope, and Role Gating requirements.

### SDD Cycle Complete

The change has been fully planned, implemented (verified by traceability tests), verified (PASS), and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `master` @ `354fcd0` (1 commit ahead of T-036 archive baseline `04be1e9`):

| Commit | Subject | LOC | Type |
|--------|---------|-----|------|
| `354fcd0` | test(t037): name agenda ?date traces — 0 prod LOC | +108 tests | Work-unit tests |
| `verify-report.md` | (untracked at archive time) | docs only | PASS evidence |

`git diff --stat 04be1e9..HEAD` totals per verify-report §File Diff Audit: **8 files changed, 582 insertions** — but the 6 doc files (proposal/spec/design/explore/tasks/apply-progress) are SDD artifacts; only **2 test files** carry implementation:

```
src/app/api/admin/appointments/route.test.ts       |  63 ++++++++   (4 new T-037 tests)
src/app/api/appointments/route.test.ts             |  45 +++++++   (3 new T-037 tests)
```

**0 prod files touched.** The six production-adjacent files mentioned in design as "Keep" are untouched on disk:

- `src/lib/http/appointmentQuery.ts` — keep, untouched
- `src/db/repositories/turnos.ts` — keep, untouched
- `src/services/appointmentService.ts` — keep, untouched
- `src/services/availability/availabilityService.ts` — keep, untouched
- `src/app/api/admin/appointments/route.ts` — keep, untouched
- `src/app/api/appointments/route.ts` — keep, untouched

### Verification — Build & Tests

**Build**: ✅ `npx tsc --noEmit` → exit 0, empty output (hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` sha256 — empty stdout known constant)

**Tests (affected route files)**: ✅ **37/37 PASS** on `src/app/api/admin/appointments/route.test.ts` + `src/app/api/appointments/route.test.ts` (was 30/30 baseline, +7 new agenda tests). Test output hash: `7e6413d5fdc32acee7df890b8ba67fe40024cd15c0339cf54dd1c5ef1c53d9dc` sha256.

**Global spec regression check**: ✅ `git diff 04be1e9 HEAD -- openspec/specs/` → empty. Delta NONE preserved.

**Prod LOC regression check**: ✅ `git diff 04be1e9 HEAD -- src/app/api/admin/appointments/route.ts src/app/api/appointments/route.ts` → empty. 0 prod LOC.

**Linter**: ✅ `npx eslint` on both test files → 0 errors. Only pre-existing `ForbiddenError` unused warning on `admin/appointments/route.test.ts:15` carried from `04be1e9`.

### Test Traceability Matrix (5/5 PASS, 7 new tests)

| # | Trace (informational) | Test file | Test name | Status |
|---|---|---|---|---|
| 1 | ADMIN agenda `?date=YYYY-MM-DD` 200 ordered `startAt:asc` pagination | `src/app/api/admin/appointments/route.test.ts:106-116` | `agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (H-27+H-28) — T-037` | ✅ PASS |
| 2 | CLIENTE agenda `?date=YYYY-MM-DD` 200 scoped `customerId=authUser.id` (own) | `src/app/api/appointments/route.test.ts:334-345` | `agenda ?date=YYYY-MM-DD 200 scoped customerId own — T-037` | ✅ PASS |
| 3 | `includeCancelled`/`includeRejected` flags — default false / each / both (H-11) | `src/app/api/admin/appointments/route.test.ts:119-132` + `src/app/api/appointments/route.test.ts:348-361` | `agenda ?date= includeCancelled/includeRejected default false then each flag then both — H-11 — T-037` (4 sub-cases × 2 files = 8 flag assertions) | ✅ PASS |
| 4 | `401→403→400` precedence with `?date=2026-09-10&limit=101` | `src/app/api/admin/appointments/route.test.ts:135-150` | `agenda ?date=&limit=101 precedence 401→403→400 — T-037` (3 sub-asserts) | ✅ PASS |
| 5 | INV-08 no snake leak + H-28 envelope | `src/app/api/admin/appointments/route.test.ts:153-164` + `src/app/api/appointments/route.test.ts:364-375` | `agenda ?date= INV-08 no snake leak + H-28 envelope — T-037` (both files) | ✅ PASS |

### Invariant Compliance (all preserved)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-01** capacity `=1`, slot step `30` | ✅ untouched | 0 prod LOC; `findTurnosPaginated` and `createAppointment` not modified |
| **INV-02** states `PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO` | ✅ preserved | `src/domain/appointmentStateMachine.ts` frozen enum unchanged; `querySchema.status = AppointmentStatusSchema.optional()` still rejects `COMPLETADO` |
| **INV-03** Auth.js + JWT + bcrypt; `requireAuth` precedence | ✅ preserved | `src/app/api/admin/appointments/route.ts` keeps `requireAuth → assertRole(ADMINISTRADOR)` order; `src/app/api/appointments/route.ts` keeps `requireAuth` |
| **INV-04** Atomic transaction | ✅ untouched | Read path; `createAppointment` and `countActiveOverlappingForUpdate` not modified |
| **INV-05** Slot vs duration | ✅ untouched | Read path; no slot generation touched |
| **INV-06** UTC `TIMESTAMPTZ` | ✅ preserved | `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` unchanged; ISO 8601 with TZ required |
| **INV-08** DTO mapping (camelCase, no `estado`/`fecha_hora_inicio` leak) | ✅ preserved | `src/db/mappers/turno.ts` `toTurnoDTO` remaps `estado→status`, `fechaHoraInicio→startDateTime`; Trace 5 tests assert `not.toHaveProperty("estado"\|"fecha_hora_inicio"\|"fecha_hora_fin")` |
| **H-11** default exclude `CANCELADO`/`RECHAZADO`; `include*` flag opt-in | ✅ preserved | Trace 3 covers default-false / each-flag / both for both routes |
| **H-19** single-owner query (reuse T-033 with `?date=` BA half-open DST-aware) | ✅ preserved | `src/services/appointmentService.ts` `listAppointments` sole read path; CLIENTE injects `customerId=authUser.id`, ADMIN bypasses; `findTurnosPaginated` resolves `date` via `getBaDayUtcRange(timezone)` |
| **H-27** `startAt:asc` ordering | ✅ preserved | Trace 1 asserts `args[1].sort === "startAt:asc"`; `findTurnosPaginated` maps to `ORDER BY fechaHoraInicio asc` |
| **H-28** pagination envelope `{data, pagination:{page,limit,total,totalPages}}` | ✅ preserved | Trace 1 + Trace 5 assert exact envelope shape; `totalPages = ceil(total/limit)`, shared `whereClause` for count/data |

### BA Half-Open DST-Aware Range — confirmed

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

### Precedence Specifics (401→403→400) — proven by Trace 4

```
GET /api/admin/appointments?date=2026-09-10&limit=101
  no JWT       → 401 UNAUTHORIZED     (before 400, despite limit=101)
  CLIENTE      → 403 FORBIDDEN        (before 400, despite limit=101)
  ADMIN        → 400 VALIDATION_ERROR (Zod limit max=100)
  listMock     → never called on error paths (service unreachable)
```

Trace 4 asserts the order: no-JWT first hits `requireAuth → 401`, then `assertRole(ADMINISTRADOR) → 403` for CLIENTE on admin route, finally `parseAppointmentQuery → 400` for ADMIN with `limit=101`. Service unreachable on error paths (`listMock` never called).

---

## Engram Observation Trail (hybrid persistence)

The following observations were persisted to Engram topic_key `sdd/t037-daily-agenda/*` for the SDD cycle:

| Observation ID | Type | Title | Purpose |
|---|---|---|---|
| `#376` | architecture | Explore T-037 daily agenda reuse via date filter | Phase 0 explore |
| `#377` | architecture | sdd/t037-daily-agenda/proposal | Proposal intent |
| `#378` | architecture | sdd/t037-daily-agenda/spec (delta NONE) | Spec delta declaration |
| `#379` | architecture | Design t037-daily-agenda daily agenda reuse | Phase 4 design |
| `#380` | architecture | Tasks t037-daily-agenda daily agenda reuse (delta NONE) | Phase 5 task breakdown |
| `#381` | session_summary | Session summary: curso-01 (tasks session) | Session close |
| `#382` | architecture | Started t037-daily-agenda apply — preflight verified | Apply start |
| `#383` | architecture | Apply progress t037-daily-agenda — DONE 37/37 PASS 108 ins 0 prod LOC | Apply progress |
| `#384` | session_summary | Session summary: curso-01 (apply session) | Session close |
| `#385` | architecture | Verify t037-daily-agenda (delta NONE) — PASS 37/37 | Verify verdict |
| **`#386`** | **architecture** | **Archive t037-daily-agenda — informational reuse archived 0 ADDED** | **THIS REPORT** |

Archive topic_key: `sdd/t037-daily-agenda/archive-report`. Persisted to Engram before filesystem write.

---

## Risks & Observations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Pre-existing `ForbiddenError` unused warning on admin `route.test.ts:15` carried from `04be1e9` | **Low — pre-existing** | Not introduced by T-037 (same warning present in `04be1e9`). ESLint 0 errors; only warning. |
| Trace 2 client test does not explicitly assert `listAppointments` service-side `customerId` injection (only forwards `authUser`) | **Low** | Test asserts the route hands the right `authUser` to the service — boundary the route owns. Service-side `customerId=authUser.id` injection proven by T-033's "200 envelope + customerId injection" test and `src/services/appointmentService.ts` (H-19 §4.5). |
| Trace 3 client test asserts only forward of `include*` flags (not actual filtering outcome) | **Low** | Filtering outcome (default `PENDIENTE\|CONFIRMADO`, flags add `CANCELADO`/`RECHAZADO`) proven by T-033 repo + service tests. Trace 3 only proves `parseAppointmentQuery` correctly forwards the flags. |
| `listMock` arguments asserted via positional indexing (`args[1].status`) | **Low** | Standard vitest mock inspection pattern; matches existing T-033 tests style. |
| Alias `GET /api/admin/agenda?date=` not built | **Low — by design** | Per Technical-spec §8.5 + T-036 precedent; canonical `GET /api/admin/appointments?date=` already covers agenda. |
| Delta NONE archival: `specs/appointment/` subfolder exists but is empty | **Low — by design** | Per T-037 spec.md line 3, archive MUST NOT add a requirement number. Empty `specs/appointment/` confirms no delta file was created. |
| Task 4.3 (open single PR against `main`) intentionally unchecked in archived tasks.md | **Low — workflow follow-up** | Implementation tasks (Phases 1-3, 4.1, 4.2) all `[x]` and committed at `354fcd0`. 4.3 is a PR-open workflow action, not an implementation task. Apply-progress and verify-report prove all implementation work is complete (37/37 PASS, 108 insertions, 0 prod LOC). Orchestrator handoff explicitly authorized archive despite unchecked 4.3. Archive audit trail records the deferral here. |

---

## Next Recommended

`none — change closed`. SDD cycle complete for T-037. Next change may proceed (FASE 7+ per `implementation-plan.md` DAG).

---

*Archive: sdd-archive. Mechanical move via `git mv` succeeded. MANDATORY READBACK byte-identical (7/7 files + empty `specs/appointment/` dir). Global spec unchanged (delta NONE preserved). 37/37 tests + tsc clean. 0 prod LOC.*