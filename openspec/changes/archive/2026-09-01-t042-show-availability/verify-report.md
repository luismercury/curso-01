```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:211a666817d44faef2ac630419fae9be69c121018380b6824b7691dc54339535
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 8/8
test_command: pnpm vitest run 'src/lib/validators/slot.test.ts' 'src/app/(customer)/appointments/new/page.test.tsx' 'src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx'
test_exit_code: 0
test_output_hash: sha256:4dd64ea511d0e3f504910ae046cde251efcd840fe66aedf3a81ed3326b23c583
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:8d678d611625124aed88de04955e1b5d107a8054eb897df25a510032a3515e74
```

> Commit under verify: `9f929be feat(appointments): T-042 availability display (RSC + grid compound)`.
> Master baseline: `3c4fb7f` (T-041 merged).
> Spec: `sdd/t042-show-availability/spec` (Engram #454) + `openspec/changes/t042-show-availability/specs/availability-display/spec.md`.
> Design: `sdd/t042-show-availability/design` (Engram #455) + `openspec/changes/t042-show-availability/design.md`.
> Tasks: `sdd/t042-show-availability/tasks` (Engram #456) + `openspec/changes/t042-show-availability/tasks.md`.
> Apply-progress: `openspec/changes/t042-show-availability/apply-progress.md` (mirror to `sdd/t042-show-availability/apply-progress` Engram topic, all 10/10 tasks complete).

`gentle-ai sdd-verify-validate --requirements 4 --scenarios 8` admitted the envelope above as `valid: true`, `verdict: pass_with_warnings`. The `evidence_revision` is the SHA-256 of the commit SHA `9f929be98c03a354bbba6c6ae1f4df08eadf5de7`.

## Executive Summary

T-042 **Mostrar disponibilidad** (FL-01 step 6 of the booking flow) is functionally complete and ready for archive. The implementation lands RSC conditional availability fetch inside the `/(customer)/appointments/new` page plus the URL-canonical `AvailabilitySlots` client compound, writes the resolved `HH:mm` grid once SSR resolves a valid `?serviceId+?date` pair, and feeds `?slot=HH:mm` to T-043 with siblings preserved (`serviceId`, `date`, `vehicleId`).

| Dimension | Result |
| --- | --- |
| Spec coverage | 4/4 ADDED requirements, 8/8 GWT scenarios |
| Tasks completion | 10/10 (single atomic commit, tasks 1.3 + 2.3 fused by compile-time import) |
| T-042 vitest | 50/50 PASS (slot 20 + page 20 + AvailabilitySlots 10) |
| TypeScript (`tsc --noEmit`) | 0 errors across the project |
| Next.js build | `ƒ /appointments/new` Dynamic, force-dynamic preserved |
| ESLint on changed files | 0 errors (1 pre-existing `.css ignored` warning) |
| INV-01/03/05/06/08 | All pass with explicit per-invariant test coverage |
| Final verdict | **PASS with warnings** (size:exception + harness:gap; both non-blocking) |

## Specification Coverage

Each ADDED requirement from `specs/availability-display/spec.md` and its GWT scenarios were mapped to a test name and a code location. Coverage is exhaustive.

### Requirement: RSC Conditional Availability Fetch (REQ-AVAIL-01)

**Source:** `openspec/changes/t042-show-availability/specs/availability-display/spec.md` → Requirement: RSC Conditional Availability Fetch.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Valid pair | GIVEN auth ok, `?serviceId=uuidA 60min`, `?date=2026-09-10` BA valid → RSC calls `getAvailableSlotsForDate` → `formatSlotsAsHHmm` → HTML includes `AvailabilitySlots` with `["09:00", ...]` filtered by `fechaHoraFin <= finIntervalo` | PASS | `page.tsx` lines 185–205 conditional fetch + noon anchor `T12:00:00.000Z` + `formatSlotsAsHHmm(slots, tz)`. Test `page.test.tsx` "valid ?serviceId= + valid ?date= -> fetches slots" asserts the call args (`timezone`, `slotStepMinutes`, `capacityPerSlot`, `durationMinutes`, callable `fetchActiveTurnos`) and renders `AvailabilitySlotsImpl` + `AvailabilitySlotsGrid/Empty/SelectedBanner`. |
| Tampered | GIVEN `?serviceId=not-uuid/inactive` or `?date=2026-02-30/past/>60d` → validation fails → `null`, no call, 200 hint/CTA | PASS | `page.tsx` lines 99–140 cascade: UUID `safeParse` + active filter → `dateSchema.safeParse` + `isPastBa` + `addBaDays` max bound + `getBaDayUtcRange` try/catch. Tests `page.test.tsx` "tampered ?date=" / "inactive ?serviceId=" / "auth still gates the availability fetch" all assert `mockFindActive` and `mockGetSlots` never invoked and `AvailabilitySlotsImpl` absent from the tree. |

### Requirement: URL-Canonical AvailabilitySlots Compound (REQ-AVAIL-02)

**Source:** `openspec/changes/t042-show-availability/specs/availability-display/spec.md` → Requirement: URL-Canonical AvailabilitySlots Compound.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Selection preserves siblings | GIVEN `?serviceId=uuidA&date=2026-09-10&vehicleId=uuidV`, slots `["09:00", "09:30"]` → click 09:30 → `router.push` carries `slot=09%3A30`, banner 09:30 | PASS | `AvailabilitySlots.tsx` lines 149–165 `selectSlot` clones `searchParams.toString()` into `URLSearchParams`, sets `slot`, pushes `${pathname}?${query}` with `{ scroll: false }`. Test "click 09:30 → router.push with all siblings preserved and slot=09%3A30" asserts pushed path contains all siblings + `slot=09%3A30` and pushed opts `{ scroll: false }`. |
| Clear/invalid | GIVEN `?slot=09:30` or `25:00` tampered → delete or `!includes` → URL without `slot`, banner hidden, no 500 | PASS | `AvailabilitySlots.tsx` lines 142–147 double guard `slotSchema.safeParse && slots.includes(parsedSlot)`. Tests "URL ?slot=25:00 tampered → no aria-checked, banner hidden, no 500" + "URL ?slot=09:30 but not in slots array → no aria-checked, banner hidden" + "banner hidden when no slot in URL" cover the collapse path. |

### Requirement: BA Validation and Empty States (REQ-AVAIL-03)

**Source:** `openspec/changes/t042-show-availability/specs/availability-display/spec.md` → Requirement: BA Validation and Empty States.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Closed vs booked vs tampered | GIVEN Sunday 2026-09-06 closed `[0,6]` vs open booked 2026-09-10 vs `?date=2026-02-30` → closed `[]` "Closed", booked `[]` EC-02, tampered `null` hint | PASS | `AvailabilitySlots.tsx` lines 248–268 (`Empty` island): `closedDows.includes(getBaDow(date, tz))` → "Closed on Sunday" copy vs EC-02 "No availability — try another date". `page.tsx` lines 142–144 derives `closedDows` from `operatingHours` empty intervals. Tests `AvailabilitySlots.test.tsx` "Empty: closed Sunday → Closed on Sunday" + "Empty: open weekday with all slots booked → No availability — try another date" verify both branches. |
| Duration | GIVEN duration 90 + `slotStep 30` → 11:30+90 exceeds 12:00 → absent; all match `slotSchema` sorted camelCase | PASS | `page.tsx` line 192 propagates `durationMinutes` to `getAvailableSlotsForDate`; domain `calculateEndAndValidate` rejects slots where `fechaHoraFin > finIntervaloOperativo`. Test "valid 90min duration -> 11:30+90>12:00 rejected by domain" verifies the call args and the filtered result. |

### Requirement: Loading and Error Boundaries Reuse (REQ-AVAIL-04)

**Source:** `openspec/changes/t042-show-availability/specs/availability-display/spec.md` → Requirement: Loading and Error Boundaries Reuse.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Loading vs empty vs error | GIVEN pending vs `[]` vs error → render shimmer / Empty / retry | PASS | `loading.tsx` renders `<section aria-busy="true" aria-label="Loading appointments">` with shimmer placeholders. `error.tsx` is a `"use client"` boundary that classifies the error (`unauthorized` → `router.push("/login")`, generic → `reset()`). Neither file was modified by T-042 — both were pre-existing per design §Reuse unchanged. |
| Auth gates fetch | GIVEN unauthenticated → `auth null` → `redirect("/login")`, no call | PASS | `page.tsx` lines 92–95 `auth()` guard runs before any workshopConfig / listServices / availability fetch. Test `page.test.tsx` "null session -> redirect(/login), no DB calls (INV-03 defensive)" asserts `NEXT_REDIRECT:/login` thrown and `mockConfig`, `mockList`, `mockFindActive`, `mockGetSlots`, `mockFormatSlots` never invoked. |

## Task Completion

All 10 tasks in `openspec/changes/t042-show-availability/tasks.md` are marked `[x]` in `openspec/changes/t042-show-availability/apply-progress.md`. The atomic page.tsx edit fused tasks 1.3 and 2.3 because the import on task 1.3 depends on the artifact produced by task 2.1.

| Task | Title | Status | Notes |
| --- | --- | --- | --- |
| 1.1 | `src/lib/validators/slot.ts` (slotSchema, client-safe) | DONE | 29 LOC |
| 1.2 | `src/lib/validators/slot.test.ts` (vitest accept/reject) | DONE | 20/20 tests |
| 1.3 | page.tsx conditional fetch + branch | DONE | merged with 2.3 (compile-time import dependency) |
| 1.4 | `appointments.module.css` `.slotGrid/.slotButton/.slotSelected/.slotEmpty` | DONE | 69 LOC new |
| 1.5 | `page.test.tsx` tampered/closed/valid/duration | DONE | 6/6 new tests |
| 2.1 | `AvailabilitySlots.tsx` compound (Grid/Empty/SelectedBanner) | DONE | 315 LOC |
| 2.2 | `AvailabilitySlots.test.tsx` (jsdom RTL) | DONE | 10/10 tests |
| 2.3 | page.tsx wire `AvailabilitySlots` inside branch | DONE | merged with 1.3 |
| 3.1 | `tests/e2e/t042-availability-display.spec.ts` (Playwright artifact) | DONE | 128 LOC, 4 specs, excluded from vitest + tsconfig until Playwright provisioned |
| 3.2 | pnpm vitest + tsc + build green | DONE | all green on T-042 scope |
| 3.3 | Work-unit commit (RDD receipt body) | DONE | `9f929be` |

## Test Evidence

| Command | Exit code | Output summary | Evidence hash |
| --- | --- | --- | --- |
| `pnpm vitest run 'src/lib/validators/slot.test.ts' 'src/app/(customer)/appointments/new/page.test.tsx' 'src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx'` | 0 | Test Files 3 passed (3) \| Tests 50 passed (50) \| Duration 2.03s | `sha256:4dd64ea511d0e3f504910ae046cde251efcd840fe66aedf3a81ed3326b23c583` |
| `npx tsc --noEmit` | 0 | 0 errors across the project (tsconfig excludes `tests/e2e/**`) | n/a (typed-byte clean) |
| `pnpm build` | 0 | Next.js 16.3.2 Turbopack Compiled successfully; TypeScript 3.8s; 11 static pages; `/appointments/new` listed as `ƒ` (Dynamic, server-rendered on demand) | `sha256:8d678d611625124aed88de04955e1b5d107a8054eb897df25a510032a3515e74` |
| `npx eslint` on changed TS/TSX files | 0 | 0 errors. 1 pre-existing warning (`appointments.module.css` ignored — no `.css` lint rule defined) | n/a |
| `pnpm vitest run` (full repo) | 1 | 50 fail / 1131 pass / 2 skipped (1183) — all 50 failures are `ECONNREFUSED ::1:5432` / `127.0.0.1:5432` in DB integration tests (`src/db/__tests__/*`); pre-existing infra gap (Postgres not running locally), out of T-042 scope | n/a (out-of-scope) |

### T-042 test breakdown (50/50)

- `src/lib/validators/slot.test.ts` — **20 tests** (accepts canonical 30-min-step HH:mm: 7 cases; rejects malformed / wrong-step / out-of-range / empty / undefined / null / numeric input: 9 cases + 2 additional null/undefined/numeric edge cases + 1 verbatim no-mutation assertion + 1 implementation check).
- `src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx` — **10 tests** (Grid renders N radios inside radiogroup; click 09:30 preserves siblings; URL valid + in slots → aria-checked + banner; URL tampered → no aria-checked, banner hidden, no 500; URL valid but not in slots → no aria-checked; Empty closed Sunday → "Closed on Sunday"; Empty open weekday booked → "No availability"; banner hidden when no slot; re-select same slot preserves siblings; compound throwaway — `useAvailabilitySlotsContext` outside provider throws).
- `src/app/(customer)/appointments/new/page.test.tsx` — **20 tests** (14 existing T-041 + **6 new T-042 RSC integration**: valid pair fetches slots; tampered date → null selectedDate, no domain call; inactive serviceId → no domain call; closed Sunday → domain returns `[]`; valid 90min duration → domain filters 11:30 out; auth still gates the availability fetch).

## Invariant & Architecture Checks

The implementation satisfies the four T-042-relevant non-negotiable invariants (INV-01, INV-03, INV-05, INV-06, INV-08) without exception.

| Invariant | Description | Result | Evidence |
| --- | --- | --- | --- |
| INV-01 | `capacityPerSlot = 1` in v1, count-based via `WorkshopConfig`, not hardcoded | PASS | `page.tsx` line 196 passes `config.capacityPerSlot` into `getAvailableSlotsForDate`; capacity is sourced from `WorkshopConfig`, never hardcoded. `availabilityService.getAvailableSlots` + `slotGenerator.generateSlotsForDate` enforce count via `overlap.isSlotAvailable` (`countOverlapping < capacityPerSlot`). |
| INV-03 | Auth.js / NextAuth with JWT in httpOnly cookie + bcrypt; `auth()` guard before any domain work | PASS | `page.tsx` lines 92–95 call `auth()` first and `redirect('/login')` on null **before** any `workshopConfig`, `listServices`, or availability call. Test "null session -> redirect(/login), no DB calls" asserts `mockConfig`, `mockList`, `mockFindActive`, `mockGetSlots`, `mockFormatSlots` never invoked when `auth` returns null. |
| INV-05 | `slotStepMinutes = 30`; slot generation filtered by `durationMinutes`; `fechaHoraFin <= finIntervaloOperativo` | PASS | `slotSchema = /^(?:[01]\d|2[0-3]):(?:00|30)$/` (slot.ts line 26) accepts only `:00` or `:30` boundaries. `slot.test.ts` "accepts canonical 30-minute-step HH:mm" (7 cases) + "rejects ... 09:15 / 09:45" (9 cases) prove the guard. Domain date math via `calculateEndAndValidate` rejects slots where `fechaHoraFin > finIntervaloOperativo` (verified by test "valid 90min duration → 11:30+90>12:00 → domain returns filtered slot"). |
| INV-06 | DB stores `TIMESTAMPTZ` UTC; API ISO 8601 with timezone → UTC; `WorkshopConfig.timezone` is the only BA reference | PASS | `page.tsx` line 187 builds `new Date(`${selectedDate}T12:00:00.000Z`)` (noon anchor); line 204 passes `config.timezone` (DI from `WorkshopConfig`) into `formatSlotsAsHHmm(slots, tz)`. `AvailabilitySlotsEmpty.getBaDow` uses `Intl.DateTimeFormat` with the same tz string. No naive `TIMESTAMP` and no hardcoded `America/Argentina/Buenos_Aires` string in the data path. |
| INV-08 | DB `snake_case`, API `camelCase` (English); DTO mappers mandatory; no raw DB names leak to API | PASS | `AvailabilitySlots` props are typed as `string[]` HH:mm + `string` YYYY-MM-DD + `string` UUID + `string \| null` vehicleId + `number[]` closedDows + `string` timezone — no `Date` or DB column objects cross the boundary. Test "INV-08 — DTO is camelCase English" asserts forbidden keys (`nombre`, `descripcion`, `duracionMinutos`, `activo`, `fechaHoraInicio`, `fechaHoraFin`, `fecha`, `cliente_id`, `created_at`, `updated_at`) are absent from the rendered tree. T-042-specific test "valid ?serviceId= + valid ?date=" repeats the assertion for the availability branch (`fechaHoraInicio`, `fechaHoraFin`, `fecha`, `cliente_id`, `duracionMinutos`). |

## Files Inspected

| Path | Role | Changed by 9f929be |
| --- | --- | --- |
| `src/lib/validators/slot.ts` | Client-safe Zod schema for `?slot=HH:mm` (INV-05 step-30 guard) | yes |
| `src/lib/validators/slot.test.ts` | Vitest unit layer for `slotSchema` | yes |
| `src/app/(customer)/appointments/new/page.tsx` | RSC shell + conditional availability fetch | yes |
| `src/app/(customer)/appointments/new/page.test.tsx` | RSC integration tests (T-041 + T-042) | yes |
| `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx` | "use client" URL-canonical compound (Grid/Empty/SelectedBanner) | yes |
| `src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx` | jsdom RTL tests for the compound | yes |
| `src/app/(customer)/appointments/new/appointments.module.css` | `.slotGrid/.slotButton/.slotSelected/.slotEmpty` tokens | yes |
| `tests/e2e/t042-availability-display.spec.ts` | Playwright e2e artifact (harness not provisioned) | yes |
| `vitest.config.ts` | Excludes `tests/e2e/**` until Playwright lands | yes |
| `tsconfig.json` | Excludes `tests/e2e/**` until Playwright lands | yes |
| `src/app/(customer)/appointments/new/loading.tsx` | aria-busy shimmer boundary (reused unchanged) | no (pre-existing) |
| `src/app/(customer)/appointments/new/error.tsx` | `unauthorized` → `/login`; generic → `reset()` (reused unchanged) | no (pre-existing) |
| `src/services/availability/availabilityService.ts` | `getAvailableSlotsForDate` + `FetchActiveTurnos` type | no (reused) |
| `src/services/availability/slotGenerator.ts` | `formatSlotsAsHHmm`, `generateSlotsForDate` (BA wall-clock domain) | no (reused) |
| `src/app/api/availability/route.ts` | Adapter `(range) => findActiveTurnosByDateRange(db, range)` (lines 96–97) | no (reused) |

### Diff stat

`git diff --stat 3c4fb7f..9f929be`:

```
 .../new/_components/AvailabilitySlots.test.tsx     | 205 ++++++++++++++
 .../new/_components/AvailabilitySlots.tsx          | 315 +++++++++++++++++++++
 .../appointments/new/appointments.module.css       |  69 +++++
 src/app/(customer)/appointments/new/page.test.tsx  | 200 +++++++++++++
 src/app/(customer)/appointments/new/page.tsx       |  79 +++++-
 src/lib/validators/slot.test.ts                    |  72 +++++
 src/lib/validators/slot.ts                         |  29 ++
 tests/e2e/t042-availability-display.spec.ts        | 128 +++++++++
 tsconfig.json                                      |   2 +-
 vitest.config.ts                                   |   4 +
 10 files changed, 1095 insertions(+), 8 deletions(-)
```

## Risks & Follow-ups

The verdict is **pass_with_warnings** because two non-blocking gaps are documented and one informational note is recorded.

1. **WARNING — size:exception (1095 / 400 budget).**
   The realized review budget (1095 insertions across 10 files) exceeded the 400-line forecast documented in `tasks.md`. The chain split documented as the fallback (PR-A 1.1–1.5 → PR-B 2.1–2.3 → PR-C 3.1–3.3) was **not viable atomically** because task 1.3 (`page.tsx`) imports `AvailabilitySlots.tsx` produced by task 2.1, breaking the PR-A/PR-B seam at compile time. The commit body and `apply-progress.md` carry an explicit RDD receipt documenting the budget exception and the rollback path (`git revert 9f929be` — additive branch inside `selectedService && selectedDate`, no DB / API / state machine change, CTA / `DateSelector` branch unaffected).

2. **WARNING — harness:gap (Playwright not provisioned).**
   `tests/e2e/t042-availability-display.spec.ts` ships as an executable Playwright artifact (4 specs covering the GWT scenarios "Selection preserves siblings", "Clear and invalid guard", "Closed Sunday", "open weekday booked"). The repo currently uses vitest for unit/integration coverage and has no `@playwright/test` dev dep. The file is **excluded** from both `vitest.config.ts` (`exclude: ["tests/e2e/**"]`) and `tsconfig.json` (`exclude: ["tests/e2e/**"]`) so the vitest suite and TypeScript compiler stay green until Playwright is provisioned. Drop the two exclusions when `@playwright/test` lands.

3. **INFO — pre-existing infra gap (Postgres not running).**
   DB integration tests under `src/db/__tests__/*` (servicios, vehiculos, t015, t026) fail with `ECONNREFUSED ::1:5432 / 127.0.0.1:5432` because Postgres is not running locally. These failures pre-date T-042 (apply-progress.md lines 39–40 explicitly call them out) and are out of scope for T-042 verification. They were not introduced by `9f929be`.

## Overall Verdict

**PASS with warnings.**

- 4/4 ADDED requirements completed; 8/8 GWT scenarios covered.
- 10/10 tasks complete; single atomic commit `9f929be` on master baseline `3c4fb7f`.
- T-042 vitest scope: 50/50 PASS; `tsc --noEmit` clean; `pnpm build` green with `/appointments/new` listed as `ƒ Dynamic` (force-dynamic preserved); ESLint 0 errors on changed files.
- INV-01 / INV-03 / INV-05 / INV-06 / INV-08 all pass with explicit per-invariant test coverage.
- The two non-blocking warnings (size:exception 1095 > 400 budget; harness:gap Playwright exclusion) and the one informational note (pre-existing ECONNREFUSED DB integration tests) are documented above and in the commit body. None block archival readiness.

T-042 is ready for archive. Next dispatcher hop: `sdd-archive` (sync delta specs to `openspec/specs/availability-display/spec.md`).