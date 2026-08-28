# Archive Report: t031-reject-appointment

**Change**: `t031-reject-appointment` — T-031 Reject Appointment PENDIENTE → RECHAZADO PATCH /api/appointments/{id}/reject
**Archived to**: `openspec/changes/archive/2026-08-28-t031-reject-appointment/` (hybrid) + Engram `sdd/t031-reject-appointment/archive-report`
**Date**: 2026-08-28
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain (single PR)
**Chain strategy**: single PR, no chaining (est. 190 / actual 327, Low risk)
**Review budget**: 400 lines — actual 327 (route.ts 84 + route.test.ts 243) — ✅ within budget

---

## Executive Summary

Closed reject-appointment gap: thin `PATCH /api/appointments/{id}/reject` for `PENDIENTE → RECHAZADO` via `canTransition(PENDIENTE, RECHAZADO, ADMINISTRADOR)` only (RN-07/INV-02). Route is auth/role guard + UUID validation + error mapping only — all business logic delegates to existing `rejectAppointment` service (single owner per Technical-spec §4.5). `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema.parse → rejectAppointment({ db, config }, id, authUser) → 200 TurnoDTO camelCase` (INV-08) with ordered `401 UNAUTHORIZED / 403 FORBIDDEN / 400 VALIDATION_ERROR (+issues) / 404 NOT_FOUND / 409 INVALID_APPOINTMENT_STATE` envelope (§12). Enforces `now < startDateTime` UTC comparison (`WorkshopConfig.timezone = America/Argentina/Buenos_Aires`, INV-06) and rejects `CONFIRMADO|RECHAZADO|CANCELADO` and `now >= start` as `409` without mutation. No capacity / `FOR UPDATE` / `tstzrange` / `EXCLUDE` logic — single-row `UPDATE` only. No migration. Rollback: delete `src/app/api/appointments/[id]/reject/` and revert commit.

**Final state at close** (per Final-State Authority hierarchy):

- Tasks artifact 9/9 complete (Phase 1: 1.1-1.2 route + DI, Phase 2: 2.1-2.4 mocked tests 13 cases, Phase 3: 3.1-3.3 tsc + vitest + manual smoke) — Task Completion Gate PASS, no stale unchecked tasks.
- Verify-report PASS authoritative: 1/1 requirement, 7/7 scenarios, `tsc --noEmit` zero errors, 13/13 vitest green (1 file, 1.51s), REPEATABLE READ/FOR UPDATE absence verified via Select-String guards, INV-02/INV-08/INV-06 upheld, no capacity creep.
- **Untracked evidence revision** `155e3ae015bed6d530b7d9ed347cb3feb82ed239 + untracked t031-reject-appointment` at verification time (sha256:2d9f52ed10991633427000c03184faa8687022da803a1035e95656c43601503e); route 84 LOC + test 243 LOC = 327 confirmed.
- No CRITICAL/WARNING blockers; single SUGGESTION (delta 404 code wording `NOT_FOUND` vs `APPOINTMENT_NOT_FOUND`) — not blocking, 404 status correct. Spec delta merges into existing `openspec/specs/appointment/spec.md` (T-027 6 + T-028 4+2 + T-030 1 = 11 reqs) → add 1 → 12 total.

SDD cycle complete. Ready for T-032 cancel / T-033 query and T-035+ Auth hardening.

---

## Change Archived

**Change**: t031-reject-appointment
**Archived to**: `openspec/changes/archive/2026-08-28-t031-reject-appointment/` (hybrid) + Engram `sdd/t031-reject-appointment/archive-report`

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | Updated (merge) | 1 ADDED, 11 preserved (12 total) — `openspec/specs/appointment/spec.md` merged via append (preserve 11, add T-031 1) |

Delta: `openspec/changes/t031-reject-appointment/specs/appointment/spec.md` (49 lines, 1 ADDED requirement, 7 scenarios) — source preserved in archive.

