# Archive Report: t030-confirm-appointment

**Change**: `t030-confirm-appointment` — T-030 Confirm Appointment PENDIENTE → CONFIRMADO PATCH /api/appointments/{id}/confirm
**Archived to**: `openspec/changes/archive/2026-08-28-t030-confirm-appointment/` (hybrid) + Engram `sdd/t030-confirm-appointment/archive-report`
**Date**: 2026-08-28
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain (single PR)
**Chain strategy**: single PR, no chaining (est. 190 / actual 325, Low risk)
**Review budget**: 400 lines — actual 325 (route.ts 82 + route.test.ts 243) → ✅ within budget

---

## Executive Summary

Closed confirm-appointment gap: thin `PATCH /api/appointments/{id}/confirm` for `PENDIENTE → CONFIRMADO` via `canTransition(PENDIENTE, CONFIRMADO, ADMINISTRADOR)` only (RN-07/INV-02). Route is auth/role guard + UUID validation + error mapping only — all business logic delegates to existing `confirmAppointment` service (single owner per Technical-spec §4.5). `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema.parse → confirmAppointment({ db, config }, id, authUser) → 200 TurnoDTO camelCase` (INV-08) with ordered `401 UNAUTHORIZED / 403 FORBIDDEN / 400 VALIDATION_ERROR (+issues) / 404 APPOINTMENT_NOT_FOUND / 409 INVALID_APPOINTMENT_STATE` envelope (§12). Enforces `now < startDateTime` UTC comparison (`WorkshopConfig.timezone = America/Argentina/Buenos_Aires`, INV-06) and rejects `CONFIRMADO|RECHAZADO|CANCELADO` and `now >= start` as `409` without mutation. No capacity / `FOR UPDATE` / `tstzrange` / `EXCLUDE` logic — single-row `UPDATE` only. No migration. Rollback: delete `src/app/api/appointments/[id]/confirm/` and revert commit.

**Final state at close** (per Final-State Authority hierarchy):

- Tasks artifact 9/9 complete (Phase 1: 1.1-1.3 route + error mapping, Phase 2: 2.1-2.4 mocked tests, Phase 3: 3.1-3.2 tsc + vitest) — Task Completion Gate PASS, no stale unchecked tasks.
- Verify-report PASS authoritative: 1/1 requirement, 7/7 scenarios, `tsc --noEmit` zero errors, 13/13 vitest green (1 file, 1.41s), REPEATABLE READ/FOR UPDATE absence verified via grep guards, INV-02/INV-08/INV-06 upheld, no capacity creep.
- **Untracked evidence revision** `1d7c04c3a57b33abae234796b379f531ff4f7a58 + untracked t030-confirm-appointment` at verification time (sha256:9320f35f...); route 82 LOC + test 243 LOC = 325 confirmed.
- No CRITICAL/WARNING blockers; single SUGGESTION (delta 404 code wording `NOT_FOUND` vs `APPOINTMENT_NOT_FOUND`) — not blocking, 404 status correct. Spec delta merges into existing `openspec/specs/appointment/spec.md` (T-027 6 + T-028 4+2 = 10 reqs) → add 1 → 11 total.

SDD cycle complete. Ready for T-031..T-034 reject/cancel/query routes and T-035+ Auth hardening.

---

## Change Archived

**Change**: t030-confirm-appointment
**Archived to**: `openspec/changes/archive/2026-08-28-t030-confirm-appointment/` (hybrid) + Engram `sdd/t030-confirm-appointment/archive-report`

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | Updated (merge) | 1 ADDED, 10 preserved (11 total) — `openspec/specs/appointment/spec.md` merged via append (preserve 10, add T-030 1) |

Delta: `openspec/changes/t030-confirm-appointment/specs/appointment/spec.md` (49 lines, 1 ADDED requirement, 7 scenarios) — source preserved in archive.

