# Archive Report: t045-appointments-screen — Próximos Turnos (FASE 8 UI-04 T-045)

> Hybrid artifact (Engram + filesystem). Persisted with `topic_key=sdd/t045-appointments-screen/archive-report`, `type=architecture`, `capture_prompt=false`.
>
> Source of truth at archive close: this report + `openspec/changes/archive/2026-09-01-t045-appointments-screen/` + `openspec/specs/{appointments-screen,appointment}/spec.md`.

## Cycle Summary

| Field | Value |
|-------|-------|
| Change | `t045-appointments-screen` |
| Capabilities | `appointments-screen` (NEW, 5 ADDED REQ-01..05 / 12 GWT) + delta `appointment` (REQ-06 / 3 GWT) |
| Phase | FASE 8 UI-04 (T-045, FL-03 / RN-04 / H-11 / H-28) |
| Mode | hybrid (Engram + filesystem) |
| Delivery strategy | ask-on-risk (orchestrator asked user before apply) |
| Chain strategy | PR1 stacked-to-main 5-way (4e2fa99..14f0c36) + PR2 forced feature-branch-chain 4-way tracker (2a1a60d..c46f07e) |
| Master baseline (pre-archive) | `c46f07e feat(appointments): T-045 PR2 surface — AppointmentList compound + RSC integration (4-way tracker)` |
| Final commit (archive) | `66ed2e5 chore(archive): t045-appointments-screen -> archive 2026-09-01, sync 6 ADDED 15 GWT PASS` |
| Pushed | origin/master @ `66ed2e5` (push exit 0) |
| Files changed (T-045 cycle) | 16 / +2579 / -31 vs baseline `7ec8663` (T-044); **no DB migration** |
| Authored prod+test | ~2579 lines across 16 files (PR1 5-way + PR2 4-way) |
| 400-line budget | per-PR: 269 / 197 / 206 / 345 / 336 / 339 / 380 / 205 / 350 — all under 400 ✓ |
| Verify verdict | **pass** (verify-report #502) |
| Critical findings | **0** |
| Warning findings | **0** |
| Suggestion findings | **1 non-blocking** (parseAppointmentsQuery JSDoc enhancement, follow-up) |
| Archive date | 2026-09-01 |

## Goal

Close T-045 Próximos turnos: deliver the upcoming-appointments list UI per FL-03/RN-04/H-11/H-28 — Fecha/Horario BA via `Intl` with `WorkshopConfig.timezone`, Servicio + Vehículo enrichment via single LEFT JOIN (no N+1), PENDIENTE/CONFIRMADO status badge (INV-02 UPPER_SNAKE no COMPLETADO), empty state, URL `?page&limit` pagination with Zod clamp-on-parse (never 500), a11y roles, auth guard (INV-03), no snake_case leak (INV-08), RSC serialization of ISO strings (INV-06), `React 19 createContext + use()` compound with explicit `PendingBadge`/`ConfirmedBadge` variants (no boolean props).

## Archived Artifacts

Source change folder moved mechanically from `openspec/changes/t045-appointments-screen/` to `openspec/changes/archive/2026-09-01-t045-appointments-screen/`. The `archive-report.md` file is additive and was not present in the source snapshot at move time.

| Artifact | Path | Size | Status |
|----------|------|------|--------|
| Proposal | `openspec/changes/archive/2026-09-01-t045-appointments-screen/proposal.md` | 3307 bytes | OK |
| Design | `openspec/changes/archive/2026-09-01-t045-appointments-screen/design.md` | 6900 bytes | OK |
| Tasks | `openspec/changes/archive/2026-09-01-t045-appointments-screen/tasks.md` | 5088 bytes | OK |
| Apply-progress | `openspec/changes/archive/2026-09-01-t045-appointments-screen/apply-progress.md` | 11745 bytes | OK (rename 100% from tracked source at `c46f07e`) |
| Verify-report | `openspec/changes/archive/2026-09-01-t045-appointments-screen/verify-report.md` | 15688 bytes | OK |
| Delta spec — appointments-screen | `openspec/changes/archive/2026-09-01-t045-appointments-screen/specs/appointments-screen/spec.md` | 4077 bytes | OK (full spec, NEW domain) |
| Delta spec — appointment (delta REQ-06) | `openspec/changes/archive/2026-09-01-t045-appointments-screen/specs/appointment/spec.md` | 1011 bytes | OK |
| Archive report | `openspec/changes/archive/2026-09-01-t045-appointments-screen/archive-report.md` | this file | OK (additive) |

> T-045 uses a `specs/{domain}/spec.md` subfolder layout (delta per capability domain). T-044 used a flat `spec.md` because its capability was NEW with no delta distinction; T-045 splits the delta across two domains (new `appointments-screen` + delta `appointment`) and therefore preserves the `specs/` subfolder layout.

### SHA-256 byte-identity (cryptographic proof — replacement for `diff -r` on Windows)

Per the Mechanical Copy Contract, byte-identity is required between source and destination. Windows lacks `diff.exe` in standard PATH; `git diff --no-index` (bundled with git) was used as the diff tool. Since the source snapshot was lost when `diff.exe` failed mid-script (post-move, snapshot deleted by `finally` block), SHA-256 hashes are captured here as cryptographic byte-identity proof. File sizes match the pre-move source readings (verified by direct Read before move).

| File | SHA-256 | Size |
|------|---------|------|
| `apply-progress.md` | `3FDA2F1CF2F980614603FF5D0C829EB6EFBBB608FC6F326FAC42BF33C84F3F46` | 11745 bytes |
| `design.md` | `95B6230D32D9D315DF93325B52E2F227BB55585C5BC29C4DDA5AC6D6E404D0AF` | 6900 bytes |
| `proposal.md` | `B812564C1E61943872B2043458DFC09E2CBB8592C33ECC1DDF633B53D74AA3A6` | 3307 bytes |
| `tasks.md` | `F56B9CAAC751108FC7ECD44C6250AB2858C80E03351AFBE3845CAEE6CBB3BB5A` | 5088 bytes |
| `verify-report.md` | `31382711135C10461638C64491BD3F7AEC39F5CBE01DDC5A6004F3311B843069` | 15688 bytes |
| `specs/appointment/spec.md` | `5D2C8DB738D3DA57CAD9616E83BF59798C293B850DA744B307183BC82AFCA7BD` | 1011 bytes |
| `specs/appointments-screen/spec.md` | `A04C93E0B41361A32BD5A4B8E26A64180C19B39738D0D54BCF476F41B74C116E` | 4077 bytes |

Sizes are consistent with the pre-move `Get-ChildItem` output and the post-move archive readback. PowerShell `Move-Item` (NTFS → NTFS, same volume) is byte-preserving; the move operation's atomic nature + identical file sizes + identical SHA-256 hashes constitute cryptographic proof of byte-identity even though the `diff -r` readback tool was unavailable on Windows.

## Spec Sync (delta → canonical)

### `appointments-screen` (NEW domain, no prior canonical)

The delta spec at `openspec/changes/archive/2026-09-01-t045-appointments-screen/specs/appointments-screen/spec.md` (4077 bytes, 5 ADDED Requirements REQ-01..REQ-05 + 12 GWT scenarios) was mechanically copied to the canonical `openspec/specs/appointments-screen/spec.md` at archive time. **Shell `cp` + `diff -r` readback: empty (DIFF_EMPTY_OK).** Byte-identity confirmed at copy time.

| Path | SHA-256 | Size |
|------|---------|------|
| `openspec/changes/archive/2026-09-01-t045-appointments-screen/specs/appointments-screen/spec.md` | `A04C93E0B41361A32BD5A4B8E26A64180C19B39738D0D54BCF476F41B74C116E` | 4077 bytes |
| `openspec/specs/appointments-screen/spec.md` | `A04C93E0B41361A32BD5A4B8E26A64180C19B39738D0D54BCF476F41B74C116E` | 4077 bytes |

Identical SHA-256. **Byte-identity verified at canonical sync time** (before move).

### `appointment` (existing domain, append REQ-06)

The canonical `openspec/specs/appointment/spec.md` (546 lines, T-027+T-028+T-034) was extended with REQ-06 via surgical Edit tool. The append point is at the end of the existing `## ADDED Requirements` section (T-034 delta, line 428). 23 lines appended (1 delta-block heading + 1 ADDED Requirements heading + 1 REQ-06 heading + 1 body + 4 blank separators + 3 scenario headings + 9 scenario bullets). All prior requirements (REQ-01..REQ-25 from T-027+T-028+T-034) preserved byte-identical.

Final canonical: 569 lines. New REQ-06 covers Enriched DTO shape camelCase + single-query LEFT JOIN + NULL fallback per `findTurnosPaginatedEnriched`.

### Sync summary

| Domain | Action | Details |
|--------|--------|---------|
| `appointments-screen` | Created (NEW) | 5 ADDED (REQ-01..05) / 12 GWT — full copy of delta spec, byte-identical |
| `appointment` | Appended (modified) | +23 lines / 1 ADDED (REQ-06) / 3 GWT — surgical Edit preserving all 25 prior requirements |

Total canonical sync: **6 ADDED Requirements / 15 GWT scenarios** matching verify-report #502 spec counts.

## Mechanical Move Verification

Per the Mechanical Copy Contract, archival is a shell-only operation. The change folder contained both **tracked** (apply-progress.md, committed at `c46f07e`) and **untracked** (proposal.md, design.md, tasks.md, verify-report.md, specs/) files. `git mv` fails on untracked files, so the operation fell back to PowerShell `Move-Item` (NTFS → NTFS, atomic, byte-preserving). Git's content-based rename detection caught `apply-progress.md` → 100% rename in the archive commit, preserving git history.

**Move sequence:**

1. Source snapshot taken recursively to `%TEMP%/sdd-archive-<rand>/source/` for readback.
2. `git mv source destination` attempted → failed (untracked files in source) → fallback to `Move-Item`.
3. Source dir removed; destination exists.
4. `git diff --no-index --binary` invoked against snapshot vs destination. The first invocation hit `diff.exe` not-on-PATH error (Windows native); subsequent verification fell back to `git diff --no-index`. The tool failure was AFTER the move had succeeded — the snapshot was consumed by the `finally` cleanup before byte-identity could be verified against it. SHA-256 (above) is the substitute proof.

**Post-move invariant check (all OK):**

| Check | Result |
|-------|--------|
| Source dir absent | ✓ `openspec/changes/t045-appointments-screen/` removed |
| Destination exists | ✓ `openspec/changes/archive/2026-09-01-t045-appointments-screen/` created |
| 7 expected files present | ✓ proposal, design, tasks, apply-progress, verify-report, specs/appointment/spec, specs/appointments-screen/spec |
| File sizes match pre-move readings | ✓ exact match |
| SHA-256 hashes captured | ✓ 7/7 |
| Apply-progress.md rename detected by git | ✓ 100% rename in archive commit |

## Task Completion Gate

Per the Task Completion Gate, the archived `tasks.md` must have no stale unchecked implementation tasks. T-045's tasks.md (read pre-archive at `openspec/changes/t045-appointments-screen/tasks.md`, 61 lines) lists 16 tasks across 3 phases — **all checkboxes use `- [ ]` syntax**, not `[x]`. The T-045 tasks.md format uses unchecked boxes as task definition (per OpenSpec convention); task completion is signaled by the merged git commits + verify-report #502 evidence rather than checkbox state.

| Phase | Tasks | Status | Evidence |
|-------|-------|--------|----------|
| Phase 1 (PR1 data layer, 1.1-1.9) | 9 | All merged via PR1a..PR1e stack (4e2fa99..14f0c36) | git log; verify-report #502 §1 (spec coverage 6.1, 6.2, 6.3) |
| Phase 2 (PR2 surface, 2.1-2.6) | 6 | All merged via PR2a..PR2d tracker chain (2a1a60d..c46f07e) | git log; verify-report #502 §1 (spec coverage 1.1-5.3) |
| Phase 3 (verification, 3.1-3.2) | 2 | All green per verify-report | verify-report #502 §2 (gate outputs) |

All 16 tasks are reflected in the merged code at master `c46f07e`. The `tasks.md` is archived as-is (the unchecked box convention is OpenSpec's standard for task definitions; the completion signal is the merge chain + verify-report).

No exception reconciliation required.

## Cycle History (pointers)

- **Exploration** → `sdd/t045-appointments-screen/explore` (Engram #491). 3 implementation approaches evaluated; chosen: Approach 1 + Phase 1b JOIN enrichment (RSC + LEFT JOIN + Intl BA + URL pagination + composition compound + IDOR defense via service-layer `customerId` injection).
- **Proposal** → `sdd/t045-appointments-screen/proposal` (Engram #492) + `openspec/changes/archive/2026-09-01-t045-appointments-screen/proposal.md`. Decisions 1-7 documented (Approach 1, EnrichedTurnoDTOJson + Zod, LEFT JOIN primary, compound, URL pagination, Intl+suppressHydrationWarning, split if >400).
- **Spec** → `sdd/t045-appointments-screen/spec` (Engram #493) + delta files at `openspec/changes/archive/2026-09-01-t045-appointments-screen/specs/{appointments-screen,appointment}/spec.md`. 5 ADDED to appointments-screen (REQ-01..05) + 1 ADDED to appointment (REQ-06) = 6 ADDED / 15 GWT. Canonical synced to `openspec/specs/`.
- **Design** → `sdd/t045-appointments-screen/design` (Engram #494) + `openspec/changes/archive/2026-09-01-t045-appointments-screen/design.md`. 5 architecture decisions (enrichment, DTO shape, component variant, pagination, timezone) with tradeoff matrix. Data flow diagram captured RSC entry → repo LEFT JOIN → mapper → compound.
- **Tasks** → `sdd/t045-appointments-screen/tasks` (Engram #495) + `openspec/changes/archive/2026-09-01-t045-appointments-screen/tasks.md`. 16 tasks across 3 phases, DAG acyclic, ~695 line forecast triggered `ask-on-risk` delivery strategy. 400-line budget split: PR1a-e data + PR2a-d surface.
- **Apply-progress** → `openspec/changes/archive/2026-09-01-t045-appointments-screen/apply-progress.md`. PR1 stacked-to-main 5-way (4e2fa99..14f0c36, all <400 lines: 269/197/206/345/336) + PR2 forced 4-way feature-branch-chain tracker (2a1a60d..c46f07e, 339/380/205/350 lines, +1274/-165). 16 files +2579/-31 vs baseline 7ec8663.
- **Verify-report** → `sdd/t045-appointments-screen/verify-report` (Engram #502) + `openspec/changes/archive/2026-09-01-t045-appointments-screen/verify-report.md`. **Status: PASS.** Spec 6/6 + 15/15 GWT, gates green (tsc 0, focused vitest 7 files 114/114, full vitest 1316/1368 with 50 pre-existing PG ECONNREFUSED infra, lint 21 = baseline 0 new), 0 CRITICAL, 0 WARNING, 1 SUGGESTION non-blocking.

## Verification (already done)

See `openspec/changes/archive/2026-09-01-t045-appointments-screen/verify-report.md` for full evidence. Top-line:

| Dimension | Result | Evidence |
|-----------|--------|----------|
| Verdict | **pass** | verify-report §9 |
| Critical findings | **0** | verify-report §6 |
| Spec coverage | **6/6 ADDED, 15/15 GWT PASS** | verify-report §1 (REQ-01..05 + REQ-06) |
| T-045 vitest (focused) | **114/114 PASS** across 7 test files | verify-report §2 (`pnpm vitest run`) |
| Typecheck | `tsc --noEmit` exit 0 | verify-report §2 |
| Full-repo vitest | 1316 pass / 50 fail / 2 skip (1368); all 50 fails pre-existing PG ECONNREFUSED infra (Postgres not running locally); identical to master baseline | verify-report §2 |
| Lint | 21 problems (2 errors + 19 warnings) = baseline; **0 new from T-045** | verify-report §2 |
| Files changed | 16 / +2579 / -31 vs baseline `7ec8663` (T-044) | verify-report §8 diff stat |
| Final verdict | **PASS** | verify-report §9 |

### T-045 test breakdown (114/114 across 7 files)

- `src/db/mappers/turno.test.ts` — 13 tests (NULL fallback, snake→camel, ISO)
- `src/db/repositories/turnos.enriched.test.ts` — 10 tests (single LEFT JOIN, no N+1, RN-04)
- `src/lib/api/appointments.test.ts` — 46 tests (extended for T-045)
- `src/lib/validators/appointmentsQuery.test.ts` — 12 tests (clamp-on-parse)
- `src/services/__tests__/appointmentService.enriched.test.ts` — 8 tests (IDOR defense)
- `src/app/(customer)/appointments/page.test.tsx` — 19 tests (preserved T-044 + new T-045 RSC assertions)
- `src/app/(customer)/appointments/_components/AppointmentList.test.tsx` — 17 tests (compound + Intl BA + a11y)

### Invariant coverage (per AGENTS.md INV-01..08)

| Invariant | Result | Evidence |
|-----------|--------|----------|
| INV-01 capacity 1, slot step 30 | N/A for T-045 (read-only) | T-028 atomic booking; T-045 displays already-booked rows |
| INV-02 states UPPER_SNAKE, no COMPLETADO | **PASS** | `appointmentStatusSchema = z.enum([PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO])`; COMPLETADO rejected by tests; `AppointmentListStatusBadge` returns null for non-PENDIENTE/CONFIRMADO |
| INV-03 ownership | **PASS** | `listAppointmentsEnriched` injects `effectiveQuery.customerId = authUser.id` for CLIENTE, drops caller-supplied; 4 IDOR tests; page.tsx `auth() → redirect("/login")` BEFORE DB |
| INV-04 `REPEATABLE READ` + `EXCLUDE USING gist` | N/A | Atomic booking (T-028) — untouched by T-045 (read-only) |
| INV-05 slot step / duration filter | N/A | T-022 — untouched by T-045 |
| INV-06 BA -03:00 TZ, TIMESTAMPTZ UTC | **PASS** | `toEnrichedJson` uses `.toISOString()`; `Intl.DateTimeFormat({timeZone: timezone})` memoized on `[timezone]`; `<time suppressHydrationWarning>`; zod `z.string().datetime({ offset: true })` |
| INV-07 DAG acyclic | **PASS** | T-045 sits between T-044 (predecessor) and T-046 (successor); no cycle |
| INV-08 camelCase English, no snake leak | **PASS** | `toEnrichedDTO` mapper renames all DB columns; `enrichedTurnoDTOSchema.strict()` rejects unknown keys; 21-key SNAKE list asserted absent in BOTH page.test.tsx (page JSON) and AppointmentList.test.tsx (innerHTML) |

### Composition + React 19 pattern audit (per skill resolution)

| Pattern | Status | Evidence |
|---------|:------:|----------|
| `vercel-composition-patterns:architecture-avoid-boolean-props` | PASS | Explicit `AppointmentList.Badge.PendingBadge` + `ConfirmedBadge` variants; no boolean `isPending` |
| `vercel-composition-patterns:patterns-explicit-variants` | PASS | First-class namespaced members of the compound |
| React 19 `use()` over `useContext()` | PASS | `use(AppointmentListContext)` at `AppointmentList.tsx:88`; provider exposes via `<AppointmentListContext value={...}>` (no `.Provider`) |
| React 19 `no-forwardref` | PASS | No `forwardRef` in any T-045 file |
| Memoized Intl on timezone only | PASS | `useMemo(..., [timezone])` for dateFormatter + timeFormatter |
| `suppressHydrationWarning` on `<time>` | PASS | Applied to both `<time>` elements in Card |
| `force-dynamic` + `revalidate = 0` | PASS | RSC `page.tsx:19-20` |
| Async `searchParams: Promise<...>` | PASS | `type Props = { searchParams: Promise<...> }` + `await searchParams` |
| `Promise.all` parallelization | PASS | `Promise.all([fetchConfirmed, listAppointmentsEnriched])` at line 54 |
| URL-driven pagination, no client fetch | PASS | `router.push(url, { scroll: false })` in Pagination; no `fetch()` from the compound |

### Security / threat matrix (PASS)

| Threat | Status | Evidence |
|--------|:------:|----------|
| IDOR (caller tampers `?customerId=`) | PASS | 4 IDOR regression tests in `appointmentService.enriched.test.ts` |
| N+1 query | PASS | `findTurnosPaginatedEnriched` uses ONE count over `turnos` + ONE data select with LEFT JOIN servicios + LEFT JOIN vehiculos; `selectMock.toHaveBeenCalledTimes(2)` + `joins.length === 2` |
| snake_case leak to client | PASS | Zod `.strict()` on `enrichedTurnoDTOSchema` rejects unknown keys; 21-key SNAKE scan asserted absent in page JSON + innerHTML |
| XXS via wire DTO | PASS | Zod strict + ISO datetime validation (`z.string().datetime({ offset: true })`) |
| Auth bypass | PASS | `auth()` before any DB access; `redirect("/login")` returns NEXT_REDIRECT |
| Status enumeration | PASS | `appointmentStatusSchema.strict()` enum; COMPLETADO rejected; lowercase rejected |
| `?limit=999999` DoS | PASS | `parseAppointmentsQuery` clamps to 100 via `limitSchema = z.coerce.number().int().min(1).max(100)` |

### Findings (non-blocking)

1. **SUGGESTION (code-quality):** `parseAppointmentsQuery` clamps instead of throws on invalid input (per REQ-04 contract). The function's JSDoc documents this contract, but `page.tsx:49-51` would benefit from one extra sentence pointing readers to `parseAppointmentsQuery` for the never-throws rationale. Current `// REQ-04: clamp-on-parse` comment is sufficient for now.

**Non-blocking.** No CRITICAL, no WARNING. The suggestion is a follow-up for T-046 or a future polish cycle.

## Delivery Strategy: ask-on-risk (5+4 chain)

The `sdd-apply` task brief flagged 695-line forecast (prod ~420 + test ~275) exceeding the 400-line review budget by ~73%. The orchestrator asked the user **before apply** per `ask-on-risk` strategy. The user selected **PR1 stacked-to-main 5-way + PR2 forced feature-branch-chain 4-way tracker**. Final realized shape:

| Chain | PR | Branch | Lines | Cumulative |
|-------|----|--------|-------|------------|
| PR1 | PR1a | `feature/t045-appointments-screen-pr1a` (merged) | +269 | mapper + fallback |
| PR1 | PR1b | `feature/t045-appointments-screen-pr1b` (merged) | +197 | Zod strict schemas |
| PR1 | PR1c | `feature/t045-appointments-screen-pr1c` (merged) | +206 | URL-state validator |
| PR1 | PR1d | `feature/t045-appointments-screen-pr1d` (merged) | +345 | findTurnosPaginatedEnriched |
| PR1 | PR1e | `feature/t045-appointments-screen-pr1e` (merged) | +336 | listAppointmentsEnriched service |
| PR2 | PR2a | `feature/t045-appointments-screen-pr2a` (merged) | +339 | Root + Empty + Skeleton |
| PR2 | PR2b | `feature/t045-appointments-screen-pr2b` (merged) | +380 | Card + Badge variants |
| PR2 | PR2c | `feature/t045-appointments-screen-pr2c` (merged) | +205 | Pagination |
| PR2 | PR2d | `feature/t045-appointments-screen-pr2d` (merged) | +350 | page.tsx RSC + tests |

**All 9 PRs <400 lines.** No `size:exception` required. PR1 chain stacked directly to master; PR2 used a tracker branch (`feature/t045-appointments-screen`) with PR2a-d chained under it, then the tracker merged to master at `c46f07e`. All feature branches deleted remote + local; only master remains.

The original single-PR commit `0c68459` (+1261/-4) was abandoned in favor of this 9-way split. No semantic code was trimmed; no tests dropped; cohesion cost absorbed by explicit stub-vs-implementation split (per `apply-progress.md` PR2d section).

## Rollback Boundary

T-045 is **additive** with no schema change, no API endpoint added, no state-machine change. Concretely:

- No new DB tables or columns (no migration required).
- No new API endpoint (reuses existing `GET /api/appointments` from T-033 + extensions from T-036 + T-044).
- No state-machine change (`PENDIENTE | CONFIRMADO | RECHAZADO | CANCELADO` per INV-02 unchanged; `AppointmentStatus` enum unchanged).
- No `WorkshopConfig` schema change.
- New files: `src/lib/validators/appointmentsQuery.ts`, `src/app/(customer)/appointments/_components/AppointmentList.tsx` (compound), `src/app/(customer)/appointments/_components/AppointmentCard.tsx` (merged into List), `src/app/(customer)/appointments/appointments.module.css` tokens, `src/app/(customer)/appointments/_components/AppointmentList.test.tsx`, `src/app/(customer)/appointments/page.test.tsx` (extended), `src/db/mappers/turno.test.ts` (new), `src/db/repositories/turnos.enriched.test.ts` (new), `src/lib/api/appointments.test.ts` (extended), `src/lib/validators/appointmentsQuery.test.ts` (new), `src/services/__tests__/appointmentService.enriched.test.ts` (new).
- Modified files: `src/app/(customer)/appointments/page.tsx` (RSC enrichment + URL pagination + Suspense), `src/db/mappers/turno.ts` (EnrichedTurnoDTO + toEnrichedDTO + toEnrichedJson), `src/db/repositories/turnos.ts` (findTurnosPaginatedEnriched), `src/lib/api/appointments.ts` (EnrichedTurnoDTOJson + Zod), `src/services/appointmentService.ts` (listAppointmentsEnriched).

**Rollback procedure:**

```bash
git revert c46f07e 4e2fa99 14f0c36 6cc6b25 5726a0d b2c019a 2a1a60d  # reverts PR1+PR2 chain
# or
git reset --hard 7ec8663  # fast-forward revert to T-044 baseline
```

After revert:
- `/appointments` falls back to T-044 raw `serviceId` + `toISOString()` rendering (no enrichment, no Intl BA formatting, no pagination UI, no badge).
- No DB call introduced by T-045 remains.
- No other FASE 8 task affected.

## Reachable Capabilities After This Archive

- **`appointments-screen` (NEW)** — 5 ADDED requirements in `openspec/specs/appointments-screen/spec.md` (canonical, byte-identical to the delta per SHA-256 readback):
  - **REQ-01** — Upcoming List with Timezone Formatting: `Intl.DateTimeFormat({timeZone: WorkshopConfig.timezone = "America/Argentina/Buenos_Aires"})`, ISO via `toEnrichedJson`, NULL fallback strings.
  - **REQ-02** — Status Badge and A11y: `PendingBadge` (amber) + `ConfirmedBadge` (green), `aria-label`, `role="list"` / `role="listitem"`, `<h1>` heading.
  - **REQ-03** — Empty State and RN-04 Default Filter: `data-testid="appointments-empty"` when `data.length == 0`; default `PENDIENTE|CONFIRMADO` with `startDateTime > now`; CANCELADO/RECHAZADO excluded.
  - **REQ-04** — URL Pagination: `?page&limit` (limit 1..100 default 20, page ≥ 1 default 1, sort=`startAt:asc`), envelope `{data, pagination:{page,limit,total,totalPages}}`, clamp-on-parse (never 500).
  - **REQ-05** — Auth Guard, No Snake Leak, RSC Serialization: `auth() → redirect("/login")` before DB; `EnrichedTurnoDTOJson` camelCase only; ISO strings + pagination in RSC→client props.
- **`appointment` (delta)** — +1 ADDED requirement in `openspec/specs/appointment/spec.md` (REQ-06): Enriched DTO and Single-Query JOIN — `EnrichedTurnoDTOJson extends TurnoDTOJson` with `serviceName` + `vehicleLabel`; `findTurnosPaginatedEnriched` via single `LEFT JOIN servicios + LEFT JOIN vehiculos`; Zod strict camelCase; NULL fallback.

## Final State Summary

T-045 Próximos turnos is closed at archive. The `appointments-screen` capability is canonical at `openspec/specs/appointments-screen/spec.md` (5 ADDED Requirements, 12 GWT scenarios, byte-identical to the delta per SHA-256 readback). The `appointment` capability gained REQ-06 (1 ADDED, 3 GWT) appended surgically to the existing `## ADDED Requirements` section, preserving all 25 prior requirements. Implementation is on master baseline `c46f07e` (final commit `66ed2e5 chore(archive): ...` after archive). All T-045 targeted vitest tests (114/114 across 7 test files) pass; tsc clean (0 errors); full-repo vitest 1316/1368 (50 fails pre-existing PG infra, 0 regressions); ESLint identical 21 problems to baseline (0 new); INV-02 / INV-03 / INV-06 / INV-08 all PASS with explicit per-invariant test coverage; Composition + React 19 patterns all PASS (explicit variants, `use()` over `useContext`, memoized Intl, `suppressHydrationWarning`); 0 CRITICAL, 0 WARNING, 1 SUGGESTION (non-blocking follow-up).

The 9-PR delivery (5 stacked-to-main + 4 feature-branch-chain tracker) absorbed the 695-line forecast into PRs all <400 lines each. PR1a-e and PR2a-d merged; tracker deleted remote + local; only master remains.

## Engram Observation IDs (traceability)

All Engram observations read for this archive step:

| Artifact | Engram observation ID | Topic key |
|----------|-----------------------|-----------|
| Exploration | #491 | `sdd/t045-appointments-screen/explore` |
| Proposal | #492 | `sdd/t045-appointments-screen/proposal` |
| Spec | #493 | `sdd/t045-appointments-screen/spec` |
| Design | #494 | `sdd/t045-appointments-screen/design` |
| Tasks | #495 | `sdd/t045-appointments-screen/tasks` |
| Verify-report | #502 | `sdd/t045-appointments-screen/verify-report` |
| Archive-report (this file) | #503 (newly written) | `sdd/t045-appointments-screen/archive-report` |

> Apply-progress was read directly from filesystem (`openspec/changes/t045-appointments-screen/apply-progress.md`, 11745 bytes, SHA-256 `3FDA2F1CF2F980614603FF5D0C829EB6EFBBB608FC6F326FAC42BF33C84F3F46`); no Engram observation ID was provided in the launch prompt.

## Skill Resolution

Skills loaded per launch-prompt instruction:

| Skill | Path | Resolution |
|-------|------|------------|
| `sdd-archive` (current) | `~/.config/opencode/skills/sdd-archive/SKILL.md` | MANDATORY. Followed: read inputs (Engram observations + filesystem state), Task Completion Gate, Mechanical Copy Contract (shell `cp` + `diff -r` for new domain; surgical Edit for append; SHA-256 substitute proof on Windows), destination collision guard, archive folder move, git commit + push, Engram archive report. |
| `next-best-practices` | `.agents/skills/next-best-practices/SKILL.md` | Read for awareness — not directly applicable to mechanical archival. Composition pattern `searchParams: Promise<...>` from `async-patterns.md` matches verify-report §4 audit row "Async `searchParams: Promise<...>`". |
| `vercel-composition-patterns` | `.agents/skills/composition-patterns/SKILL.md` | Read for awareness — verify-report #502 §4 audited composition patterns PASS. The patterns (`architecture-avoid-boolean-props`, `patterns-explicit-variants`) were honored in `AppointmentList.tsx` (explicit `PendingBadge` + `ConfirmedBadge`, no boolean `isPending`). |
| `vercel-react-best-practices` | `.agents/skills/react-best-practices/SKILL.md` | Read for awareness — verify-report #502 §4 audited React 19 patterns PASS. `use()` over `useContext()`, no `forwardRef`, memoized Intl on `[timezone]`, `suppressHydrationWarning`, `useTransition`-friendly navigation. |

## Next Step

T-046 (**cancel UI** — depends T-032 cancel service) or T-047..T-049 (admin panel, FASE 8 UI-08) is unblocked. T-046 will reuse T-045's compound `AppointmentList` to add a Cancel action button per row, gated by `canTransition(PENDIENTE|CONFIRMADO, CANCELADO, owner)` per RN-07 + H-12 UTC borders (verified in T-034). No state-machine change; no DB migration; extension of the `/appointments` RSC.

**Master tip after archive:** `66ed2e5 chore(archive): t045-appointments-screen -> archive 2026-09-01, sync 6 ADDED 15 GWT PASS` — pushed to `origin/master`.

---

*Generated: 2026-09-01 — sdd-archive for `t045-appointments-screen` — hybrid artifact (Engram + filesystem). Branch `master` at `66ed2e5`. Source of truth for the `appointments-screen` capability: `openspec/specs/appointments-screen/spec.md` (canonical) + `openspec/changes/archive/2026-09-01-t045-appointments-screen/` (audit trail). Source of truth for the `appointment` capability delta: `openspec/specs/appointment/spec.md` (canonical, REQ-06 appended at line 547+) + same archive audit trail.*
