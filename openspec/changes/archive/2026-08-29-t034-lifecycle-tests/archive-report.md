# Archive Report — t034-lifecycle-tests — Exhaustive RN-07 Lifecycle Coverage

- **Change:** `t034-lifecycle-tests` — Exhaustive RN-07 Lifecycle Coverage (EC-03/EC-04, H-12/H-13)
- **Archived to:** `openspec/changes/archive/2026-08-29-t034-lifecycle-tests/`
- **Date:** 2026-08-29
- **Branch:** `feature/t034-lifecycle-tests` @ `d2b332e` (4 commits) vs `master` `74795b9`
- **Mode:** both (openspec + Engram `sdd/t034-lifecycle-tests/archive-report`)
- **Review budget:** 400 lines; actual 757 test-only — `size:exception-for-tests` (low prod risk, no DB, no prod mutation) — per verify PASS_WITH_WARNINGS

## Chain Summary (4 commits)

| # | Hash | Message | Type |
|---|------|---------|------|
| 1 | `39972cf` | `test(domain): add t034 RN-07 exhaustive 32-cell matrix with strict H-12 borders` | test-only 187 LOC |
| 2 | `2d60040` | `test(service): add t034 lifecycle chains, invalid 409s, H-12/H-13, H-11/EC-04 mocked deps.now` | test-only 570 LOC |
| 3 | `4e15cb7` | `docs(t034): mark T-034-001..006 complete and add apply-progress` | docs |
| 4 | `d2b332e` | `docs(t034): add proposal, spec, design and delta for lifecycle tests` | docs |

All 4 commits are test-only; zero prod files modified. No DB migration. Rollback: delete 2 test files `src/domain/__tests__/t034.lifecycle.matrix.test.ts` (187 LOC) + `src/services/__tests__/appointmentLifecycle.test.ts` (570 LOC).

## Spec Sync — Mechanical Append

- **Delta source:** `openspec/changes/t034-lifecycle-tests/specs/appointment/spec.md` — 6 ADDED Requirements, 17 GWT scenarios, 121 lines
- **Main spec before:** `openspec/specs/appointment/spec.md` — 424 lines, 19 Requirements (after T-033)
- **Main spec after:** `openspec/specs/appointment/spec.md` — 546 lines, 25 Requirements (19 + 6)
- **Action:** `ADDED → Append` (main exists, preserve other requirements, maintain Markdown hierarchy)
- **Mechanism:** `[System.IO.File]::AppendAllText(..., UTF8)` with leading `"\n"` separator — no Read/Write byte routing through model

### Mechanical Verification Verbatim

```
BEFORE mainLines=424 mainReq=19 deltaLines=121 deltaReq=6
AFTER mainLines=546 mainReq=25 expected 25
endsWith delta? True
STRING EQUAL PASS
---git diff --stat---
openspec/specs/appointment/spec.md | 122 +++++++++++++++++++++++++++++++++++++
1 file changed, 122 insertions(+)

Count 19->25 PASS
endsWith PASS
STRING EQUAL PASS
git diff --stat PASS (122 insertions, 1 file)
```

Spec sync covers all 6 ADDED Requirements:
1. Exhaustive RN-07 Matrix via canTransition — Pure Unit (3 scenarios)
2. Lifecycle Chains via AppointmentService — Mocked (4 scenarios)
3. Invalid Transitions 409 via Service (2 scenarios)
4. H-12 UTC Borders — BA (EC-03) (3 scenarios)
5. H-13 Guards Before Lock — createAppointment (2 scenarios)
6. H-11/EC-04 Visibility RN-04 via Flags (3 scenarios)
Total 17 GWT — all covered.

## Verification — PASS_WITH_WARNINGS (final-state at d2b332e)

