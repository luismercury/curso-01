# Archive Report: t032-cancel-appointment

**Change**: `t032-cancel-appointment` — T-032 Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO PATCH /api/appointments/{id}/cancel (RN-07)
**Archived to**: `openspec/changes/archive/2026-08-28-t032-cancel-appointment/` (hybrid) + Engram `sdd/t032-cancel-appointment/archive-report`
**Date**: 2026-08-28
**Mode**: both (`hybrid` — Engram + filesystem)
**Delivery strategy**: auto-chain (single PR)
**Chain strategy**: single PR, no chaining (est. ~343 / actual 375, Low risk)
**Review budget**: 400 lines — actual 375 (route.ts 81 + route.test.ts 294) → ✅ within budget

---

## Executive Summary

Closed cancel-appointment gap: thin `PATCH /api/appointments/{id}/cancel` for `PENDIENTE → CANCELADO` and `CONFIRMADO → CANCELADO` via `canTransition(from, CANCELADO, role, {now, startDateTime})` only when `now < startDateTime` UTC (RN-07/INV-02/INV-06) and requester is owner `CLIENTE` (`turno.customerId == authUser.id`) or `ADMINISTRADOR` bypass. Route is auth guard + UUID validation + error mapping only — all business logic delegates to existing `cancelAppointment` service (single owner per Technical-spec §4.5). `requireAuth → uuidSchema.parse → cancelAppointment({ db, config }, id, authUser) → 200 TurnoDTO camelCase` (INV-08) with ordered `401 UNAUTHORIZED / 403 FORBIDDEN / 400 VALIDATION_ERROR (+issues) / 404 APPOINTMENT_NOT_FOUND / 409 INVALID_APPOINTMENT_STATE` envelope (§12). Enforces ownership-first before time guard (no timing oracle), H-12 borders `08:59` allow / `09:00:00` reject / `09:00:01` reject with `"El turno ya comenzó"`, and rejects terminal `RECHAZADO|CANCELADO` as `409` without mutation. No `assertRole`, no capacity/`FOR UPDATE`/`tstzrange`/`EXCLUDE` logic — single-row `UPDATE` only. No migration. Rollback: delete `src/app/api/appointments/[id]/cancel/` and revert commit.

**Final state at close** (per Final-State Authority hierarchy):

- Tasks artifact 14/14 complete (Phase 1: 1.1-1.4 route + DI + error mapping + guardrail, Phase 2: 2.1-2.8 mocked tests 14 cases covering 8 scenarios, Phase 3: 3.1-3.2 tsc + vitest) — Task Completion Gate PASS, no stale unchecked tasks.
- Verify-report PASS authoritative: 1/1 requirement, 8/8 scenarios, `tsc --noEmit` zero errors, 14/14 vitest green (1 file, 1.35s), `assertRole`/`FOR UPDATE`/`EXCLUDE`/`tstzrange` absence verified via grep guards, ownership-first before time and 401 before 400 proven, INV-02/INV-06/INV-08 upheld, no capacity creep.
- **Untracked evidence revision** `95acf65 + untracked t032-cancel-appointment` at verification time (sha256:738078dddb...); route 81 LOC + test 294 LOC = 375 confirmed.
- No CRITICAL/WARNING/SUGGESTION blockers; all guardrails satisfied.

SDD cycle complete. Ready for next change.

---

## Change Archived

**Change**: t032-cancel-appointment
**Archived to**: `openspec/changes/archive/2026-08-28-t032-cancel-appointment/` (hybrid) + Engram `sdd/t032-cancel-appointment/archive-report`

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| appointment | Updated (merge) | 1 ADDED, 12 preserved (13 total) — `openspec/specs/appointment/spec.md` merged via append (preserve 12, add T-032 1) |

Delta: `openspec/changes/t032-cancel-appointment/specs/appointment/spec.md` (56 lines, 1 ADDED requirement, 8 scenarios) — source preserved in archive as `openspec/changes/archive/2026-08-28-t032-cancel-appointment/specs/appointment/spec.md`.

- ADDED: Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO (T-032, RN-07) — 8 scenarios: Happy owner CLIENTE PENDIENTE → 200 TurnoDTO camelCase status CANCELADO no leak; Happy ADMIN CONFIRMADO any owner → 200 CANCELADO via toTurnoDTO no snake leak; Ownership-first non-owner CLIENTE → 403 FORBIDDEN before time guard no timing oracle; Unauthenticated missing JWT any id even malformed → 401 before UUID/service; Invalid identifier malformed UUID → 400 VALIDATION_ERROR + issues via Zod; Not found unknown UUID → 404; Wrong state RECHAZADO|CANCELADO → 409 no mutation; Already started H-12 borders 08:59 allow / 09:00:00 reject / 09:00:01 reject → 08:59 200 / 09:00:00 409 "El turno ya comenzó" / 09:00:01 409 same message.