- ADDED: Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) — 7 scenarios: Happy 200 TurnoDTO camelCase status RECHAZADO no leak; Wrong state CONFIRMADO/RECHAZADO/CANCELADO → 409 no mutation; Forbidden CLIENTE → 403 via assertRole before service; Unauthenticated missing JWT → 401 before validation (even malformed UUID); Invalid UUID → 400 VALIDATION_ERROR + issues; Not found unknown UUID → 404; Already started now >= startDateTime → 409 "El turno ya comenzó" no mutation.

Preserved (11 requirements, 26 scenarios — untouched):

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
- Confirm Appointment PENDIENTE -> CONFIRMADO (T-030, RN-07) — 7 scenarios

Final main spec: `openspec/specs/appointment/spec.md` — 252 lines, 12 requirements, 33 scenarios (11 preserved + 1 added T-031). Header `# Spec: Appointment — T-027 lifecycle + T-028 Atomic Booking (T-028+T-029)` preserved (no rename required).

### Archive Contents

- proposal.md ✅ (70 lines) — thin PATCH reject, ADDED reject, Approach 1 copy-paste confirm→reject, explicit assertRole 403 vs 409, risks/rollback
- specs/appointment/spec.md ✅ (delta 49 lines, 1 ADDED 7 scenarios — preserved as source in archive)
- design.md ✅ (75 lines) — thin handler decision mirroring confirm, error order 401→403→400→404→409, DI shape, testing strategy 7 scenarios
- tasks.md ✅ (9/9 complete — Phase 1: 1.1-1.2, Phase 2: 2.1-2.4, Phase 3: 3.1-3.3)
- exploration.md ✅ (17959 bytes) — current state T-027+T-028+T-030, 3 approaches A1 copy-paste recommended vs A2 helper premature vs A3 direct repo rejected
- verify-report.md ✅ (168 lines, PASS 1/1 7/7, tsc 0, 13 green, INV-02/08 upheld, 327/400)
- apply-progress.md ✅ (78 lines, 9/9 Ready for verify, no deviations)
- archive-report.md ✅ (this file, additive-only — excluded from mechanical diff)

All implementation tasks checked. No stale unchecked tasks. Verified before sync per Task Completion Gate.

### Source of Truth Updated

- `openspec/specs/appointment/spec.md` — updated via append merge: T-027+T-028+T-030 11 requirements preserved verbatim, T-031 1 ADDED appended (Reject Appointment PENDIENTE → RECHAZADO, RN-07) with 7 scenarios. No requirements removed or renamed. INV-02/INV-03/INV-06/INV-08 upheld. DTO mapper `toTurnoDTO` remains single source for camelCase.

### SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `master` at `155e3ae015bed6d530b7d9ed347cb3feb82ed239 + untracked t031-reject-appointment` (verify time); filesystem archive via mechanical `mv` fallback (git mv N/A untracked — see mechanical verification below). Future commit will track `src/app/api/appointments/[id]/reject/` + archived change + merged spec.

### Implementation — Thin PATCH Route

```
src/app/api/appointments/[id]/reject/route.ts      | 84 LOC — PATCH(req, {params:Promise<{id}>}) with server-only, NextResponse, uuidSchema, db/workshopConfig, toErrorBody/toValidationError, requireAuth/assertRole, rejectAppointment; ordered 401/403 before 400, DI config timezone/operatingHours/capacityPerSlot, 200 DTO, // Mirror of confirm — keep in sync
src/app/api/appointments/[id]/reject/route.test.ts | 243 LOC — 13 tests mocked server-only/db/service/auth; fixtures ADMIN/CLIENTE UUIDs + TurnoDTO RECHAZADO camelCase; covers 401/401>400 precedence/403/400/404/409x4/200/leak/DI
```

Route thinness verified: Select-String `FOR UPDATE|tstzrange|EXCLUDE|REPEATABLE READ` → zero executable matches (only DI passthrough `capacityPerSlot` and comment `no FOR UPDATE`), zero `countActiveOverlapping`. Service `rejectAppointment` owns `loadOr404 → ensureFuture → canTransition(PENDIENTE,RECHAZADO,ADMIN) → updateTurnoStatus` with `toTurnoDTO` (INV-08) and `now < start` UTC (INV-06).