Per `verify-report.md` (#352) at `d2b332e` — PASS_WITH_WARNINGS, zero CRITICAL, recommend archive.

| Check | Result | Evidence |
|-------|--------|----------|
| Typecheck | PASS | `npx tsc --noEmit` EXIT 0 (no output) at 00:31:50 and 00:32:14 |
| Vitest focused | PASS | `npx vitest run src/domain/__tests__/t034.lifecycle.matrix.test.ts src/services/__tests__/appointmentLifecycle.test.ts` — 2 files, 90 passed (55 matrix + 35 service), Duration 1.39s, transform 298ms, no ECONNREFUSED, no DB, mocked DbOrTx, deps.now UTC Z dates, vi.clearAllMocks() |
| No prod changes | PASS | `git diff master...HEAD --diff-filter=M --name-only | exclude openspec/*.md` → (no output); `git diff master...HEAD --stat` → 10 files 1670 insertions, only 2 test files + docs |
| No COMPLETADO leak | PASS | allowedTransitions has no COMPLETADO key, AppointmentStatusSchema.safeParse("COMPLETADO").success === false, canTransition(..., "COMPLETADO") === false |
| FOR UPDATE | PASS | Only in countActiveOverlappingForUpdate (turnos.ts lines 123, 140) SELECT FOR UPDATE with tstzrange &&, not in findTurnosPaginated |
| toTurnoDTO INV-08 | PASS | customerId/status/startDateTime present, clienteId/estado/fecha_hora_inicio absent, makeTurno DTO camelCase |
| H-12 strict < | PASS | now.getTime() < start.getTime() strict <, 11:59Z allow / 12:00Z reject / 12:00:01Z reject proven for cancel+confirm |

**Warnings (non-blocking):**
- W-01 Size 757 vs 400 budget / 330 forecast — test-only, 2 work-unit commits for slicing — accepted as `size:exception-for-tests`
- W-02 Spec wording 4 vs prod 6 true without opts — spec simplifies time-gated duplicates; test correctly asserts 6 true without opts — non-blocking

Totals: 6/6 ADDED Requirements PASS, 17/17 GWT PASS, 90/90 vitest PASS, tsc 0.

## Tasks — Final-State Authority Rank 1

Persisted `openspec/changes/t034-lifecycle-tests/tasks.md` at `d2b332e` — 6/6 `[x]` — final, no tick needed. Archive preserves without modification.

| Task | Status | Evidence |
|------|--------|----------|
| T-034-001 32-cell matrix + time-guard + isTerminal + COMPLETADO | [x] | t034.lifecycle.matrix.test.ts 187 LOC 55 tests |
| T-034-002 4 valid chains confirm/reject/cancel | [x] | appointmentLifecycle.test.ts harness mocked repos deps:{db:mock,config,now} |
| T-034-003 4 invalids 409 + terminals + EC-03 past | [x] | 409 INVALID_APPOINTMENT_STATE Cannot transition, no updateTurnoStatus |
| T-034-004 H-12 trios 11:59Z/12:00Z/12:00:01Z cancel+confirm | [x] | strict < via ensureFuture, beforeEach vi.clearAllMocks() |
| T-034-005 H-13 400/403 before lock + H-11/EC-04 visibility flags | [x] | countActiveOverlappingForUpdate not called, findTurnosPaginated flags forwarded |
| T-034-006 Verify no COMPLETADO, no prod, vitest green, tsc clean | [x] | Final verification passed |

No unchecked tasks remain. `apply-progress.md` and `verify-report.md` are intermediate snapshots ranked lower than tasks artifact and final-state facts — not re-ticked.

## Archive Move — Mechanical Copy Contract

- **Source:** `openspec/changes/t034-lifecycle-tests` (9 files)
- **Destination:** `openspec/changes/archive/2026-08-29-t034-lifecycle-tests` (9 files)
- **Mechanism:** `git mv` (tracked) + untracked `verify-report.md` moved atomically via `git mv` directory — byte-identical, no Read/Write routing
- **Snapshot:** `C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive.1373626740\source` (9 files) via `Copy-Item -Recurse -Force` before move

### Mechanical Verification Verbatim

```
snapshot_root=C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive.1373626740
srcCount(snapshot files)=9
dstCount=9 srcCount=9 equal? True
---diff -r snapshot vs dest---
diff exit=0
diff -r EMPTY PASS (no output)

Source gone? True (Test-Path source = False)
Destination exists? True
src count == dst count PASS (9 == 9)
diff -r EMPTY PASS (verbatim empty, exit 0 via diff.exe -r)
```

Archive contents (9 files byte-identical):
- proposal.md ✅
- spec.md ✅
- specs/appointment/spec.md ✅ (delta)
- design.md ✅
- tasks.md ✅ (6/6)
- apply-progress.md ✅
- verify-report.md ✅
- exploration.md ✅
- explore.md ✅
- archive-report.md (additive-only, excluded from diff) ✅

`git status` after move:
```
R  openspec/changes/t034-lifecycle-tests/apply-progress.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/apply-progress.md
R  openspec/changes/t034-lifecycle-tests/design.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/design.md
R  openspec/changes/t034-lifecycle-tests/exploration.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/exploration.md
R  openspec/changes/t034-lifecycle-tests/explore.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/explore.md
R  openspec/changes/t034-lifecycle-tests/proposal.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/proposal.md
R  openspec/changes/t034-lifecycle-tests/spec.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/spec.md
R  openspec/changes/t034-lifecycle-tests/specs/appointment/spec.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/specs/appointment/spec.md
R  openspec/changes/t034-lifecycle-tests/tasks.md -> openspec/changes/archive/2026-08-29-t034-lifecycle-tests/tasks.md
 M openspec/specs/appointment/spec.md
?? openspec/changes/archive/2026-08-29-t034-lifecycle-tests/verify-report.md (untracked moved)
```

## Source of Truth Updated

- `openspec/specs/appointment/spec.md` now reflects 25 Requirements (19 + 6 ADDED from t034). Delta append preserves all T-033 requirements.
- SHA256 before: master `74795b9` base
- SHA256 main after: `9B911563FCB16FC95ECA9AD2C3B79CF9E3AB828D22F059879AF9E4EE9610FBD3`
- SHA256 delta: `1A500CC9BE226396D636C972AAFB42420B3A5CDC521B2993BC31F795D3C7448C`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.

## Traceability (both mode)

- Engram topic: `sdd/t034-lifecycle-tests/archive-report` (hybrid persistence)
- File: `openspec/changes/archive/2026-08-29-t034-lifecycle-tests/archive-report.md`
- Artifacts read: proposal.md, spec.md, specs/appointment/spec.md delta, design.md, tasks.md, apply-progress.md, verify-report.md, openspec/specs/appointment/spec.md (main before/after)
- Mechanical evidence retained: spec sync Count/endsWith/STRING EQUAL, archive diff -r EMPTY, git diff --stat 122 insertions, git log 4 commits

## Risks & Next Steps

- **Risks:** None blocking. W-01/W-02 remain warnings only. No CRITICAL. No prod migration. Archive is audit trail — never delete/modify.
- **Next recommended:** none — change closed. Next change may proceed (FASE 7+).
- **Commit:** chore (archive) — 11 files (spec sync + 9 moved + archive-report)
