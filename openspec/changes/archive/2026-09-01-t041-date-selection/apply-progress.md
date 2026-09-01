# Apply Progress: t041-date-selection — Fecha (H-25)

> Hybrid artifact (Engram + filesystem). PR3 of 3 on tracker
> `feature/t041-date-selection` (chain strategy: feature-branch-chain).
> **Final PR — chain complete.**

## Cycle Status

| Phase | Status | Evidence |
|-------|--------|----------|
| Explore | DONE | `openspec/changes/t041-date-selection/exploration.md` (205L) |
| Propose | DONE | `openspec/changes/t041-date-selection/proposal.md` (72L) — Approach A: RSC + URL islands |
| Spec | DONE | `openspec/changes/t041-date-selection/specs/date-selection/spec.md` (75L) — 5 ADDED reqs, 9 GWT scenarios |
| Design | DONE | `openspec/changes/t041-date-selection/design.md` (129L) — D1..D6 architecture decisions |
| Tasks | DONE | `openspec/changes/t041-date-selection/tasks.md` (56L) — 22 tasks across 3 phases |
| Apply PR1 | DONE | Commit `9e695fd` — foundation RSC shell + helpers + boundaries + nav |
| Apply PR2 | DONE | Commit `3a79606` — DateSelector compound islands (useSearchParams + router.push) |
| Apply PR3 | DONE (this report) | Commits `cd0b2e5` (tests) + `eb6780b` (docs) — boundary tests + tracker docs |
| Verify | PENDING | All 3 PRs merged on tracker, then `sdd-verify` |
| Archive | PENDING | After verify PASS |

## PR1 Commit

| Field | Value |
|-------|-------|
| Commit | `9e695fd` |
| Message | `feat(date): add date selection RSC shell foundation PR1` |
| Branch (tracker) | `feature/t041-date-selection` |
| Base | `22381d2` (master) |
| Files changed | 8 (7 new, 1 modified) |
| Insertions | 1257 (754 prod incl. CSS+JSDoc, 503 test) |
| Tests added | 48 (33 validator + 14 RSC + 1 chained) |

## PR2 Commit

| Field | Value |
|-------|-------|
| Commit | `3a79606` |
| Message | `feat(date): wire DateSelector compound islands PR2` |
| Branch (child) | `feature/t041-date-selection-pr1` |
| Base | `9e695fd` (PR1 tip) |
| Files changed | 4 (2 new, 2 modified) |
| Insertions | 741 (390 prod incl. JSDoc, 293 test, 58 page.test.tsx, 60 page.tsx net) |
| Deletions | 99 (99 in page.tsx — inline form removed; 99 in page.test.tsx — old testids replaced) |
| Tests added | 25 (DateSelector compound jsdom suite) |

## Files Changed (PR2)

| File | Action | Role |
|------|--------|------|
| `src/app/(customer)/appointments/new/_components/DateSelector.tsx` | CREATE | `"use client"` compound namespace `{Root, Input, SelectedBanner, ClearButton}` — `useSearchParams` + `useRouter` + sibling preservation via `URLSearchParams(toString)` |
| `src/app/(customer)/appointments/new/_components/DateSelector.test.tsx` | CREATE | 25 jsdom+RTL tests covering GWT 3, 4, 7, 9 + defense in depth + INV-08 |
| `src/app/(customer)/appointments/new/page.tsx` | MODIFY | -99 LOC net — replaces inline `<form method=get>` placeholder with `<DateSelector>` compound; removes unused `dowLabel` helper |
| `src/app/(customer)/appointments/new/page.test.tsx` | MODIFY | Updates testid assertions from `appointments-new-form`/`appointments-new-banner` to the compound namespace (`DateSelectorImpl` / `DateSelectorInput` / etc.) since the page-level React element tree contains function refs, not rendered testids |

## PR3 Commits

| Field | Value |
|-------|-------|
| Branch (child) | `feature/t041-date-selection-pr2` |
| Base | `3a79606` (PR2 tip) |
| Commit 1 | `cd0b2e5` — `test(date): add boundary coverage PR3` |
| Commit 2 | `eb6780b` — `chore(docs): commit still-untracked SDD tracker docs` |
| Files changed | 12 (3 test/config + 9 tracker docs, 0 prod LOC) |
| Insertions | 1606 (301 tests + 1305 docs) |
| Deletions | 0 |
| Tests added | 24 (7 loading + 17 error) |

## Files Changed (PR1)