### Verification — Build & Tests

**Build**: ✅ `npx tsc --noEmit` → exit 0, empty output, zero errors (hash sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)

**Tests**: ✅ 13/13 green (1 file, 1.51s, hash sha256:a1e27df3b579d3824237c6f0b7326c72890f8cb35f5fa03e4a7023bd6b3beb59)
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
✓ 409 INVALID_APPOINTMENT_STATE when now >= startDateTime with message 'El turno ya comenzó'
✓ 200 returns TurnoDTO camelCase with status RECHAZADO on ADMIN + PENDIENTE future
✓ INV-08 no snake_case leak in 200 DTO
✓ passes DI config containing timezone and capacityPerSlot (INV-01/06)
```

Auth-order probe `401 > 400` proves `requireAuth` before `uuidSchema.parse`. Leak probe asserts absence of `estado/fecha_hora_inicio/fecha_hora_fin/cliente_id/vehiculo_id/servicio_id` and presence of `customerId/vehicleId/serviceId/startDateTime/endDateTime/status`. DI spy asserts `config.timezone` + `capacityPerSlot` passed from `workshopConfig`.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Happy ADMIN future PENDIENTE → 200 | 200 camelCase RECHAZADO | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Wrong state CONFIRMADO/RECHAZADO/CANCELADO → 409 no mutation | 409 x3 table | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Forbidden CLIENTE → 403 before service | 403 FORBIDDEN service not called | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Unauthenticated JWT → 401 before validation | 401 + 401>400 | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Invalid UUID → 400 + issues | 400 malformed + empty | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Not found unknown → 404 | 404 APPOINTMENT_NOT_FOUND | ✅ COMPLIANT |
| Reject PENDIENTE→RECHAZADO (T-031, RN-07) | Already started now>=start → 409 "El turno ya comenzó" | 409 now>=start | ✅ COMPLIANT |

7/7 scenarios compliant. Handoff verify PASS 1/1 7/7 corroborated.

---

## Mechanical Archive Verification (MANDATORY — verbatim diff -r output)

### Spec Sync

- Main spec `openspec/specs/appointment/spec.md` updated via edit-append — delta 1 ADDED appended after Confirm `Already started` scenario. Preservation verified: 11 prior requirements unchanged (`grep -c "^### Requirement:"` 11 before → 12 after). No file-copy `cp` for merge — edit append is correct per skill for ADDED only (preserve OTHERS). Final file 252 lines, 12 reqs, 33 scenarios. Delta source preserved in archive at `specs/appointment/spec.md` (49 lines).

### Change Folder Move — Mechanical Copy Contract

**Snapshot + move transaction** (`archive_t031.sh` — `cp -R` + `git mv` fallback + `diff -r` readback):

```
snapshot_root=/tmp/sdd-archive.HctLEN
=== cp -R snapshot ===
snapshot created
/tmp/sdd-archive.HctLEN/source:
apply-progress.md
design.md
exploration.md
proposal.md
specs
tasks.md
verify-report.md

/tmp/sdd-archive.HctLEN/source/specs:
appointment

/tmp/sdd-archive.HctLEN/source/specs/appointment:
spec.md
=== ensure archive dir ===
=== attempting git mv ===
fatal: source directory is empty, source=openspec/changes/t031-reject-appointment, destination=openspec/changes/archive/2026-08-28-t031-reject-appointment
git mv status 128
source still exists after git mv failure, checking diff
fallback source diff 0
mv fallback succeeded
=== check source gone ===
=== MANDATORY diff -r snapshot vs destination ===
diff -r: EXIT 0 (empty, byte-identical)
=== ls destination ===
openspec/changes/archive/2026-08-28-t031-reject-appointment:
apply-progress.md
design.md
exploration.md
proposal.md
specs
tasks.md
verify-report.md