- ADDED: Confirm Appointment PENDIENTE -> CONFIRMADO (T-030, RN-07) — 7 scenarios: Happy 200 TurnoDTO camelCase status CONFIRMADO no leak; Wrong state CONFIRMADO/RECHAZADO/CANCELADO → 409 no mutation; Forbidden CLIENTE → 403 via assertRole before service; Unauthenticated missing JWT → 401 before validation; Invalid UUID → 400 VALIDATION_ERROR + issues; Not found unknown UUID → 404; Already started now >= startDateTime → 409 "El turno ya comenzó" no mutation.

Preserved (10 requirements, 19 scenarios — untouched):

- State Transition Matrix via canTransition (RN-07, INV-02) — 2 scenarios
- Create Skeleton (validation order H-13 + DI) — 2 scenarios
- Query Filters RN-04 with Pagination — 2 scenarios
- Cancel Time Guard now < startDateTime (RN-05, INV-06) — 2 scenarios
- DTO Mapping INV-08 (snake → camelCase) — 1 scenario
- Error Catalog §12 — 2 scenarios
- Atomic Transaction Boundary with SELECT FOR UPDATE Capacity Gate — 2 scenarios
- EXCLUDE Safety Net 23P01 Fallback — 2 scenarios
- Concurrency Two-Worker Guarantee (T-029) — 2 scenarios
- Timezone UTC Handling (INV-06) — 2 scenarios

Final main spec: `openspec/specs/appointment/spec.md` — 206 lines, 11 requirements, 26 scenarios (10 preserved + 1 added T-030). Header `# Spec: Appointment — T-027 lifecycle + T-028 Atomic Booking (T-028+T-029)` preserved (no rename required).

### Archive Contents

- proposal.md ✅ (70 lines) — thin PATCH, ADDED confirm, Approach 2 assertRole, risks/rollback
- specs/appointment/spec.md ✅ (delta 49 lines, 1 ADDED 7 scenarios — preserved as source in archive)
- design.md ✅ (111 lines) — thin handler decision, error mapping table, DI shape, testing strategy
- tasks.md ✅ (9/9 complete — Phase 1: 1.1-1.3, Phase 2: 2.1-2.4, Phase 3: 3.1-3.2)
- exploration.md ✅ (103 lines) — current state T-027+T-028, 3 approaches A1 thin-service-only vs A2 assertRole recommended vs A3 direct repo rejected
- verify-report.md ✅ (167 lines, PASS 1/1 7/7, tsc 0, 13 green, INV-02/08 upheld, 325/400)
- apply-progress.md ✅ (74 lines, 9/9 Ready for verify, no deviations)
- archive-report.md ✅ (this file, additive-only — excluded from mechanical diff)

All implementation tasks checked. No stale unchecked tasks. Verified before sync per Task Completion Gate.

### Source of Truth Updated

- `openspec/specs/appointment/spec.md` — updated via append merge: T-027+T-028 10 requirements preserved verbatim, T-030 1 ADDED appended (Confirm Appointment PENDIENTE -> CONFIRMADO, RN-07) with 7 scenarios. No requirements removed or renamed. INV-02/INV-03/INV-06/INV-08 upheld. DTO mapper `toTurnoDTO` remains single source for camelCase.

### SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `master` at `1d7c04c + untracked t030-confirm-appointment` (verify time); filesystem archive via mechanical `mv` (not git-tracked yet — see mechanical verification below). Future commit will track `src/app/api/appointments/[id]/confirm/` + archived change + merged spec.

### Implementation — Thin PATCH Route

```
src/app/api/appointments/[id]/confirm/route.ts      | 82 LOC — PATCH(req, {params:Promise<{id}>}) with server-only, NextResponse, uuidSchema, db/workshopConfig, toErrorBody/toValidationError, requireAuth/assertRole, confirmAppointment; ordered 401/403 before 400, DI config timezone/operatingHours/capacityPerSlot, 200 DTO
src/app/api/appointments/[id]/confirm/route.test.ts | 243 LOC — 13 tests mocked server-only/db/service/auth; fixtures ADMIN/CLIENTE UUIDs + TurnoDTO CONFIRMADO camelCase; covers 401/401>400 precedence/403/400/404/409x4/200/leak/DI
```

