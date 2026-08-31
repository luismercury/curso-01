# Archive Report: t036-admin-pending-query

**Change**: `t036-admin-pending-query` — T-036 Admin Pending Query (Informational Reuse of T-033 via `?status=PENDIENTE`)
**Archived to**: `openspec/changes/archive/2026-08-31-t036-admin-pending-query/` (hybrid) + Engram `sdd/t036-admin-pending-query/archive-report`
**Date**: 2026-08-31
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain
**Branch**: `master` @ `3e74561` (4 commits ahead of T-034 archive baseline `cc4ecc7`: `4e32c78` docs → `62694cb` test → `3e74561` delta doc; verify-report untracked)
**Review budget**: 400 lines — actual ~117 lines test+docs (3 new tests in `route.test.ts × 2`), **0 prod LOC**, single PR (no chain required)

---

## Executive Summary

T-036 is **already shipped by T-033** via filter reuse per H-19. Admin pending = `GET /api/admin/appointments?status=PENDIENTE`; CLIENTE own pending = `GET /api/appointments?status=PENDIENTE`. Both routes share `querySchema` + `AppointmentService.listAppointments` (single owner, §4.5) + `findTurnosPaginated`. The change locked this contract with **3 new named traceability tests** covering **5 non-normative verification traces**, an inline H-19 anchor header comment, and `delta NONE` against the global spec. No endpoint, alias, schema, migration, or service was added.

**Final state at close** (per Final-State Authority hierarchy):

- Tasks artifact `7/7 complete` (Phases 1-3: 1.1 ADMIN pending 200, 1.2 pending precedence 401→403→400, 1.3 CLIENTE own pending 200, 2.1 vitest 30/30, 2.2 tsc clean, 2.3 0 prod LOC confirmed, 3.1 H-19 anchor comment) — **Task Completion Gate PASS, no stale unchecked tasks**.
- Verify-report **PASS** authoritative: 5/5 traces covered by 3 new tests + 2 reused T-033 tests; `pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` → 30/30 PASS (was 27/27, +3 pending tests); `pnpm tsc --noEmit` → clean; `git diff cc4ecc7..HEAD -- openspec/specs/appointment/spec.md` → **empty** (delta NONE preserved); static checks confirm `findTurnosPaginated` + `listAppointments` + both routes untouched on disk; INV-02/03/06/08 + H-19 + H-28 all preserved.
- Pre-existing `40 integration test failures` from `ECONNREFUSED 127.0.0.1:5432` (PostgreSQL not running locally) are flagged as **Low — pre-existing infra gap, not caused by T-036** (only test files modified, no `src/db/**` touched). All T-036 mocked unit tests pass.
- No CRITICAL blockers; no WARNINGs.

SDD cycle complete for T-036. **Single PR recommended**; ready for next change.

---

## Change Archived

**Change**: t036-admin-pending-query
**Archived to**: `openspec/changes/archive/2026-08-31-t036-admin-pending-query/` (hybrid)

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | **NONE** (no sync) | Delta NONE — global `openspec/specs/appointment/spec.md` **unchanged** since 2026-08-29 T-034 archive baseline `cc4ecc7`. Verified via `git diff cc4ecc7..HEAD -- openspec/specs/appointment/spec.md` returning empty. Archive MUST NOT add a requirement number (per `openspec/changes/t036-admin-pending-query/spec.md` line 3). |

The delta spec at `openspec/changes/t036-admin-pending-query/specs/appointment/spec.md` is preserved as-is inside the archive folder for traceability — it documents the 0 ADDED / 0 MODIFIED / 0 REMOVED / 0 RENAMED decision and the 5 non-normative traces. It is **not** a delta to be merged into the global spec; it is informational.

### Archive Contents

| Artifact | Status | Notes |
|----------|--------|-------|
| `proposal.md` | ✅ (69 lines) | H-19 reuse lock, 3 capability table (none/trace-only), 2 alternatives rejected (alias/duplication), risk/rollback |
| `explore.md` | ✅ (112 lines) | Gap assessment, 3 approaches, recommended Approach 1 (pure reuse), H-19 cite, Open Questions |
| `spec.md` | ✅ (59 lines) | Delta NONE declaration, H-19 verbatim quote, evidence table of 5 existing requirements covering pending view, 5 non-normative traces, ADDED/MODIFIED/REMOVED/RENAMED = None |
| `specs/appointment/spec.md` | ✅ (delta NONE preserved) | Duplicate of `spec.md` in OpenSpec's standard delta folder layout — informational only, NOT merged to global spec |
| `design.md` | ✅ (92 lines) | 0 LOC prod decision, 4 architecture decisions (shared querySchema, single owner, additive repo, reject alias), data flow precedence 401→403→400, file action table (all 4 prod files Keep), interfaces, testing strategy, threat matrix N/A |
| `tasks.md` | ✅ (39 lines, **7/7 complete**) | Phase 1: 1.1-1.3 named tests; Phase 2: 2.1-2.3 verifications; Phase 3: 3.1 H-19 anchor. All checkboxes `[x]`. Review workload forecast: `Low`, `No chain`, `Single PR` |
| `apply-progress.md` | ✅ (55 lines) | 7/7 tasks done; files changed +62/-0 (route.test.ts × 2 only); verification evidence; INV/constraint compliance; next recommended step |
| `verify-report.md` | ✅ (179 lines) | **PASS** verdict; evidence table (vitest 30/30, tsc clean, git diff empty on global spec, 5/5 traces covered); invariant compliance INV-02/03/06/08/H-19/H-28; file diff audit (0 prod files touched); new test code review with assertions; risks & observations; recommended next step |
| `archive-report.md` | ✅ (this file) | Additive-only — created during archive, excluded from mechanical diff readback |

