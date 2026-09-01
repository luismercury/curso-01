# Archive Report: t042-show-availability — Mostrar disponibilidad (FASE 8 UI-03 T-042)

> Hybrid artifact (Engram + filesystem). Persisted with `topic_key=sdd/t042-show-availability/archive-report`, `type=architecture`, `capture_prompt=false`.
>
> Source of truth at archive close: this report + `openspec/changes/archive/2026-09-01-t042-show-availability/` + `openspec/specs/availability-display/spec.md`.

## Cycle Summary

| Field | Value |
|-------|-------|
| Change | `t042-show-availability` |
| Capability | `availability-display` (NEW, no prior spec) |
| Phase | FASE 8 UI-03 (T-042) |
| Mode | hybrid (Engram + filesystem) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (fallback kept; not triggered) |
| Master baseline | `3c4fb7f` (T-041 merged) |
| Commit | `9f929be feat(appointments): T-042 availability display (RSC + grid compound)` |
| Commit SHA | `9f929be98c03a354bbba6c6ae1f4df08eadf5de7` |
| Single atomic commit | YES (page.tsx imports AvailabilitySlots.tsx, breaks PR-A/PR-B seam) |
| Files changed | 10 / 1095 insertions / 8 deletions |
| Verdict | **PASS with warnings** (size:exception + harness:gap, both non-blocking) |
| Archive date | 2026-09-01 |

## Goal

Show only bookable `HH:mm` that survive `durationMinutes`, `fechaHoraFin <= finIntervaloOperativo`, `count < capacityPerSlot`, and closed-day filters (INV-01 capacityPerSlot=1, INV-05 slotStep 30, INV-06 BA timezone, INV-08 camelCase). Bridges T-041 FL-01 step 5 → T-043 booking via canonical `?serviceId=&date=&slot=HH:mm&vehicleId=` URL.

## Archived Artifacts

Source change folder moved mechanically from `openspec/changes/t042-show-availability/` to `openspec/changes/archive/2026-09-01-t042-show-availability/`. The archive-report.md file below is additive and was not present in the source snapshot at move time.

| Artifact | Path | Size | Status |
|----------|------|------|--------|
| Proposal | `openspec/changes/archive/2026-09-01-t042-show-availability/proposal.md` | 3677 bytes | ✅ |
| Design | `openspec/changes/archive/2026-09-01-t042-show-availability/design.md` | 6416 bytes | ✅ |
| Tasks | `openspec/changes/archive/2026-09-01-t042-show-availability/tasks.md` | 6994 bytes | ✅ |
| Apply-progress | `openspec/changes/archive/2026-09-01-t042-show-availability/apply-progress.md` | 3312 bytes | ✅ |
| Verify-report | `openspec/changes/archive/2026-09-01-t042-show-availability/verify-report.md` | 20466 bytes | ✅ |
| Exploration | `openspec/changes/archive/2026-09-01-t042-show-availability/exploration.md` | 24675 bytes | ✅ |
| Delta spec | `openspec/changes/archive/2026-09-01-t042-show-availability/specs/availability-display/spec.md` | 5319 bytes | ✅ |
| Archive report | `openspec/changes/archive/2026-09-01-t042-show-availability/archive-report.md` | this file | ✅ (additive) |

### Engram observation IDs (traceability)

All artifact observations actually read for this archive step are listed below. Per the Mechanical Copy Contract, byte-identity is established by `diff -r` against a pre-move snapshot (see Verification below), not by re-reading the files.

| Artifact | Engram observation ID | Topic key |
|----------|-----------------------|-----------|
| Proposal | #453 | `sdd/t042-show-availability/proposal` |
| Spec | #454 | `sdd/t042-show-availability/spec` |
| Design | #455 | `sdd/t042-show-availability/design` |
| Tasks | #456 | `sdd/t042-show-availability/tasks` |
| Apply-progress | #457 | `t042-show-availability/apply-progress` |
| Verify-report | #459 | `sdd/t042-show-availability/verify-report` |

## Task Completion Gate Reconciliation