openspec/changes/archive/2026-08-28-t031-reject-appointment/specs:
appointment

openspec/changes/archive/2026-08-28-t031-reject-appointment/specs/appointment:
spec.md
ARCHIVE_MOVE_SUCCESS
```

**Interpretation**: `git mv` correctly refused — source was untracked (per `git status` `?? openspec/changes/t031-reject-appointment/` and `?? src/app/api/appointments/[id]/reject/`), so fallback `mv` is required per skill (snapshot unchanged → `fallback_source_diff_status=0`). Archive `mv` then produced empty `diff -r` (`diff_status=0`, no output) — byte-identical copy verified. `archive-report.md` is additive-only and excluded from source/destination comparison (did not exist in snapshot). Source `openspec/changes/t031-reject-appointment` is gone (guard passed: `source must be gone`). Destination contains all 7 artifacts (proposal, specs/appointment/spec.md, design, tasks, exploration, apply-progress, verify-report) — ✅.

**Post-move checks**:

- [x] Main specs updated correctly — 12 reqs, 33 scenarios, 252 lines
- [x] Change folder moved to `openspec/changes/archive/2026-08-28-t031-reject-appointment/` (hybrid)
- [x] Archive contains all artifacts (proposal, specs/, design, tasks, exploration, apply-progress, verify-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks — `grep "\[ \]"` zero, 9/9 `[x]` (Phase Gate PASS)
- [x] Active `openspec/changes/t031-reject-appointment` no longer exists (`ls` absent, `git status` shows archived as untracked)
- [x] Verbatim `diff -r` readback included above and is empty (only passing evidence) — phase PASS

---

## Artifacts & Traceability

| Artifact | Path | Lines/Size | Status |
|----------|------|------------|--------|
| Exploration | `openspec/changes/archive/2026-08-28-t031-reject-appointment/exploration.md` | 17959 bytes | ✅ (existed 2026-08-28, Approach 1 copy-paste confirm→reject chosen) |
| Proposal | `openspec/changes/archive/2026-08-28-t031-reject-appointment/proposal.md` | 70 lines, 3080 bytes | ✅ |
| Spec delta | `openspec/changes/archive/2026-08-28-t031-reject-appointment/specs/appointment/spec.md` | 49 lines, 2995 bytes (1 ADDED 7 scen) | ✅ preserved as source |
| Design | `openspec/changes/archive/2026-08-28-t031-reject-appointment/design.md` | 75 lines, 3416 bytes | ✅ zero deviations |
| Tasks | `openspec/changes/archive/2026-08-28-t031-reject-appointment/tasks.md` | 9/9 [x] (3730 bytes) | ✅ Task Completion Gate |
| Apply progress | `openspec/changes/archive/2026-08-28-t031-reject-appointment/apply-progress.md` | 78 lines, 5084 bytes (9/9 Ready) | ✅ |
| Verify report | `openspec/changes/archive/2026-08-28-t031-reject-appointment/verify-report.md` | 168 lines, 15965 bytes, PASS 1/1 7/7 | ✅ BLOCKERS 0 CRITICAL 0 |
| Archive report | `openspec/changes/archive/2026-08-28-t031-reject-appointment/archive-report.md` | this file | ✅ additive |
| Main spec (merged) | `openspec/specs/appointment/spec.md` | 252 lines (12 reqs 33 scen) | ✅ synced |
| Route | `src/app/api/appointments/[id]/reject/route.ts` | 84 LOC, 2480 bytes | ✅ untracked until commit |
| Route test | `src/app/api/appointments/[id]/reject/route.test.ts` | 243 LOC, 9534 bytes (13 green) | ✅ untracked until commit |

**Artifact store mode**: `both` — filesystem archive above + Engram `sdd/t031-reject-appointment/archive-report` (topic_key). Proposal/spec/design/tasks/verify-report also persisted in Engram per earlier phases (explore #318, proposal #319, spec #320, design #321, tasks #322 9/9, apply-progress #323 9/9, verify-report #324). This archive phase finalizes the chain.

**Engram observation IDs read** (hybrid traceability): explore `obs-cb472b1a6ffff3e1` (#318), proposal `obs-7f7250b1a92942d8` (#319), spec `obs-62bd34bd598be999` (#320), design `obs-5f58a5c4cec1207e` (#321), tasks `obs-3a8da405f8c460aa` (#322), apply-progress `obs-160aea58b254e9b2` (#323), verify-report `obs-9d43f17d3d76939e` (#324). Archive report will be saved as `sdd/t031-reject-appointment/archive-report` (next ID).

---

## Final-State Authority Notes

- **Handoff facts upheld** (rank 2): Verify PASS 1/1 7/7, tsc 0, 13/13 green, INV-02/08 uphold, no capacity, file list `route.ts + route.test.ts no migration`, spec 11→12. All corroborated by tasks artifact (9/9) and verify-report (168 lines, hashes sha256:e3b0c44..., sha256:a1e27df3..., evidence sha256:2d9f52ed...). No contradiction between handoff and snapshots.
- **No stale claims echoed**: `apply-progress` (9/9 Ready) and `verify-report` (PASS, untracked) are intermediate but final-state matches them — no later fixes needed. We report final numbers from handoff + verify (13 tests, 327 lines, 0 warnings) as highest-ranked covering source.
- **CRITICAL gate**: verify-report `critical_findings: 0, verdict: pass` — archive allowed. No override required.
- **Task Gate**: tasks.md `9/9 [x]` — no unchecked. No reconciliation needed. `grep "^\- \[ \]"` zero.
- **SUGGESTION preserved as suggestion**: delta `404 NOT_FOUND` vs errors.ts `APPOINTMENT_NOT_FOUND` → intentional domain specificity, HTTP 404 correct, not a compliance failure. Recorded in verify-report §Issues.

---

## Risks & Follow-ups

| Risk / Debt | Likelihood | Mitigation / Owner |
|-------------|------------|---------------------|
| 404 code wording drift `NOT_FOUND` vs `APPOINTMENT_NOT_FOUND` — consistency | Low | Keep specific `APPOINTMENT_NOT_FOUND`; optional editorial aligning delta wording in next spec touch. No code fix now. |
| Untracked commit not yet created — CI will not see reject route until commit | — | Next commit must stage `openspec/specs/appointment/spec.md` (merged 12 reqs) + `src/app/api/appointments/[id]/reject/*` + archived folder. Conventional commit `feat(appointment): reject PATCH PENDIENTE→RECHAZADO T-031` — no `Co-Authored-By`. |
| Spec header still mentions T-028 — not renamed to T-031 | Low | Header `T-027 + T-028` preserved intentionally; rename optional when T-032 lands. No functional impact. |
| No capacity/concurrency logic in reject — ensure future reviewers do not regress | Low | Design + verify grep guards (`FOR UPDATE` absent) documented; reject any future PR adding capacity to reject. |

**Next recommended** (per handoff): `merge+tracker` — commit archived change + merged spec, then update `implementation-plan.md` tracker (mark T-031 DONE, advance to T-032 cancel / T-033 query).

---

## Skill Resolution

- sdd-archive: completed (hybrid mode)
- artifact_store.mode: both — filesystem `openspec/changes/archive/2026-08-28-t031-reject-appointment/` + Engram `sdd/t031-reject-appointment/archive-report`
- delivery_strategy: auto-chain — single PR (400-line budget 327, Low risk, no chain)
- review_budget_lines: 400 — actual 327 ✅ no chained PRs
- execution_mode: auto
- capture_prompt: false (as instructed)
- Mechanical Copy Contract: ✅ `cp -R` snapshot → `mv` fallback (git mv N/A untracked) → `diff -r` empty verified (verbatim above). Spec sync append preserved 11 → 12.
- Task Completion Gate: ✅ 9/9 checked — no reconciliation.
- Strict-vs-OpenSpec: ✅ No CRITICAL, no incomplete task, no partial override.
