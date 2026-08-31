# Archive Report — t036b-admin-schedule

> Hybrid artifact — persisted to `openspec/changes/archive/2026-08-31-t036b-admin-schedule/archive-report.md`
> and to Engram `sdd/t036b-admin-schedule/archive-report`. Tracks final state of the SDD cycle.

## Change

- **ID**: `t036b-admin-schedule`
- **Title**: `PATCH /api/admin/schedule` (H-05) — DB-backed `workshop_schedules`
- **Branch (tracker)**: `feature/t036b-admin-schedule`
- **Merge target**: `master`
- **Chain strategy**: `feature-branch-chain` (tracker accumulates; only tracker merges to `master`)
- **Archived on**: 2026-08-31
- **Archive path**: `openspec/changes/archive/2026-08-31-t036b-admin-schedule/`

## Final State (per Final-State Authority hierarchy)

Authoritative sources (highest rank first):

1. **Persisted tasks artifact**: `openspec/changes/t036b-admin-schedule/tasks.md` — 20/20 tasks marked `[x]`, 0 unchecked.
2. **Orchestrator launch prompt** — explicit final-state facts:
   - 9/9 GWT scenarios PASS across 4 requirements
   - 158/158 scoped vitest PASS (across 9 test files)
   - 236/236 service-layer PASS (regression-free)
   - 885/890 full-suite PASS, 3 pre-existing DB failures documented, 2 SKIP — **no regressions**
   - `pnpm tsc --noEmit`: clean (exit 0, empty stdout)
   - `pnpm eslint`: 0 errors / 3 warnings (1 t036b-introduced unused `ForbiddenError` import in `route.test.ts:35`; 2 pre-existing)
   - `pnpm db:migrate`: applied; `psql \d workshop_schedules` shows `smallint PK CHECK (0..6)`, `jsonb NOT NULL`, `TIMESTAMPTZ DEFAULT now()`
   - `drizzle/meta/_journal.json`: idx 6 linear (T-009 integrity 7/7 PASS)
   - Per-request `await getWorkshopConfig(db)` verified — no global cache
   - 401 → 403 → 400 precedence honored; validation rejects overlap / start≥end / unsorted / >24:00
   - Reflection: post-PATCH `GET /api/availability` reflects patched intervals; `POST /api/appointments` outside patched interval returns 400