Route thinness verified: grep `FOR UPDATE|tstzrange|countActiveOverlapping|EXCLUDE` → zero matches (only DI passthrough `capacityPerSlot` 2 lines harmless per design). Service `confirmAppointment` owns `loadOr404 → ensureFuture → canTransition(PENDIENTE,CONFIRMADO,ADMIN) → updateTurnoStatus` with `toTurnoDTO` (INV-08) and `now < start` UTC (INV-06).

### Verification — Build & Tests

**Build**: ✅ `npx tsc --noEmit` → exit 0, empty output, zero errors (hash sha256:e3b0c44298fc1c...)

**Tests**: ✅ 13/13 green (1 file, 1.41s, hash sha256:b05a43ff...)
```
✓ 401 UNAUTHORIZED when requireAuth rejects before UUID validation
✓ 401 takes precedence over 400 — unauthenticated with malformed UUID still 401
✓ 403 FORBIDDEN when CLIENTE role via assertRole and service not called
✓ 400 VALIDATION_ERROR on malformed UUID with issues
✓ 400 VALIDATION_ERROR on empty id
✓ 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError
✓ 409 INVALID_APPOINTMENT_STATE when already CONFIRMADO (wrong state)
✓ 409 INVALID_APPOINTMENT_STATE when already RECHAZADO (wrong state)
✓ 409 INVALID_APPOINTMENT_STATE when already CANCELADO (wrong state)
✓ 409 INVALID_APPOINTMENT_STATE when now >= startDateTime with message "El turno ya comenzó"
✓ 200 returns TurnoDTO camelCase with status CONFIRMADO on ADMIN + PENDIENTE future
✓ INV-08 no snake_case leak in 200 DTO
✓ passes DI config containing timezone and capacityPerSlot (INV-01/06)
```

Auth-order probe `401 > 400` proves `requireAuth` before `uuidSchema.parse`. Leak probe asserts absence of `estado/fecha_hora_inicio/cliente_id` and presence of `customerId/vehicleId/serviceId/startDateTime/endDateTime/status`. DI spy asserts `config.timezone` + `capacityPerSlot` passed from `workshopConfig`.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Happy ADMIN future PENDIENTE → 200 | 200 camelCase CONFIRMADO | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Wrong state CONFIRMADO/RECHAZADO/CANCELADO → 409 no mutation | 409 x3 table | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Forbidden CLIENTE → 403 before service | 403 FORBIDDEN service not called | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Unauthenticated JWT → 401 before validation | 401 + 401>400 | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Invalid UUID → 400 + issues | 400 malformed + empty | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Not found unknown → 404 | 404 APPOINTMENT_NOT_FOUND | ✅ COMPLIANT |
| Confirm PENDIENTE→CONFIRMADO (T-030, RN-07) | Already started now>=start → 409 "El turno ya comenzó" | 409 now>=start | ✅ COMPLIANT |

7/7 scenarios compliant.

---

## Mechanical Archive Verification (MANDATORY — verbatim diff -r output)

### Spec Sync

- Main spec `openspec/specs/appointment/spec.md` updated via edit-append — delta 1 ADDED appended after `Timezone UTC Handling` scenario DST oracle. Preservation verified: 10 prior requirements unchanged (grep `### Requirement:` 11 total). No file-copy `cp` for merge — edit append is correct per skill for ADDED only (preserve OTHERS). Final file 206 lines, 11 reqs, 26 scenarios.

### Change Folder Move — Mechanical Copy Contract

**Snapshot + move transaction** (`archive_move.sh` — `cp -R` + `git mv` fallback + `diff -r` readback):