Preserved (12 requirements, ~27 scenarios — untouched):

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
- Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) — 6 scenarios

Final main spec: `openspec/specs/appointment/spec.md` — 304 lines, 13 requirements, ~35 scenarios (12 preserved + 1 added T-032). Header `# Spec: Appointment — T-027 lifecycle + T-028 Atomic Booking` preserved (no rename required; additive delta).

### Archive Contents

- proposal.md ✅ (71 lines) — thin PATCH without assertRole, ADDED cancel, Approach 1 thin route, risks/rollback
- specs/appointment/spec.md ✅ (delta 56 lines, 1 ADDED 8 scenarios — preserved as source in archive)
- design.md ✅ (105 lines) — thin handler decision no assertRole, DI shape timezone/operatingHours/capacityPerSlot, data flow ownership-first, error mapping, testing strategy
- tasks.md ✅ (14/14 complete — Phase 1: 1.1-1.4, Phase 2: 2.1-2.8, Phase 3: 3.1-3.2)
- exploration.md ✅ (148 lines) — current state T-027 service + state machine + confirm/reject templates, 3 approaches A1 thin recommended vs A2 route ownership duplicate vs A3 helper rejected
- verify-report.md ✅ (183 lines, PASS 1/1 8/8, tsc 0, 14 green, INV-02/06/08 upheld, 375/400)
- apply-progress.md ✅ (85 lines, 14/14 Ready for verify, no deviations)
- archive-report.md ✅ (this file, additive-only — excluded from mechanical diff)

All implementation tasks checked. No stale unchecked tasks. Verified before sync per Task Completion Gate.

### Source of Truth Updated

- `openspec/specs/appointment/spec.md` — updated via append merge: T-027..T-031 12 requirements preserved verbatim, T-032 1 ADDED appended (Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO, RN-07) with 8 scenarios covering happy owner/ADMIN, ownership-first 403 before 409, 401 before 400, 400/404/409 terminal/H-12. No requirements removed or renamed. INV-02/INV-03/INV-06/INV-08 upheld. DTO mapper `toTurnoDTO` remains single source for camelCase; `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` remains canonical.

### SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

## Evidence Chain

**Branch**: `master` at `95acf65 + untracked t032-cancel-appointment` (verify time); filesystem archive via mechanical `mv` fallback (git mv N/A untracked — see mechanical verification below). Future commit will track `src/app/api/appointments/[id]/cancel/` + archived change + merged spec.

### Implementation — Thin PATCH Route

```
src/app/api/appointments/[id]/cancel/route.ts      | 81 LOC — PATCH(req, {params:Promise<{id}>}) with server-only, NextResponse, z.string().uuid(), db/workshopConfig, toErrorBody/toValidationError, requireAuth/cancelAppointment; ordered 401 before 400, DI config timezone/operatingHours/capacityPerSlot, 200 DTO, no assertRole/FOR UPDATE/EXCLUDE
src/app/api/appointments/[id]/cancel/route.test.ts | 294 LOC — 14 tests mocked server-only/db/service/auth; fixtures owner CLIENTE/ADMIN UUIDs + TurnoDTO CANCELADO camelCase; covers 401x2/403 ownership-first/400x2/404/409x4 terminal+H-12/200x2/leak/DI
```

Route thinness verified: grep `FOR UPDATE|EXCLUDE|tstzrange` → only comment line 68 `no body, no capacity/FOR UPDATE logic` (zero executable). `capacityPerSlot` appears only in DI Pick/type (lines 54,59) + DI spy — no capacity check. `assertRole` zero matches in executable code. Service `cancelAppointment` owns `loadOr404 → assertOwnership → ensureFuture → canTransition(...,CANCELADO,role,{now,startDateTime}) → updateTurnoStatus → toTurnoDTO` with ownership-first and `now < start` UTC (INV-06, H-12).

### Verification — Build & Tests

**Build**: ✅ `npx tsc --noEmit` → exit 0, empty output, zero errors (hash sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)