**Mechanical archive verification (MANDATORY per Mechanical Copy Contract):**

```
diff -r (PowerShell hash-equivalent):
  Snapshot path: C:\Users\...\sdd-archive.0ef5211923f64c109a12e1a97b6731eb\t036-admin-pending-query
  Destination path: C:\...\openspec\changes\archive\2026-08-31-t036-admin-pending-query
  Files in snapshot: 8
  Files in destination: 8
  EMPTY DIFF — PASS: byte-identical (8/8 files match)
```

Move mechanism: `git mv` succeeded for all 7 tracked files (git status shows `R` renames); `verify-report.md` was untracked at move time but moved physically into the destination. Source directory removed cleanly.

### Source of Truth

The following global artifacts are **unchanged** (delta NONE preserved):

- `openspec/specs/appointment/spec.md` — last touched 2026-08-29 (`cc4ecc7` T-034 archive); remains at 25 requirements (~54 scenarios); H-19 contract for single-owner query is already documented under `Query — Role Gating and Invariants`.

No spec sync required. No requirements added, modified, removed, or renamed. The 25 existing requirements (T-027..T-034) cover `status=PENDIENTE` end-to-end via the existing Status Exact Filter, RN-04 Default Filter, Pagination Envelope, and Role Gating requirements.

### SDD Cycle Complete

The change has been fully planned, implemented (verified by traceability tests), verified (PASS), and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `master` @ `3e74561` (4 commits ahead of T-034 archive baseline `cc4ecc7`):

| Commit | Subject | LOC | Type |
|--------|---------|-----|------|
| `4e32c78` | docs(t036): add proposal, spec, design, explore for admin pending query | docs only | Information reuse contract |
| `62694cb` | test(appointment): add t036 admin pending H-19 traceability tests + apply-progress | +62 tests | Work-unit tests |
| `3e74561` | docs(t036): add delta spec at specs/appointment/spec.md (NONE) | docs only | Hybrid delta-NONE marker |
| `verify-report.md` | (untracked at archive time) | docs only | PASS evidence |

`git diff --stat cc4ecc7..HEAD` totals: **10 files changed, 549 insertions, 2 deletions** — but the 2 deletions and 4-line change are in `Task-Manager-Portable.html` (tracker cosmetic, unrelated to T-036 prod/test code).

### Implementation — Zero Prod LOC + 3 Named Tests

```
src/app/api/admin/appointments/route.test.ts       |  40 ++++++++   (1 header comment + 2 named tests)
src/app/api/appointments/route.test.ts             |  22 +++       (1 named test)
```

**0 prod files touched.** The four production-adjacent files mentioned in design as "Keep" are untouched on disk:

- `src/lib/http/appointmentQuery.ts` — keep, untouched
- `src/db/repositories/turnos.ts` — keep, untouched
- `src/services/appointmentService.ts` — keep, untouched
- `src/app/api/admin/appointments/route.ts` — keep, untouched
- `src/app/api/appointments/route.ts` — keep, untouched (route.test.ts +22 only)

### Verification — Build & Tests

**Build**: ✅ `pnpm tsc --noEmit` → exit 0, empty output (hash `e3b0c442` sha1 — empty stdout)

**Tests (affected route files)**: ✅ **30/30 PASS** on `src/app/api/admin/appointments/route.test.ts` + `src/app/api/appointments/route.test.ts` (was 27/27, +3 new pending tests). Test output hash: `c8e3a9d6` (sha1 of `"Test Files 2 passed (2) / Tests 30 passed (30)"`).

**Global spec regression check**: ✅ `git diff cc4ecc7..HEAD -- openspec/specs/appointment/spec.md` → empty. Delta NONE preserved.

**Full suite regression (informational)**: `pnpm vitest run` → 794 passed / 40 failed / 2 skipped — **all 40 failures are `ECONNREFUSED 127.0.0.1:5432`** in `src/db/__tests__/*.integration.test.ts` (PostgreSQL not running locally; pre-existing infra gap, **not caused by T-036** — only test files modified, no `src/db/**` touched).

### Test Traceability Matrix (5/5 PASS)