```
snapshot_root=/tmp/sdd-archive.CzJpqj
snapshot copied
/tmp/sdd-archive.CzJpqj/source:
apply-progress.md
design.md
exploration.md
proposal.md
specs
tasks.md
verify-report.md

/tmp/sdd-archive.CzJpqj/source/specs:
appointment

/tmp/sdd-archive.CzJpqj/source/specs/appointment:
spec.md
--- preparing archive parent ---
--- attempting git mv ---
fatal: source directory is empty, source=openspec/changes/t030-confirm-appointment, destination=openspec/changes/archive/2026-08-28-t030-confirm-appointment
git mv failed status=128
source still exists, checking diff
fallback_source_diff_status=0
plain mv succeeded
--- diff -r snapshot vs destination ---
diff_status=0
--- archive move verified empty diff ---
openspec/changes/archive/2026-08-28-t030-confirm-appointment:
apply-progress.md
design.md
exploration.md
proposal.md
specs
tasks.md
verify-report.md

openspec/changes/archive/2026-08-28-t030-confirm-appointment/specs:
appointment

openspec/changes/archive/2026-08-28-t030-confirm-appointment/specs/appointment:
spec.md
```

**Interpretation**: `git mv` correctly refused — source was untracked (per `git status` `?? openspec/changes/t030-confirm-appointment/`), so fallback `mv` is required per skill (snapshot unchanged → `fallback_source_diff_status=0`). Archive `mv` then produced empty `diff -r` (`diff_status=0`, no output) — byte-identical copy verified. `archive-report.md` is additive-only and excluded from source/destination comparison (did not exist in snapshot). Source `openspec/changes/t030-confirm-appointment` is gone (guard passed: `source must be gone`). Destination contains all 7 artifacts (proposal, specs/appointment/spec.md, design, tasks, exploration, apply-progress, verify-report) — ✅.

**Post-move checks**:

- [x] Main specs updated correctly — 11 reqs, 26 scenarios, 206 lines
- [x] Change folder moved to `openspec/changes/archive/2026-08-28-t030-confirm-appointment/` (hybrid)
- [x] Archive contains all artifacts (proposal, specs/, design, tasks, exploration, apply-progress, verify-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks — `grep "\[ \]"` zero, 9/9 `[x]` (Phase Gate PASS)
- [x] Active `openspec/changes/t030-confirm-appointment` no longer exists (`ls` absent, `git status` shows archived as untracked)
- [x] Verbatim `diff -r` readback included above and is empty (only passing evidence) — phase PASS

---

## Artifacts & Traceability

| Artifact | Path | Lines | Status |
|----------|------|-------|--------|
| Exploration | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/exploration.md` | 103 | ✅ (existed 2026-08-28, Approach 2 chosen) |
| Proposal | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/proposal.md` | 70 | ✅ |
| Spec delta | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/specs/appointment/spec.md` | 49 (1 ADDED 7 scen) | ✅ preserved as source |
| Design | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/design.md` | 111 | ✅ zero deviations |
| Tasks | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/tasks.md` | 45 (9/9 [x]) | ✅ Task Completion Gate |
| Apply progress | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/apply-progress.md` | 74 (9/9 Ready) | ✅ |
| Verify report | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/verify-report.md` | 167 PASS 1/1 7/7 | ✅ BLOCKERS 0 CRITICAL 0 |
| Archive report | `openspec/changes/archive/2026-08-28-t030-confirm-appointment/archive-report.md` | this file | ✅ additive |
| Main spec (merged) | `openspec/specs/appointment/spec.md` | 206 (11 reqs 26 scen) | ✅ synced |
| Route | `src/app/api/appointments/[id]/confirm/route.ts` | 82 | ✅ untracked until commit |
| Route test | `src/app/api/appointments/[id]/confirm/route.test.ts` | 243 (13 green) | ✅ untracked until commit |

**Artifact store mode**: `both` — filesystem archive above + Engram `sdd/t030-confirm-appointment/archive-report` (topic_key). Proposal/spec/design/tasks/verify-report also persisted in Engram per earlier phases (explore #308, proposal #309, spec #310, design #311, tasks #312 9/9, apply-progress #313 9/9, verify-report #314). This archive phase finalizes the chain.

**No observation ID drift**: Filesystem is source of truth for merge verification; Engram observation IDs from prior phases are referenced by change name `t030-confirm-appointment` and need not be re-enumerated — archive report consolidates final state per Final-State Authority hierarchy (tasks artifact > launch handoff > verify snapshots).

---

## Final-State Authority Notes

- **Handoff facts upheld** (rank 2): Verify PASS 1/1 7/7, tsc 0, 13/13 green, INV-02/08 uphold, no capacity, file list `route.ts + test no migration`, spec 10→11. All corroborated by tasks artifact (9/9) and verify-report (167 lines, hashes sha256:e3b0c44..., sha256:b05a43ff...). No contradiction between handoff and snapshots.
- **No stale claims echoed**: `apply-progress` (9/9 Ready) and `verify-report` (PASS, untracked) are intermediate but final-state matches them — no later fixes needed. We report final numbers from handoff + verify (13 tests, 325 lines, 0 warnings) as highest-ranked covering source.
- **CRITICAL gate**: verify-report `critical_findings: 0, verdict: pass` — archive allowed. No override required.
- **Task Gate**: tasks.md `9/9 [x]` — no unchecked. No reconciliation needed.
- **SUGGESTION preserved as suggestion**: delta `404 NOT_FOUND` vs errors.ts `APPOINTMENT_NOT_FOUND` → intentional domain specificity, HTTP 404 correct, not a compliance failure. Recorded in verify-report §Issues.

---

## Risks & Follow-ups

| Risk / Debt | Likelihood | Mitigation / Owner |
|-------------|------------|---------------------|
| 404 code wording drift `NOT_FOUND` vs `APPOINTMENT_NOT_FOUND` — consistency | Low | Keep specific `APPOINTMENT_NOT_FOUND`; optional editorial aligning delta wording in next spec touch. No code fix now. |
| Untracked commit not yet created — CI will not see confirm route until commit | — | Next commit must stage `openspec/specs/appointment/spec.md` (merged 11 reqs) + `src/app/api/appointments/[id]/confirm/*` + archived folder. Conventional commit `feat(appointment): confirm PATCH PENDIENTE→CONFIRMADO T-030` — no `Co-Authored-By`. |
| Spec header still mentions T-028 — not renamed to T-030 | Low | Header `T-027 + T-028` preserved intentionally; rename optional when T-031 lands. No functional impact. |
| No capacity/concurrency logic in confirm — ensure future reviewers do not regress | Low | Design + verify grep guards (`FOR UPDATE` absent) documented; reject any future PR adding capacity to confirm. |

**Next recommended** (per handoff): `merge + tracker` — commit archived change + merged spec, then update `implementation-plan.md` tracker (mark T-030 DONE, advance to T-031 reject / T-032 cancel / T-033 query).

---

## Skill Resolution

- sdd-archive: completed (hybrid mode)
- artifact_store.mode: both → filesystem `openspec/changes/archive/2026-08-28-t030-confirm-appointment/` + Engram `sdd/t030-confirm-appointment/archive-report`
- delivery_strategy: auto-chain → single PR (400-line budget 325, Low risk, no chain)
- review_budget_lines: 400 → actual 325 ✅ no chained PRs
- execution_mode: auto
- capture_prompt: false (as instructed)
- Mechanical Copy Contract: ✅ `cp -R` snapshot → `mv` fallback (git mv N/A untracked) → `diff -r` empty verified (verbatim above). Spec sync append preserved 10 → 11.
- Task Completion Gate: ✅ 9/9 checked — no reconciliation.
- Strict-vs-OpenSpec: ✅ No CRITICAL, no incomplete task, no partial override.