**Tests**: ✅ 14/14 green (1 file, 1.35s, hash sha256:d78a5c7a0bbc1591fe99c6616b423ddd281e31ca1723433d0530b615493fbac8)
```
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 401 UNAUTHORIZED when requireAuth rejects before service (valid UUID) 7ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 401 takes precedence over 400 — unauthenticated with malformed UUID still 401 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 403 ownership-first — non-owner CLIENTE future PENDIENTE (even now>=start) before time guard 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 400 VALIDATION_ERROR on malformed UUID with issues 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 400 VALIDATION_ERROR on empty id 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when terminal RECHAZADO (wrong state) 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when terminal CANCELADO (wrong state) 0ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when now == 09:00:00-03:00 (12:00Z) with message 'El turno ya comenzó' 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when now == 09:00:01-03:00 (12:00:01Z) with message 'El turno ya comenzó' 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 200 returns TurnoDTO camelCase with status CANCELADO on owner CLIENTE + PENDIENTE future (08:59 allow) 2ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > 200 ADMIN CONFIRMADO → CANCELADO any owner succeeds 0ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > INV-08 no snake_case leak in 200 DTO 1ms
 ✓ PATCH /api/appointments/[id]/cancel — thin route > passes DI config containing timezone, operatingHours and capacityPerSlot (INV-01/06) + DI spy 1ms
```

Auth-order probe `401 > 400` proves `requireAuth` before `uuidSchema.parse` (service not called). Ownership-first probe proves non-owner CLIENTE gets `403 FORBIDDEN` even when `now >= start` (service called once, 403 not 409 — timing oracle prevention). Leak probe asserts absence of `estado/fecha_hora_inicio/fecha_hora_fin/cliente_id/vehiculo_id/servicio_id` and presence of `customerId/vehicleId/serviceId/startDateTime/endDateTime/status`. DI spy asserts `config.timezone/operatingHours/capacityPerSlot` from `workshopConfig`. H-12 border probe: `08:59 allow` via 200 path, `09:00:00` and `09:00:01` → `409 "El turno ya comenzó"` with `INVALID_APPOINTMENT_STATE`.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Happy owner CLIENTE future PENDIENTE → 200 TurnoDTO camelCase status CANCELADO no leak | 200 returns TurnoDTO camelCase on owner CLIENTE + PENDIENTE future (08:59 allow) | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Happy ADMIN future CONFIRMADO any owner → 200 CANCELADO via toTurnoDTO no snake leak + DI spy | 200 ADMIN CONFIRMADO → CANCELADO + DI config spy | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Ownership-first non-owner CLIENTE blocked before time guard → 403 FORBIDDEN no timing oracle | 403 ownership-first — non-owner CLIENTE future PENDIENTE (even now>=start) | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Unauthenticated JWT → 401 before 400 even malformed UUID | 401 UNAUTHORIZED valid UUID + 401 takes precedence over 400 malformed | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Invalid identifier malformed UUID → 400 VALIDATION_ERROR + issues | 400 malformed UUID with issues + 400 empty id | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Not found unknown UUID → 404 | 404 APPOINTMENT_NOT_FOUND | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Wrong state RECHAZADO\|CANCELADO → 409 INVALID_APPOINTMENT_STATE no mutation | 409 terminal RECHAZADO + 409 terminal CANCELADO (it.each x2) | ✅ COMPLIANT |
| Cancel PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Already started H-12 08:59 allow / 09:00:00 reject / 09:00:01 reject → 409 "El turno ya comenzó" | 409 when now == 09:00:00-03:00 + 409 when now == 09:00:01-03:00 + 200 08:59 path | ✅ COMPLIANT |

8/8 scenarios compliant. 14 tests cover 8 scenarios (expanded: 401x2, 400x2, 404x1, 409x4 incl it.each, 200x2, leak, DI).

---

## Mechanical Archive Verification (MANDATORY — verbatim diff -r output)

### Spec Sync

- Main spec `openspec/specs/appointment/spec.md` updated via edit-append — delta 1 ADDED appended after `Reject Appointment` scenario `Already started — now >= startDateTime`. Preservation verified: 12 prior requirements unchanged + 1 added = 13 total (`Select-String` 13). No file-copy `cp` for merge — edit append is correct per skill for ADDED only (preserve OTHERS). Final file 304 lines, 13 reqs, ~35 scenarios. Delta source preserved in archive at `openspec/changes/archive/2026-08-28-t032-cancel-appointment/specs/appointment/spec.md` (56 lines).

### Change Folder Move — Mechanical Copy Contract

**Snapshot + move transaction** (PowerShell `Copy-Item -Recurse` + `git mv` fallback to `Move-Item` + `diff.exe -r` readback):

