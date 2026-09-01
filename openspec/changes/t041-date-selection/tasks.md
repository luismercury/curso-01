# Tasks: t041-date-selection — Fecha (H-25)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~615 (365 prod + 250 test) over 3 PRs |
| 400-line budget risk | Low (with chain) / Medium (without) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 foundation → PR2 islands → PR3 tests/docs |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

> Production alone ~365L < 400, but team policy (T-039/T-040) ships tests with code → ~615L total → chain. `auto-chain` strategy means orchestrator proceeds without asking; forecast is a guard, not a blocker.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | RSC + helpers + loading/error + nav | PR1 | `pnpm vitest run src/lib/validators/date.test.ts src/app/(customer)/appointments/new/page.test.tsx` | `pnpm dev` browser `/appointments/new?serviceId=<uuid>` | Services flow untouched |
| 2 | DateSelector compound island | PR2 | `pnpm vitest run src/app/(customer)/appointments/new/_components/DateSelector.test.tsx` | `pnpm dev` pick date, URL persists | Page still renders CTA |
| 3 | boundary tests + tracker docs | PR3 | `pnpm vitest run src/app/(customer)/appointments/new/{loading,error}.test.tsx` | `pnpm dev` throttle + throw | 2 test files only |

## Phase 1: Foundation (PR1 — `feature/t041-date-selection`)

- [ ] 1.1 `src/lib/validators/date.ts` — `DATE_MAX_DAYS=60`, `dateSchema` regex+noon `superRefine`, `getTodayBaYmd`, `addBaDays`, `isPastBa`, `getBaDayUtcRange` (Intl en-CA, no `toISOString`) [INV-06].
- [ ] 1.2 `src/lib/validators/date.test.ts` — vitest unit: BA vs UTC, DST round-trip, regex/overflow/past, +60 ceiling.
- [ ] 1.3 `appointments/new/appointments.module.css` — tokens; `.pageHeader .input .inputInvalid .hint .banner .cta`.
- [ ] 1.4 `appointments/new/page.tsx` — `force-dynamic`; `auth()→/login` [INV-03]; `getWorkshopConfig(db)`→`closedDows/tz`; `listServices({includeInactive:false})`; `searchParams.serviceId` UUID `find(active)`; `searchParams.date` via `dateSchema`+`getBaDayUtcRange`+`isPastBa`→`selectedDate|null`; `min/max` BA; render `DateSelector` or CTA `/services` [INV-08].
- [ ] 1.5 `appointments/new/loading.tsx` — skeleton `aria-busy="true"`, shimmers.
- [ ] 1.6 `appointments/new/error.tsx` — `unauthorized→/login`, else `reset()`, `role="alert"`, no `fecha` leak [INV-03/08].
- [ ] 1.7 `app/(customer)/layout.tsx` — nav link `Appointments → /appointments/new` (~5 LOC).
- [ ] 1.8 `appointments/new/page.test.tsx` — RSC: auth null→/login, tampered `?date=`→null no throw, past/overflow→null, missing service→CTA, valid→DateSelector [GWT 1, 2, 8, 10].

## Phase 2: Client Islands (PR2 — `feature/t041-date-selection-pr1`)

- [ ] 2.1 `_components/DateSelector.tsx` — `"use client"` compound; `createContext`+`use()`; `useSearchParams`+`useRouter`; `selectDate(ymd)` preserves siblings via `URLSearchParams(searchParams.toString())`; deletes `date` when empty.
- [ ] 2.2 `DateSelector.Input` — `<input type="date" min max>` bound to `searchParams.date`; `onChange→selectDate`; `closedDows` hint; `role="group"`.
- [ ] 2.3 `DateSelector.SelectedBanner` — Continue `href="?serviceId=&date="` when both selected [GWT 3, 4, 9].
- [ ] 2.4 `_components/DateSelector.test.tsx` — jsdom+RTL: push preserves siblings, clear deletes, `min/max`, closed hint [GWT 3, 4, 7, 9].

## Phase 3: Tests + Docs (PR3 — `feature/t041-date-selection-pr2`)

- [ ] 3.1 `loading.test.tsx` — skeleton `aria-busy="true"`.
- [ ] 3.2 `error.test.tsx` — 401 + retry, `role="alert"`, no `fecha` leak.
- [ ] 3.3 `git status` — commit untracked tracker docs as `chore(docs)` with RDD receipt.

## DAG (acyclic, feeds T-042)

`1.1→1.2→1.4→1.8` · `1.3→1.4` · `1.4→1.5,1.6→1.8` · `1.7→1.4` · `2.1→2.2,2.3→2.4` · `3.x` independent. PR1→PR2→PR3 chain. T-042 reads `searchParams.date/serviceId` (no coupling).