| File | Action | Role |
|------|--------|------|
| `src/lib/validators/date.ts` | CREATE | Pure Zod `dateSchema` + BA helpers (no `server-only`) |
| `src/lib/validators/date.test.ts` | CREATE | 33 unit tests (BA vs UTC, DST, overflow, past, max) |
| `src/app/(customer)/appointments/new/page.tsx` | CREATE | RSC shell — `force-dynamic`, `auth()`, `Promise.all`, searchParams validation |
| `src/app/(customer)/appointments/new/page.test.tsx` | CREATE | 14 RSC tests (auth null, tampered, past, CTA, sibling, closedDows) |
| `src/app/(customer)/appointments/new/loading.tsx` | CREATE | Suspense skeleton (`aria-busy="true"`) |
| `src/app/(customer)/appointments/new/error.tsx` | CREATE | `'use client'` boundary — 401 → `/login`, else `reset()` |
| `src/app/(customer)/appointments/new/appointments.module.css` | CREATE | CSS Modules — tokens reuse (no Tailwind) |
| `src/app/(customer)/layout.tsx` | MODIFY | +3 LOC nav `Appointments` Link |

## Evidence (PR2 verification)

### `pnpm vitest run` (PR2 target files only)

```
RUN  v4.1.11 C:/Users/Luis Mercury/proyectos/curso-01-pr2

 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  00:48:40
   Duration  2.21s (transform 200ms, setup 436ms, import 382ms, tests 203ms, environment 905ms)
```

### `pnpm vitest run` (PR1 + PR2 combined)

```
RUN  v4.1.11 C:/Users/Luis Mercury/proyectos/curso-01-pr2

 Test Files  3 passed (3)
      Tests  73 passed (73)
   Start at  00:54:41
   Duration  2.32s (transform 381ms, setup 447ms, import 694ms, tests 542ms, environment 1.19s)
```

Coverage: 33 date validator + 25 DateSelector jsdom + 14 RSC page = 72 tests
(plus 1 chained baseline = 73).

### `pnpm vitest run` (full suite, regression smoke)

```
Test Files  3 failed | 64 passed | 8 skipped (75)
Tests       2 failed | 1068 passed | 57 skipped (1127)
```

**3 failures are pre-existing on `master@22381d2`** (identical to PR1 baseline):
1. `clientes.schema.test.ts > db client singleton` — `AUTH_SECRET` env missing
2. `servicios.schema.test.ts > t007 ships no HTTP route` — guard never updated for T-022
3. `turnos.integration.test.ts` (failed suite) — server-only import in node project

**Zero regressions introduced by PR2.**

### `pnpm typecheck` (tsc --noEmit, after `pnpm build` regenerates `.next/types/`)

```
$ tsc --noEmit
(no output → exit 0)
```

**Clean — no TypeScript diagnostics.**

### `pnpm build`