```
snapshot_root=C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive-ef70fb01
snapshot copied
Attempting git mv openspec/changes/t032-cancel-appointment -> openspec/changes/archive/2026-08-28-t032-cancel-appointment
fatal: source directory is empty, source=openspec/changes/t032-cancel-appointment, destination=openspec/changes/archive/2026-08-28-t032-cancel-appointment
git mv exit code: 128
git mv failed with status 128, checking fallback conditions
fallback source diff status: 0
mv fallback exit code: 0
source correctly removed, verifying diff snapshot vs destination
diff -r exit code: 0
diff -r: empty (no differences) — PASS
snapshot cleaned
--- archive contents ---
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\specs
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\apply-progress.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\design.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\exploration.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\proposal.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\tasks.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\verify-report.md
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\specs\appointment
C:\Users\Luis Mercury\proyectos\curso-01\openspec\changes\archive\2026-08-28-t032-cancel-appointment\specs\appointment\spec.md
--- main spec requirements count ---
13
```

**Interpretation**: `git mv` correctly refused — source was untracked (`git status` `?? openspec/changes/t032-cancel-appointment/`), so fallback `Move-Item` is required per skill (snapshot unchanged → `fallback_source_diff_status=0`). Archive `Move-Item` then produced empty `diff.exe -r` (`diff_status=0`, no output) — byte-identical copy verified. `archive-report.md` is additive-only and excluded from source/destination comparison (did not exist in snapshot). Source `openspec/changes/t032-cancel-appointment` is gone (guard passed: `source must be gone`). Destination contains all 7 artifacts (proposal, specs/appointment/spec.md, design, tasks, exploration, apply-progress, verify-report) — ✅.

**Post-move checks**:

- [x] Main specs updated correctly — 13 reqs, 304 lines, merge verified
- [x] Change folder moved to `openspec/changes/archive/2026-08-28-t032-cancel-appointment/` (hybrid)
- [x] Archive contains all artifacts (proposal, specs/, design, tasks, exploration, apply-progress, verify-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks — `Select-String "\[ \]"` zero, 14/14 `[x]` (Phase Gate PASS)
- [x] Active `openspec/changes/t032-cancel-appointment` no longer exists (guard passed, `Test-Path` false)
- [x] Verbatim `diff -r` readback included above and is empty (only passing evidence) — phase PASS

---

## Artifacts & Traceability

| Artifact | Path | Lines | Status | Engram Observation ID |
|----------|------|-------|--------|----------------------|
| Exploration | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/exploration.md` | 148 | ✅ (existed 2026-08-28, Approach 1 thin recommended) | #327 `sdd/t032-cancel-appointment/explore` |
| Proposal | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/proposal.md` | 71 | ✅ | #328 `sdd/t032-cancel-appointment/proposal` |
| Spec delta | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/specs/appointment/spec.md` | 56 (1 ADDED 8 scen) | ✅ preserved as source | #329 `sdd/t032-cancel-appointment/spec` |
| Design | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/design.md` | 105 | ✅ zero deviations | #330 `sdd/t032-cancel-appointment/design` |
| Tasks | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/tasks.md` | 61 (14/14 [x]) | ✅ Task Completion Gate | #331 `sdd/t032-cancel-appointment/tasks` |
| Apply progress | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/apply-progress.md` | 85 (14/14 Ready) | ✅ | #332 `sdd/t032-cancel-appointment/apply-progress` |
| Verify report | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/verify-report.md` | 183 PASS 1/1 8/8 | ✅ BLOCKERS 0 CRITICAL 0 | #333 `Verify t032-cancel-appointment — PASS 8/8 scenarios 14 green` |
| Archive report | `openspec/changes/archive/2026-08-28-t032-cancel-appointment/archive-report.md` | this file | ✅ additive | this report — Engram `sdd/t032-cancel-appointment/archive-report` |
| Main spec (merged) | `openspec/specs/appointment/spec.md` | 304 (13 reqs) | ✅ synced | — |
| Route | `src/app/api/appointments/[id]/cancel/route.ts` | 81 | ✅ untracked until commit | — |
| Route test | `src/app/api/appointments/[id]/cancel/route.test.ts` | 294 (14 green) | ✅ untracked until commit | — |

**Artifact store mode**: `both` — filesystem archive above + Engram `sdd/t032-cancel-appointment/archive-report` (topic_key). Proposal/spec/design/tasks/verify-report also persisted in Engram per earlier phases (explore #327, proposal #328, spec #329, design #330, tasks #331 14/14, apply-progress #332 14/14, verify-report #333). This archive phase finalizes the chain. All 7 prior observations re-read via `mem_get_observation` — IDs listed above for traceability.

---

## Final-State Authority Notes

- **Handoff facts upheld** (rank 2 — Final-State Handoff): Verify PASS 1/1 8/8, tsc 0, 14/14 green, no assertRole, no FOR UPDATE, ownership-first, H-12 borders, INV-02/06/08, file list `route.ts + test no migration`, spec 12→13. All corroborated by tasks artifact (14/14 `[x]`) and verify-report (183 lines, hashes sha256:e3b0c44... tsc, sha256:d78a5c7a... vitest) and disk evidence (`wc -l` 81+294=375). No contradiction between handoff and snapshots — handoff is most recent account and matches highest-ranked task artifact.
- **No stale claims echoed**: `apply-progress` (14/14 Ready for verify) and `verify-report` (PASS, untracked) are intermediate but final-state matches them — no later fixes needed after verification time. We report final numbers from handoff + verify (14 tests, 375 lines, 0 warnings) as highest-ranked covering source per hierarchy (tasks > handoff > snapshots). Never restated snapshot `pending` as current fact — all pending is closed.
- **CRITICAL gate**: verify-report `critical_findings: 0, verdict: pass, blockers: 0` — archive allowed. No override required. Handoff claim of PASS corroborated by `tsc --noEmit` 0 and 14/14 green with `diff -r` guards.
- **Task Gate**: tasks.md `14/14 [x]` — no unchecked. No reconciliation needed. `sdd-apply` owns completion; `sdd-archive` validated gate passes before sync. No stale checkbox repair.
- **No unrankable contradiction**: Higher-ranked tasks (14/14) and handoff (14 green, PASS) agree with lowest-ranked verify snapshots — no conflict to surface. INV-01/04/05 untouched as designed (no capacity/FOR UPDATE in diff).

---

## Risks & Follow-ups

| Risk / Debt | Likelihood | Mitigation / Owner |
|-------------|------------|---------------------|
| Untracked commit not yet created — CI will not see cancel route until commit | — | Next commit must stage `openspec/specs/appointment/spec.md` (merged 13 reqs, 304 lines) + `src/app/api/appointments/[id]/cancel/*` + archived folder. Conventional commit `feat(appointment): cancel PATCH PENDIENTE\|CONFIRMADO→CANCELADO T-032` — no `Co-Authored-By`. |
| Spec header still mentions T-027+T-028 only — not renamed to include T-030..T-032 | Low | Header `T-027 lifecycle + T-028 Atomic Booking` preserved intentionally; rename optional editorial when next change lands. No functional impact. 13 reqs are source of truth, header is decoration. |
| No capacity/concurrency logic in cancel — ensure future reviewers do not regress into FOR UPDATE/tstzrange | Low | Design + verify grep guards (`FOR UPDATE`/`tstzrange`/`EXCLUDE` absent except comment) documented; reject any future PR adding capacity to cancel. Route is single-row UPDATE only. |
| Timing oracle risk if future refactor reorders ownership vs time | Low | Service order `assertOwnership → ensureFuture → canTransition` is documented in archive and exploration; enforce via test `403 ownership-first even now>=start`. Any reorder breaks that test. |
| 400 vs 409 confusion on past turno — past cancel must stay 409 not 400 | Low | Already enforced: time guard maps to `INVALID_APPOINTMENT_STATE 409 "El turno ya comenzó"`; grep ensures no `VALIDATION_ERROR` for time. |

**Next recommended** (per handoff): `merge + tracker` — commit archived change + merged spec (304 lines, 13 reqs), then update `implementation-plan.md` tracker (mark T-032 DONE, advance to T-033/T-034).

---

## Skill Resolution

- sdd-archive: completed (hybrid mode — `both`)
- artifact_store.mode: both → filesystem `openspec/changes/archive/2026-08-28-t032-cancel-appointment/` + Engram `sdd/t032-cancel-appointment/archive-report`
- delivery_strategy: auto-chain → single PR (400-line budget 375, Low risk, no chain)
- review_budget_lines: 400 → actual 375 ✅ no chained PRs
- execution_mode: auto
- capture_prompt: false (as instructed)
- Mechanical Copy Contract: ✅ `Copy-Item -Recurse` snapshot → `Move-Item` fallback (git mv N/A untracked) → `diff.exe -r` empty verified (verbatim above). Spec sync append preserved 12 → 13 (304 lines).
- Task Completion Gate: ✅ 14/14 checked — no reconciliation.
- Strict-vs-OpenSpec: ✅ No CRITICAL, no incomplete task, no partial override.