3. **Persisted `verify-report.md` (Engram observation #397)** — PASS verdict with `evidence_revision`, `test_output_hash`, `build_output_hash` all matching `^sha256:[0-9a-f]{64}$`. **No CRITICAL issues.**
4. **Persisted `apply-progress.md` (Engram observation #393)** — 3 stacked PRs merged on tracker.

### Specs Synced

| Domain | Action | Details | Source Delta | Target Global |
|--------|--------|---------|--------------|---------------|
| `workshop-schedule` | **NEW (created)** | 3 requirements added | `openspec/changes/t036b-admin-schedule/specs/workshop-schedule/spec.md` (49L) | `openspec/specs/workshop-schedule/spec.md` (49L, byte-identical) |
| `availability` | **MODIFIED (appended)** | 1 requirement added; 4 scenarios | `openspec/changes/t036b-admin-schedule/specs/availability/spec.md` (22L delta) | `openspec/specs/availability/spec.md` (now 7012B / 8 requirements) |

**Delta totals**: 4 requirements added (3 new + 1 modified), 9 GWT scenarios total (workshop-schedule: 6, availability: 3).

### Requirements Merged Into Source of Truth

**`openspec/specs/workshop-schedule/spec.md`** (NEW canonical spec):
1. `Admin Schedule Mutation` — 3 scenarios (ADMIN 200, CLIENTE 403, idempotent repatch)
2. `Interval Validation` — 2 scenarios (overlap rejected, start≥end/unsorted rejected)
3. `Parametrizable Defaults and Persistence` — 1 scenario (empty table → Mon-Fri defaults / Sat-Sun `[]`)

**`openspec/specs/availability/spec.md`** (appended to existing T-026 spec):
8. `DB-Backed Operating Hours Consumption (t036b-admin-schedule)` — 3 scenarios (GET reflects patched, creation outside patched rejected 400, BA DST per-request resolution) + 1 added reflection scenario (no global cache)

### Mechanical Copy Contract — Verification

Both mechanical copy operations used SHA256 byte-identity readback as the MANDATORY diff verification:

#### Step 1 — workshop-schedule global spec creation (NEW)

| Path | SHA256 |
|------|--------|
| Source delta `openspec/changes/t036b-admin-schedule/specs/workshop-schedule/spec.md` | `b62956b904d7a2d1e1a3dd659a5d3dfea9656145213a4f68bacd70a1cf6a3640` |
| Target global `openspec/specs/workshop-schedule/spec.md` | `b62956b904d7a2d1e1a3dd659a5d3dfea9656145213a4f68bacd70a1cf6a3640` |
| **Match** | ✅ empty diff |

Method: `Copy-Item` to temp file in target dir → SHA256 compare → `Move-Item` to final path. No `Read → Write` of content through model generation.

#### Step 3 — Change folder archive move

| File | Source SHA256 | Destination SHA256 | Match |
|------|---------------|--------------------|-------|
| `apply-progress.md` | `5ecfe9497507af7da9d425103f291bdc70929a36120edcd554dcd6866241ca39` | `5ecfe9497507af7da9d425103f291bdc70929a36120edcd554dcd6866241ca39` | ✅ |
| `design.md` | `7c877a95968dfe4c15cd133d60a6361877d92947b6acb6f6ab551823453c1017` | `7c877a95968dfe4c15cd133d60a6361877d92947b6acb6f6ab551823453c1017` | ✅ |
| `explore.md` | `e680cb09a78eba1472e78517c74596f743659be75b87cf19df700720796c490e` | `e680cb09a78eba1472e78517c74596f743659be75b87cf19df700720796c490e` | ✅ |
| `proposal.md` | `7fa971e401527700e1a472f462bbaeadcaa1ee9ee4a24b08b7c0e9e1decface3` | `7fa971e401527700e1a472f462bbaeadcaa1ee9ee4a24b08b7c0e9e1decface3` | ✅ |
| `spec.md` | `fef263c389af6ee37e506c779c7ae3c9921a6697f311b28283384785614bc6aa` | `fef263c389af6ee37e506c779c7ae3c9921a6697f311b28283384785614bc6aa` | ✅ |
| `specs/availability/spec.md` | `7c927785592fb0d7032404afde6215a83d192be4e9e39d6c742d0e9bc845d2eb` | `7c927785592fb0d7032404afde6215a83d192be4e9e39d6c742d0e9bc845d2eb` | ✅ |
| `specs/workshop-schedule/spec.md` | `b62956b904d7a2d1e1a3dd659a5d3dfea9656145213a4f68bacd70a1cf6a3640` | `b62956b904d7a2d1e1a3dd659a5d3dfea9656145213a4f68bacd70a1cf6a3640` | ✅ |
| `tasks.md` | `f091642231324faf9ab9de127943889628d78508ac2a69096375fea453c3e126` | `f091642231324faf9ab9de127943889628d78508ac2a69096375fea453c3e126` | ✅ |
| `verify-report.md` | `8cdd242f5923e83f3262719f9af599352e53322cec59dcf823c76cbd67f03512` | `8cdd242f5923e83f3262719f9af599352e53322cec59dcf823c76cbd67f03512` | ✅ |

Method: `git mv openspec/changes/t036b-admin-schedule openspec/changes/archive/2026-08-31-t036b-admin-schedule/` (succeeded — git handled mixed tracked/untracked directory atomically). **Empty diff** — all 9 files byte-identical.

Pre-move snapshot retained at `C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive-a86bc5a2d71c46d99c8c60c64752011b\source` for audit.

### Archive Contents

| Artifact | Present | Size | Notes |
|----------|---------|------|-------|
| `proposal.md` | ✅ | 3736B | Intent, scope, capabilities, approach |
| `spec.md` (index) | ✅ | 2357B | Hybrid concatenated view for reviewers |
| `specs/workshop-schedule/spec.md` | ✅ | 2924B | NEW domain — 3 requirements |
| `specs/availability/spec.md` | ✅ | 1610B | MODIFIED — 1 ADDED requirement |
| `design.md` | ✅ | 6226B | Architecture decisions, data flow, threat matrix |
| `tasks.md` | ✅ | 3975B | 20/20 tasks `[x]` |
| `apply-progress.md` | ✅ | 11026B | 3 PRs (foundation, PATCH route, consumer swaps) |
| `verify-report.md` | ✅ | 22236B | PASS verdict, GWT 9/9, 158/158, tsc clean |
| `explore.md` | ✅ | 17196B | 3-approach analysis (A DB-backed chosen) |
| `archive-report.md` | ✅ | (this file) | Hybrid audit trail |

### Task Completion Gate — Final

- **20 implementation tasks** across 5 phases, **20 marked `[x]`**, **0 unchecked** in `tasks.md`.
- Phase 1 (foundation): 1.1–1.6 ✅
- Phase 2 (provider): 2.1–2.3 ✅
- Phase 3 (PATCH route): 3.1–3.3 ✅
- Phase 4 (consumer swaps): 4.1–4.5 ✅
- Phase 5 (verification): 5.1–5.3 ✅

No stale-checkbox reconciliation required — every unchecked task absent from persisted artifact.

### Verify-Report Final State

- **Verdict**: PASS
- **GWT scenarios**: 9/9 PASS
- **Vitest (scoped)**: 158/158 PASS
- **Vitest (service-layer)**: 236/236 PASS (regression-free)
- **Vitest (full)**: 885 PASS / 3 FAIL / 2 SKIP — 3 failures pre-existing DB-dependent (not regressions)
- **tsc**: clean
- **CRITICAL issues**: NONE

### Invariants Honored (per AGENTS.md + Technical-spec)

- **INV-01** Capacity: `capacityPerSlot=1` retained via frozen fallback; merged into `WorkshopConfig` from `getWorkshopConfig(db)`.
- **INV-02** States: `PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO` UPPER_SNAKE — no change.
- **INV-03** Auth: `requireAuth → assertRole(ADMINISTRADOR)` BEFORE `req.json()`; 401/403 precedence verified.
- **INV-04** Concurrency: `REPEATABLE READ` + `SELECT FOR UPDATE` + `EXCLUDE USING gist` retained in `appointmentService.createAppointment`; PATCH route does NOT use FOR UPDATE (single-admin writer, last-write-wins acceptable).
- **INV-05** Slots vs Duration: `slotStepMinutes=30`, `durationMinutes` filtering, `fechaHoraFin <= finIntervaloOperativo` inclusive `<=` preserved.
- **INV-06** Timezone: `TIMESTAMPTZ` UTC; `America/Argentina/Buenos_Aires` via `getBaDayUtcRange` / `baWallTimeToUtcDate` DST-aware.
- **INV-07** Phases: FASE 9 sub-T-036b completed within phase scope.
- **INV-08** Naming: snake_case DB ↔ camelCase API; DTO mapper in repo; `dayOfWeek`/`openIntervals` only.

### Chain — 3 PRs Merged on Tracker

| PR | Commit | Scope | Test Result |
|----|--------|-------|-------------|
| PR #1 (foundation) | `f718991` | `feat(schedule): add workshop_schedules foundation PR1` — migration 0006 + journal idx 6 + schema + repo + 8 integration tests | 8/8 PASS |
| PR #2 (provider + PATCH route) | `49823c2` | `feat(schedule): add PATCH admin schedule PR2` — `getWorkshopConfig(db)` provider + Zod strict + `superRefine(validateIntervals)` + 16 route tests | 47/47 PASS |
| PR #3 (consumer swaps) | `9497a6c` | `feat(schedule): wire availability/appointments to DB config PR3` — `availability/route.ts` + `appointments/route.ts` swap to per-request `await getWorkshopConfig(db)` + 9 reflection tests | 158/158 PASS (scoped) |

### Source of Truth Updated

The following global specs now reflect the new behavior:

- `openspec/specs/workshop-schedule/spec.md` (NEW, 49L)
- `openspec/specs/availability/spec.md` (modified, 7012B / 8 requirements)

`openspec/specs/appointment/spec.md` unchanged — T-027/T-028 atomic booking contract unaffected.

### Risks

| Risk | Status |
|------|--------|
| Validation bypass (overlap/start≥end/unsorted/>24:00) | Mitigated — `validateIntervals` superRefine + repo guard + tests |
| Auth bypass (CLIENTE patches) | Mitigated — `requireAuth → assertRole(ADMINISTRADOR)` before parse + 403 test |
| Stale availability (cached config) | Mitigated — per-request `await getWorkshopConfig(db)`, no global cache, reflection test asserts |
| Hardcode regression INV-05 | Mitigated — defaults only in `src/config/workshopSchedule.ts:16-19` (verified by grep) |
| Migration journal drift | Mitigated — `drizzle/meta/_journal.json` idx 6 linear (T-009 integrity 7/7 PASS) |
| Timezone drift DST | Mitigated — `getBaDayUtcRange` / `baWallTimeToUtcDate` Intl-based, no hardcoded offset |

### Engram Observation IDs Read (Hybrid Traceability)

- `#388` — `sdd/t036b-admin-schedule/explore` — 3-approach analysis (A DB-backed chosen)
- `#389` — `sdd/t036b-admin-schedule/proposal` — hybrid proposal, 448w
- `#390` — `sdd/t036b-admin-schedule/spec` — 4 requirements, 9 GWT scenarios
- `#391` — `sdd/t036b-admin-schedule/design` — DB shape + provider + route guard ordering
- `#392` — `sdd/t036b-admin-schedule/tasks` — 16 work units mapped (file shows 20 sub-tasks)
- `#393` — `sdd/t036b-admin-schedule/apply-progress` — 3 PRs merged on tracker
- `#397` — `sdd/t036b-admin-schedule/verify-report` — PASS verdict with sha256 evidence_revision / test_output_hash / build_output_hash

### Next Step (for orchestrator)

This archive commit lands on the tracker branch `feature/t036b-admin-schedule`. Per `feature-branch-chain` strategy, **the next required action is to merge the tracker into `master` with `--no-ff`** to preserve feature branch history. Suggested merge commit message:

```
Merge branch 'feature/t036b-admin-schedule' into master

T-036b PATCH /api/admin/schedule (H-05) — DB-backed workshop_schedules

- 3 chained PRs (f718991 foundation, 49823c2 PATCH route, 9497a6c consumer swaps)
- Archive 2026-08-31: 4 reqs synced (3 new workshop-schedule, 1 added availability)
- 9/9 GWT PASS, 158/158 scoped vitest, tsc clean
- Per-request getWorkshopConfig(db); no global cache
- INV-01/03/04/05/06/08 honored
```

The archive commit on tracker uses:

```
chore(archive): t036b-admin-schedule -> archive 2026-08-31, sync 4 reqs, 9/9 GWT PASS, 158/158 vitest
```

### SDD Cycle Status

**Complete** — change fully planned, implemented, verified, and archived. Ready for the next change.

---

*This file is the terminal record of the SDD cycle for `t036b-admin-schedule`. It describes final state at close, not intermediate snapshots during the cycle.*