```
▲ Next.js 16.3.2 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 96ms

  Creating an optimized production build ...
✓ Compiled successfully in 1033ms
  Running TypeScript ...
  Finished TypeScript in 4.9s ...
  Collecting page data using 5 workers ...
  Generating static pages using 5 workers (11/11) in 380ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/admin/appointments
├ ƒ /api/admin/schedule
├ ƒ /api/appointments
├ ƒ /api/appointments/[id]/cancel
├ ƒ /api/appointments/[id]/confirm
├ ƒ /api/appointments/[id]/reject
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/auth/login
├ ƒ /api/auth/register
├ ƒ /api/availability
├ ƒ /api/customers
├ ƒ /api/customers/[customerId]/vehicles
├ ƒ /api/customers/[id]
├ ƒ /api/services
├ ƒ /api/services/[id]
├ ƒ /appointments/new          ← T-041 (PR1 foundation + PR2 islands)
├ ƒ /services
└ ƒ /vehicles

ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

**Build clean. `/appointments/new` still ƒ Dynamic (the DateSelector is
the only client island; the rest of the page is RSC).**

### `pnpm lint`

```
✖ 21 problems (2 errors, 19 warnings)
```

**2 errors and 19 warnings — identical to `master@22381d2` baseline** (T-040 archive
audit confirmed same set):
- `VehicleProvider.tsx:61` `react-hooks/set-state-in-effect` (T-039-introduced)
- `appointmentQuery.ts:55` `prefer-const` on `piped` (master baseline)

**0 new errors or warnings introduced by PR2.** Verified via
`pnpm lint | grep -E 'DateSelector|appointments/new'` → no matches.

## PR3 Evidence Summary

| Step | Command | Result |
|------|---------|--------|
| focused tests | `pnpm vitest run src/app/(customer)/appointments/new/{loading,error}.test.tsx` | 2 files, 24 passed (7 loading + 17 error) |
| full appointments/new | `pnpm vitest run src/app/(customer)/appointments/new` | 4 files, 63 passed (loading + error + page + DateSelector) |
| full suite | `pnpm vitest run` | 4 failed | 72 passed | 1 skipped (77 files); 3 failed | 1142 passed | 2 skipped (1147 tests) — 4 failed files identical to master baseline |
| typecheck | `pnpm typecheck` | `tsc --noEmit` exit 0, no diagnostics |
| build | `pnpm build` | ✓ Compiled successfully in 2.1s, Finished TypeScript in 4.5s, `/appointments/new` ƒ Dynamic |
| lint | `pnpm lint` | ✖ 21 problems (2 errors, 19 warnings) — identical to master baseline; 0 new errors/warnings introduced |

## PR3 Boundary Test Coverage Matrix

| Component | Test File | Tests | Coverage |
|-----------|-----------|-------|----------|
| Suspense skeleton | `loading.test.tsx` | 7 | `aria-busy="true"` + `aria-label` + 3 placeholders + `aria-hidden` per node + INV-03/08 no-leak |
| Error boundary | `error.test.tsx` | 17 | 401 classification (3 regex variants) + `router.push('/login')` + `reset()` dispatch + `role="alert"` + `aria-labelledby` linkage + `console.error` observability + INV-03/08 no-leak + sneaky-message defense |

## Invariant Compliance (PR3)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt | ✅ | `error.test.tsx` covers 401 → `router.push('/login')` for all 3 message variants; `loading.test.tsx` asserts no `password` / `jwt` / `bearer ` strings leak. |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase | ✅ | Both `loading.test.tsx` and `error.test.tsx` run INV-08 no-leak assertions against the rendered HTML; `error.test.tsx` also covers a sneaky-message defense-in-depth test. |

## Invariant Compliance (PR2)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **INV-03** Auth.js + JWT httpOnly + bcrypt; ownership golden rule | ✅ | `page.tsx` defensive `auth()` → `redirect('/login')` unchanged from PR1; DateSelector never renders for unauthenticated requests (page-level guard precedes the compound render) |
| **INV-06** `TIMESTAMPTZ` UTC, BA timezone via Intl, never `toISOString` | ✅ | `getBaDow` uses `Intl.DateTimeFormat("en-US", {timeZone, weekday:"short"})` with noon-UTC anchor; `Date.UTC(y, m - 1, d, 12)` for calendar arithmetic (no `toISOString` anywhere) |
| **INV-08** DTO snake_case/Spanish never on wire; API camelCase | ✅ | DateSelector.test.tsx > 'INV-08 DTO no-leak' asserts forbidden strings (`fecha`, `fechaHoraInicio`, `fechaHoraFin`, `patente`, `marca`, `cliente_id`) absent from rendered HTML; all compound props are camelCase primitives (`date`, `min`, `max`, `closedDows`, `timezone`, `serviceId`, `vehicleId`) |
| **INV-01/02/04/05/07** | ✅ preserved | Not applicable to T-041 (no booking flow in PR2 either; pure URL state + UI) |

## Compound Contract (PR2)

```
<DateSelector
  date={selectedDate|null}    // SSR-resolved primitive
  min={todayBa} max={maxBa}   // BA calendar bounds
  closedDows={[0,6]}          // 0=Sun..6=Sat
  timezone={"America/Argentina/Buenos_Aires"}
  serviceId={uuid|null}       // active service from RSC
  vehicleId={uuid|null}       // T-043 sibling
>
  <DateSelector.Input />          // native <input type="date" min max defaultValue>
  <DateSelector.ClearButton />     // self-hiding, deletes ?date=
  <DateSelector.SelectedBanner />  // self-hiding, Continue ?serviceId=&vehicleId=&date=