Per the Task Completion Gate, archived `tasks.md` must have no stale unchecked implementation tasks. Below reconciliation against `apply-progress.md` (#457) and `tasks.md` on disk:

| Task | Title | Persisted `[x]`? | Files | Evidence |
|------|-------|------------------|-------|----------|
| 1.1 | `src/lib/validators/slot.ts` (slotSchema, client-safe) | ✅ | `slot.ts` (29 LOC) | hash verified in commit `9f929be` |
| 1.2 | `src/lib/validators/slot.test.ts` (vitest accept/reject) | ✅ | `slot.test.ts` (20/20) | hash verified in commit `9f929be` |
| 1.3 | page.tsx conditional fetch + branch | ✅ | `page.tsx` (+79/-X) | merged with 2.3 (compile-time import dependency); +79 LOC in commit `9f929be` |
| 1.4 | `appointments.module.css` `.slotGrid/.slotButton/.slotSelected/.slotEmpty` | ✅ | `appointments.module.css` (69 LOC) | hash verified |
| 1.5 | `page.test.tsx` tampered/closed/valid/duration | ✅ | `page.test.tsx` (200 LOC, 6 new) | 6/6 new tests |
| 2.1 | `AvailabilitySlots.tsx` compound (Grid/Empty/SelectedBanner) | ✅ | `AvailabilitySlots.tsx` (315 LOC) | hash verified |
| 2.2 | `AvailabilitySlots.test.tsx` (jsdom RTL) | ✅ | `AvailabilitySlots.test.tsx` (205 LOC, 10/10) | hash verified |
| 2.3 | page.tsx wire `AvailabilitySlots` inside branch | ✅ | `page.tsx` (+20 LOC combined with 1.3) | merged with 1.3 |
| 3.1 | `tests/e2e/t042-availability-display.spec.ts` (Playwright artifact) | ✅ | `t042-availability-display.spec.ts` (128 LOC, 4 specs) | excluded from vitest + tsconfig; artifact ships for when `@playwright/test` is provisioned |
| 3.2 | `pnpm vitest run` + `pnpm typecheck` + `pnpm build` green | ✅ | all | T-042 vitest 50/50 PASS; tsc clean; build `/appointments/new` ƒ Dynamic |
| 3.3 | Work-unit commit (RDD receipt body) | ✅ | `9f929be` | RDD receipt embedded in commit body (Tasks / Budget / Tests / Verification / Receipts / Rollback) |

**Gate result: 10/10 tasks reconciled as complete in the persisted tasks artifact (`openspec/changes/t042-show-availability/tasks.md`).** No stale checkboxes. Single atomic commit `9f929be` is the receipt.

Note: Tasks 1.3 and 2.3 are recorded as `merged with 2.3` / `merged with 1.3` because the import dependency on `AvailabilitySlots.tsx` (produced by task 2.1) makes the page.tsx edit uncompilable without both edits present. The merge is documented in the RDD receipt body and accepted by verify-report #459.

## Verify Evidence

Per Final-State Authority, the highest-ranked source for completion/test counts is the persisted tasks artifact + the explicit final-state facts in the orchestrator's launch prompt + commit body + verify-report #459. Per the launch prompt: "All T-042 tests 50/50 PASS, tsc clean, build green, eslint clean, invariants all PASS". No verify-report claims have been overridden — both warnings (size:exception, harness:gap) are explicitly classified as non-blocking warnings.

| Check | Command | Result | Evidence |
|-------|---------|--------|----------|
| Spec coverage | `sdd-verify-validate --requirements 4 --scenarios 8` | PASS | `requirements: 4/4`, `scenarios: 8/8` in verify-report envelope |
| GWT scenarios | per-spec mapping (REQ-AVAIL-01..04) | 8/8 PASS | verify-report §"Specification Coverage" |
| T-042 vitest | `pnpm vitest run` on slot + page + AvailabilitySlots | 50/50 PASS (2.03s) | `test_output_hash: sha256:4dd64ea511d0e3f504910ae046cde251efcd840fe66aedf3a81ed3326b23c583` |
| TypeScript | `npx tsc --noEmit` | 0 errors across project | typed-byte clean |
| Build | `pnpm build` | `ƒ /appointments/new` Dynamic, force-dynamic preserved | `build_output_hash: sha256:8d678d611625124aed88de04955e1b5d107a8054eb897df25a510032a3515e74` |
| ESLint | `npx eslint` on changed TS/TSX | 0 errors (1 pre-existing `.css ignored` warning) | clean on T-042 changed files |
| Evidence revision | sha256 of commit `9f929be98c03a354bbba6c6ae1f4df08eadf5de7` | matches | `evidence_revision: sha256:211a666817d44faef2ac630419fae9be69c121018380b6824b7691dc54339535` |
| Test exit code | `pnpm vitest run` (T-042 scope) | 0 | verify-report envelope `test_exit_code: 0` |
| Build exit code | `pnpm build` | 0 | verify-report envelope `build_exit_code: 0` |
| Critical findings | verify envelope | 0 | `blockers: 0`, `critical_findings: 0` |

### Invariant coverage (per AGENTS.md INV-01..08)

| Invariant | Result | Evidence |
|-----------|--------|----------|
| INV-01 capacityPerSlot=1, count-based via WorkshopConfig | PASS | `page.tsx` passes `config.capacityPerSlot`; domain `availabilityService.getAvailableSlots` + `slotGenerator.generateSlotsForDate` enforce count via `overlap.isSlotAvailable` |
| INV-03 auth() guard before any domain work | PASS | `page.tsx` lines 92–95 `auth()` → `redirect("/login")` on null **before** any `workshopConfig`, `listServices`, or availability call; test "null session -> redirect(/login), no DB calls" asserts no mocks invoked |
| INV-05 slotStep=30 + fechaHoraFin<=finIntervalo | PASS | `slotSchema = /^(?:[01]\d|2[0-3]):(?:00|30)$/` (slot.ts:26); domain `calculateEndAndValidate` rejects 11:30+90>12:00 |
| INV-06 TIMESTAMPTZ UTC + BA timezone via WorkshopConfig | PASS | `page.tsx` `new Date(${selectedDate}T12:00:00.000Z)` noon anchor; `formatSlotsAsHHmm(slots, config.timezone)`; no hardcoded BA string |
| INV-08 DB snake_case / API camelCase; DTO mapping mandatory | PASS | `AvailabilitySlots` props are `string[]` HH:mm + primitives; test "INV-08 — DTO is camelCase English" asserts forbidden keys (`nombre`, `fechaHoraInicio`, `cliente_id`, `duracionMinutos`, etc.) absent from rendered tree |

## Spec Sync (delta → canonical)

The delta spec at `openspec/changes/t042-show-availability/specs/availability-display/spec.md` (5319 bytes, 65 lines, 4 ADDED Requirements + 8 GWT scenarios) was already merged into the canonical `openspec/specs/availability-display/spec.md` (5313 bytes, 65 lines, 4 Requirements + 8 GWT scenarios) before archive launch. The canonical section header is `## Requirements` (post-merge); the delta section header is `## ADDED Requirements` (per OpenSpec delta convention).

**Sync verification (mandatory readback):**

```text
fc /N "...\openspec\changes\t042-show-availability\specs\availability-display\spec.md" \
      "...\openspec\specs\availability-display\spec.md"

***** delta spec.md     line 12:  ## ADDED Requirements
***** canonical spec.md line 12:  ## Requirements
```

Exactly one line differs (the `ADDED` marker becomes bare `Requirements` per the merge rule). All four requirements and all eight GWT scenarios are byte-identical between delta and canonical. **No sync action required at archive time** — the canonical already reflects the merged final state and was written by `sdd-spec` during the spec phase.

The canonical file `openspec/specs/availability-display/spec.md` is now the source of truth for the `availability-display` capability and is unchanged by this archive step.

## Mechanical Move Verification

Per the Mechanical Copy Contract, archival is a shell-only operation. The move was performed with `Move-Item` because the source change folder was untracked by git (`git mv` refused with `fatal: source directory is empty`). A pre-move snapshot was taken at `C:\Users\Luis Mercury\AppData\Local\Temp\sdd-archive-ed991677-761f-4128-b932-00742b9ee742\source\` and the destination was compared file-by-file with `Get-FileHash -Algorithm SHA256`. All seven files matched byte-for-byte (the two `MISSING` entries in the readback were intermediate directory paths, not files).

| Source (snapshot) | Destination | SHA-256 (source) | SHA-256 (destination) | Match |
|-------------------|-------------|------------------|----------------------|-------|
| `apply-progress.md` | `apply-progress.md` | (Get-FileHash) | identical | ✅ |
| `design.md` | `design.md` | (Get-FileHash) | identical | ✅ |
| `exploration.md` | `exploration.md` | (Get-FileHash) | identical | ✅ |
| `proposal.md` | `proposal.md` | (Get-FileHash) | identical | ✅ |
| `tasks.md` | `tasks.md` | (Get-FileHash) | identical | ✅ |
| `verify-report.md` | `verify-report.md` | (Get-FileHash) | identical | ✅ |
| `specs/availability-display/spec.md` | `specs/availability-display/spec.md` | (Get-FileHash) | identical | ✅ |

Cross-checks via `fc /N`:
- `fc ...\source\tasks.md ...\archive\tasks.md` → `FC: no se han encontrado diferencias`
- `fc ...\source\verify-report.md ...\archive\verify-report.md` → `FC: no se han encontrado diferencias`
- `fc ...\source\specs\availability-display\spec.md ...\archive\specs\availability-display\spec.md` → `FC: no se han encontrado diferencias`

Snapshot removed after readback. The archive-report.md file (this file) is additive and was not in the source snapshot, so it is correctly excluded from the source/destination comparison per the Mechanical Copy Contract.

After move:
- Active `openspec/changes/` directory: empty (no `t042-show-availability` entry)
- Archive `openspec/changes/archive/2026-09-01-t042-show-availability/`: 7 artifacts + archive-report.md
- `git status`: only the untracked archive directory and the canonical `openspec/specs/availability-display/` remain untracked (unchanged from pre-archive state)

## Review Workload — Size Exception (1095/400)

| Metric | Forecast | Realized | Delta |
|--------|----------|----------|-------|
| Production LOC | ~213 | ~529 (slot.ts 29 + page.tsx +79 + AvailabilitySlots 315 + css 69 + e2e 128) | +316 |
| Test LOC | ~120 | ~477 (slot.test 72 + page.test +200 + AvailabilitySlots.test 205) | +357 |
| **Total insertions** | **~333** | **1095** | **+762** |
| Files | ~8 | 10 | +2 |
| 400-line budget risk | Low | Exceeded | size:exception |
| Chained PRs | No (single PR fits) | No (chain split not viable atomically) | N/A |

**Root cause of overrun (final-state fact, outranks verify-report language):**

The realized diff of 1095 insertions exceeded the 400-line budget by 762 lines (190% over). The chain split documented as the fallback (`tasks.md` §"Suggested Work Units": PR-A 1.1–1.5 → PR-B 2.1–2.3 → PR-C 3.1–3.3) was **not viable atomically** because task 1.3 (`page.tsx`) imports `AvailabilitySlots.tsx` produced by task 2.1. Splitting PR-A from PR-B would leave `page.tsx` with an unresolvable compile-time import dependency, breaking the build at the PR-A merge boundary.

**Exception classification (non-blocking):**

Both warnings are documented in `verify-report.md` (`§Risks & Follow-ups`) and in the commit body (`9f929be` RDD receipt):
1. **WARNING — size:exception (1095 / 400 budget).** Logged with explicit rollback path: `git revert 9f929be` — additive branch inside `selectedService && selectedDate`; no DB / API / state machine change; CTA / `DateSelector` branch unaffected.
2. **WARNING — harness:gap (Playwright not provisioned).** `tests/e2e/t042-availability-display.spec.ts` ships as an executable artifact (4 specs). Excluded from `vitest.config.ts` (`exclude: ["tests/e2e/**"]`) and `tsconfig.json` (`exclude: ["tests/e2e/**"]`). Drop both exclusions when `@playwright/test` lands.

**Informational note (out of scope):** DB integration tests under `src/db/__tests__/*` fail with `ECONNREFUSED ::1:5432 / 127.0.0.1:5432` because Postgres is not running locally. Pre-existing, not introduced by `9f929be`, and explicitly called out as out of scope in `apply-progress.md` lines 39–40.

The archive is intentional-with-warnings per the user's launch-prompt authorization: the size:exception is non-blocking, the harness:gap is a known provisioning gap with documented remediation, and the pre-existing DB infra gap is out of scope. **No CRITICAL findings exist; archive is authorized.**

## Chain Handoff to T-043

The T-042 page writes a canonical URL of the form `?serviceId=<uuidA>&date=<YYYY-MM-DD>&vehicleId=<uuidV>&slot=<HH:mm>` when the user picks a slot from the `AvailabilitySlots.Grid` radiogroup. The `?slot=` value is URL-encoded (`%3A` for `:`) and **siblings are preserved** via `new URLSearchParams(searchParams.toString())` + `router.push(query ? pathname+"?"+query : pathname, {scroll:false})`. The `selectedSlot` `SelectedBanner` confirms the value in the rendered tree and is reachable via deep link (refresh survives).

**T-043 contract (per `tasks.md` §"Successor"):**
- T-043 reads `searchParams.slot` verbatim alongside `serviceId` / `date` / `vehicleId`.
- T-043 validates `slot` with `slotSchema = /^(?:[01]\d|2[0-3]):(?:00|30)$/` and includes it against `availableSlots` (already computed and rendered by T-042 — T-043 may re-derive on POST or trust the URL).
- T-043 POST handler does the atomic booking transaction (INV-04) reusing `findActiveTurnosByDateRange` + `getAvailableSlotsForDate` for the availability re-check before insertion.

No handoff contract changes. URL is canonical, refresh-surviving, and a11y-clean.

## Rollback Boundary

T-042 is **strictly additive**:

- No new API endpoint (reuses `route.ts:96-97` `findActiveTurnosByDateRange` adapter).
- No DB schema change.
- No state-machine change (`PENDIENTE / CONFIRMADO / RECHAZADO / CANCELADO` per INV-02 unchanged).
- No `WorkshopConfig` schema change (reuses existing `timezone`, `slotStepMinutes`, `capacityPerSlot`, `operatingHours`).
- New files only: `src/lib/validators/slot.ts`, `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx`, `tests/e2e/t042-availability-display.spec.ts`.
- Modified files are contained in the `selectedService && selectedDate` branch of `page.tsx` and the `.slotGrid/.slotButton/.slotSelected/.slotEmpty` CSS tokens.

**Rollback procedure:**

```bash
git revert 9f929be                 # removes the additive branch from page.tsx + AvailabilitySlots.tsx + CSS tokens + tests
# or
git reset --hard 3c4fb7f           # fast-forward revert; preserves master integrity
```

After revert:
- T-041 `DateSelector` branch (date selection) remains fully functional.
- `/appointments/new` reverts to T-041 RSC shell: date input → CTA / hint, no availability grid.
- No client or server DB call introduced by T-042 remains.
- No other FASE 8 task is affected.

## Final State Summary

T-042 **Mostrar disponibilidad** is closed at archive. The `availability-display` capability is canonical at `openspec/specs/availability-display/spec.md` (4 Requirements, 8 GWT scenarios). Implementation is on master baseline `3c4fb7f` via single atomic commit `9f929be` (10 files, 1095 insertions, 8 deletions). All T-042 vitest tests (50/50) pass; tsc clean; build green with `ƒ /appointments/new` Dynamic (force-dynamic preserved); ESLint clean on changed files; INV-01/03/05/06/08 all pass with explicit per-invariant test coverage.

The two non-blocking warnings (size:exception 1095 > 400 budget; harness:gap Playwright exclusion) and the one informational note (pre-existing ECONNREFUSED DB integration tests) are documented above and in the commit body. **None block archival readiness**, and the verify-report carries no CRITICAL findings.

Ready for T-043 booking form on `?slot=HH:mm` siblings-preserved.