| # | Trace (informational) | Test file | Test name | Status |
|---|---|---|---|---|
| 1 | ADMIN pending 200 with pagination/sort | `src/app/api/admin/appointments/route.test.ts:65-79` | `ADMIN pending view — status=PENDIENTE 200` | ✅ PASS |
| 2 | CLIENTE own pending 200 | `src/app/api/appointments/route.test.ts:313-330` | `CLIENTE own pending 200 — status=PENDIENTE scopes customerId` | ✅ PASS |
| 3 | ADMIN 200 vs CLIENTE 403 on admin route | existing T-033 (`route.test.ts:29-33`) + new T-036 (`:82-101`) | `CLIENTE =>403` + `pending precedence — 401→403→400 ...` (CLIENTE sub-assert) | ✅ PASS |
| 4 | 401→403→400 precedence | `src/app/api/admin/appointments/route.test.ts:82-101` | `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` (3 sub-asserts) | ✅ PASS |
| 5 | No snake leak (INV-08 negative) | `route.test.ts:77-78` (admin) + `:328-329` (cliente) | inline in tests 1 + 3 above — `not.toHaveProperty("estado")` + `not.toHaveProperty("fecha_hora_inicio")` | ✅ PASS |

### Invariant Compliance (all preserved)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-01** capacity `=1`, slot step `30` | ✅ untouched | 0 prod LOC; `findTurnosPaginated` and `createAppointment` not modified |
| **INV-02** states `PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO` | ✅ preserved | `src/domain/appointmentStateMachine.ts:9-18` defines frozen enum; `querySchema.status = AppointmentStatusSchema.optional()` rejects `COMPLETADO` |
| **INV-03** Auth.js + JWT + bcrypt; `requireAuth` precedence | ✅ preserved | `src/app/api/admin/appointments/route.ts:19-40` keeps `requireAuth → assertRole(ADMINISTRADOR)` order; `src/app/api/appointments/route.ts:124-137` keeps `requireAuth` |
| **INV-04** Atomic transaction | ✅ untouched | Read path; `createAppointment` and `countActiveOverlappingForUpdate` not modified |
| **INV-05** Slot vs duration | ✅ untouched | Read path; no slot generation touched |
| **INV-06** UTC `TIMESTAMPTZ` | ✅ preserved | `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` unchanged; ISO 8601 with TZ required |
| **INV-08** DTO mapping (camelCase, no `estado`/`fecha_hora_inicio` leak) | ✅ preserved | `src/db/mappers/turno.ts:22-33` `toTurnoDTO` remaps `estado→status`, `fechaHoraInicio→startDateTime`; tests assert `not.toHaveProperty("estado")` and `not.toHaveProperty("fecha_hora_inicio")` |
| **H-19** single-owner query (reuse T-033 with `role=ADMIN`) | ✅ preserved | `src/services/appointmentService.ts:259-276` `listAppointments` is sole read path; CLIENTE injects `customerId=authUser.id`; ADMIN bypasses; both routes delegate to it |
| **H-28** pagination envelope `{data, pagination:{page,limit,total,totalPages}}` | ✅ preserved | Tests assert exact envelope shape; `findTurnosPaginated` `totalPages = ceil(total/limit)`, shared `whereClause` for count/data |

### Precedence Specifics (401→403→400) — proven by single URL test

```
GET /api/admin/appointments?status=PENDIENTE&limit=101
  no JWT       → 401 UNAUTHORIZED  (before 400, despite limit=101)
  CLIENTE      → 403 FORBIDDEN     (before 400, despite limit=101)
  ADMIN        → 400 VALIDATION_ERROR (Zod limit max=100)
  listMock     → never called on error paths (service unreachable)
```

---

## Risks & Observations

| Risk | Severity | Mitigation |
|------|----------|------------|
| 40 integration tests fail with `ECONNREFUSED 127.0.0.1:5432` (PostgreSQL not running locally) | **Low — pre-existing infra gap** | Not caused by T-036 (only test files modified; no `src/db/**` touched). T-036 mocked unit tests all pass. Run `docker compose up -d db` before `pnpm vitest run` if integration tests required. |
| Delta NONE archival: spec folder `openspec/changes/.../specs/appointment/spec.md` exists but global spec unchanged | **Low — by design** | `git mv` moved the change folder to archive WITHOUT modifying `openspec/specs/appointment/spec.md` (no `ADDED/MODIFIED/REMOVED/RENAMED` requirement). Verified via empty diff against `cc4ecc7`. archive-report documents 0 ADDED explicitly. |
| Stakeholders expecting `GET /api/admin/pending` alias may flag T-036 as incomplete | **Low — explicitly rejected** | H-19 reuse contract cited verbatim; alias rejected in design.md "Reject" row; T-033's 62 mocked tests + `74795b9` merge serve as proof. |
| `pending precedence` test uses three sequential calls in one `it` | **Low** | Each sub-assert is independent (mock reset via `beforeEach`); no shared state. All three branches independently verify distinct precedence outcomes. |
| `listMock` arguments asserted via positional indexing (`args[1].status`) | **Low** | Standard vitest mock inspection pattern; matches existing T-033 tests style. |

---

## Next Recommended

`none — change closed`. SDD cycle complete for T-036. Next change may proceed (FASE 7 T-037 reject-list reuse, T-036b `PATCH /api/admin/schedule` DB-backed `WorkshopConfig`, or FASE 9+ per `implementation-plan.md` DAG).