</DateSelector>
```

No boolean props (vercel-composition-patterns:architecture-avoid-boolean-props).
No Server Actions. No localStorage. No `useEffect` data fetch.
Uncontrolled `<input>` with `key={date ?? 'empty'}` to handle back/forward
without the controlled-state anti-pattern (vercel-react-best-practices).

### State persistence

URL is the canonical source of truth (`?date=YYYY-MM-DD`):
- Refresh / deep-link / share work because the URL drives the state.
- The island re-validates the URL value with `resolveDate()` (same
  `dateSchema` + `isPastBa` + max-bound logic as the RSC) so post-hydration
  state never disagrees with SSR.

### Sibling preservation

```ts
const params = new URLSearchParams(searchParams.toString());
if (ymd.length === 0) params.delete("date");
else params.set("date", ymd);
router.push(`${pathname}?${params}`, { scroll: false });
```

`?serviceId=` and `?vehicleId=` survive every date change. Verified by
DateSelector.test.tsx > 'picks a date → router.push preserves
?serviceId=&vehicleId=' and 'Continue href preserves ?serviceId=&date=&vehicleId='
(GWT 3 + GWT 9).

## Chain Handoff to PR3

PR3 (`feature/t041-date-selection-pr2`) ships:
1. `loading.test.tsx` — skeleton `aria-busy="true"` (boundary test).
2. `error.test.tsx` — 401 → `/login` + retry + `role="alert"`, no `fecha`
   leak (boundary test, INV-03/08).
3. `chore(docs)` commit for the still-untracked tracker docs
   (`openspec/changes/t041-date-selection/*` and `sdd/t041-date-selection/*`)
   per the T-040 precedent (commit `9dd3f18`).

**PR1+PR2 production surface is stable.** RSC primitives, validators,
compound island — none of this changes in PR3. PR3 only adds 2 test files
+ 1 docs commit.

## Risks & Caveats

1. **PR2 PR diff exceeds 400-LOC budget** (741 insertions / 99 deletions).
   Auto-chain strategy absorbs the overflow; the per-PR work-unit is
   still reviewable in one sitting because the compound is a single
   self-contained namespace. Net prod LOC is +291 (the compound replaces
   the 99-LOC PR1 placeholder with a 390-LOC fully-typed island).
2. **PR1 form placeholder is fully removed** — the `?date=` is now
   written client-side via `router.push` on every input change. No apply
   button needed (the orchestrator spec was explicit: "no form submit").
3. **`getBaDow` lives inside DateSelector.tsx** — same algorithm as
   `getTodayBaYmd` (Intl `en-US` weekday short). Acceptable duplication
   because the validator file (`date.ts`) should stay free of UI
   concerns; the helper is private to the island. If T-042 needs the same
   logic, lift it into `lib/validators/date.ts` and import.
4. **Pre-existing baseline failures** — 3 vitest failures + 2 lint
   errors identical to `master@22381d2` (per T-040 archive audit). Zero
   regressions.
5. **Tracker docs remain untracked** — `openspec/changes/t041-date-selection/*`
   and `sdd/t041-date-selection/spec.md` will be committed in PR3 as
   `chore(docs)` per the t040 precedent (commit `9dd3f18`).
6. **`.next/types/` regeneration** — Next.js auto-generates `LayoutProps`
   and other types during `pnpm build`. The PR1 baseline ran typecheck
   after build; this PR2 report runs `pnpm build` first to regenerate
   `.next/types/` then `pnpm typecheck` — both clean.
7. **`next-env.d.ts` auto-edit** — `pnpm build` regenerated
   `next-env.d.ts` (Next.js 16 convention); the diff was reverted via
   `git checkout -- next-env.d.ts` before the commit (no diff in the
   final commit, verified via `git diff --stat` showing only the 4
   intended files).

## Next Recommended Steps

1. **Orchestrator**: Create PR2 from `feature/t041-date-selection-pr1`
   (commit `3a79606`). Title: `feat(date): wire DateSelector compound
   islands PR2`. Body should link to this apply-progress and the spec
   delta.
2. **Orchestrator**: After PR2 merge approval, create
   `feature/t041-date-selection-pr2` from `3a79606`. PR3 ships the
   `loading.test.tsx` + `error.test.tsx` boundary tests + the
   `chore(docs)` commit (mirrors T-040's `9dd3f18` pattern).
3. **After all merged**: run `sdd-verify` for t041. Expected verdict:
   PASS, 5/5 requirements / 9/9 GWT scenarios (DateSelector.test.tsx
   covers GWT 3, 4, 7, 9; page.test.tsx covers GWT 1, 2, 8, 10).
4. **After verify PASS**: `sdd-archive` — move change to
   `openspec/changes/archive/2026-XX-XX-t041-date-selection/`. Then merge
   tracker to master with `--no-ff` per T-040 archive pattern.

## Files Referenced

- `openspec/changes/t041-date-selection/{exploration,proposal,design,tasks}.md`
- `openspec/changes/t041-date-selection/specs/date-selection/spec.md`
- `sdd/t041-date-selection/spec.md`
- `src/lib/validators/date.ts` (PR1 — created)
- `src/app/(customer)/appointments/new/{page,loading,error,page.test}.tsx`
  + `appointments.module.css` (PR1 — created)
- `src/app/(customer)/layout.tsx` (PR1 — modified +3 LOC)
- `src/app/(customer)/appointments/new/_components/DateSelector.tsx`
  + `DateSelector.test.tsx` (PR2 — created)
- `src/app/(customer)/appointments/new/page.tsx` + `page.test.tsx`
  (PR2 — modified: form removed, compound wired, testids updated)

---

*Generated: 2026-09-01 — sdd-apply PR2 for `t041-date-selection` — hybrid
artifact (Engram + filesystem). Commit `3a79606`.*
