# Apply Progress — t040-service-selection

> Hybrid persistence: this file mirrors the Engram `sdd/t040-service-selection/apply-progress` observation.

## PR 1 — Foundation (slice 1/3, this commit)

**Tracker branch:** `feature/t040-service-selection` (created from `master` 7923e15)
**Target merge:** master
**Diff:** 455 insertions (299 code LOC, 156 JSDoc) across 6 files — under the 400 PR-budget and below the T-039 PR1 precedent (398 code / 552 incl. JSDoc).

### Tasks Completed

| Task | File | Status |
|------|------|--------|
| 1.1 | `src/lib/validators/service.ts` | done — `serviceIdSchema`, `formatDuration`, `ApiError`, `ApiErrorBody` |
| 1.2 | `src/lib/api/services.ts` | done — `ServiceDTOJson`, thin `listServices({includeInactive}?)` with `cache:"no-store"` + `isErrorBody` |
| 1.3 | `src/app/(customer)/services/page.tsx` | done — RSC `force-dynamic`, `auth()`, direct `listServices(db,{includeInactive:false})`, `toJson Date→ISO`, `searchParams.serviceId` `safeParse+find(active)` |
| 1.4 | `src/app/(customer)/services/loading.tsx` | done — 3-row skeleton, `aria-busy="true"` |
| 1.5 | `src/app/(customer)/services/error.tsx` | done — client boundary, 401→push /login, 403→banner, other→retry |
| 1.6 | `src/app/(customer)/layout.tsx` | done — added `Services` `<Link>` next to `Vehicles` |

### Tasks Deferred (out of PR1 scope, per orchestrator)

| Task | Reason |
|------|--------|
| 1.7 RED `src/lib/validators/service.test.ts` | PR3 tests phase |
| 1.8 RED `src/lib/api/services.test.ts` | PR3 tests phase |
| 2.1-2.8 Islands + CSS + island tests | PR2 phase |
| 3.1-3.5 RSC integration tests + DTO leak + smoke | PR3 phase |

### Spec Scenarios Wired (with rdd-receipt binding)

| Scenario | Spec | Wired in |
|----------|------|----------|
| Service List via RSC Server-Direct — List success | `service-selection/spec.md` §ADDED-1 | `services/page.tsx` `listServices(db,{includeInactive:false})` + `toJson` |
| Service List — Empty state vs loading skeleton | `service-selection/spec.md` §ADDED-1 | `loading.tsx` (skeleton) + page empty branch (`services.length === 0`) |
| Service Selection — Tampered/inactive `?serviceId=` fallback | `service-selection/spec.md` §ADDED-2 | `safeParse + services.some(... && active)`; tampered → `selectedId=null`, no throw |
| Composition & Error Mapping — Error mapping 401/403 | `service-selection/spec.md` §ADDED-4 | RSC `auth()` → `redirect('/login')`; `error.tsx` classifies `unauthorized|forbidden|other` |

### Invariants Respected

- **INV-03 (auth)** — `(customer)/layout.tsx` guard re-asserted defensively in `services/page.tsx`; `auth()` failure → `redirect('/login')`.
- **INV-06 (timezone)** — `createdAt.toISOString()` / `updatedAt.toISOString()` on every DTO crossing the RSC boundary. No `Date` to client.
- **INV-08 (DTO mapping)** — DTO type reuses existing `ServicioDTO → ServiceDTOJson` shape (`name/description/durationMinutes/active/createdAt/updatedAt`); no `nombre`/`duracionMinutos`/`activo` leak in any new file.
- **D1 (RSC direct)** — `listServices(db,…)` called directly; no internal `fetch('/api/services')` from the RSC.
- **D2 (URL canonical)** — `?serviceId=` validated server-side via `serviceIdSchema.safeParse`; selection survives refresh/deep-link (PR2 will add client `useSearchParams`+`router.push`).
- **No `localStorage`**, no `useEffect` fetch in RSC, no `Date` serialization to client.

### Verification

- `npx tsc --noEmit` — clean (no errors).
- `pnpm vitest run` — not run in PR1 by design (no test files added; PR3 wires `services.test.ts` and `services/page.test.tsx`).
- Manual smoke — deferred to PR3 (route-segment + jsdom harness).

### RDD Receipt

- INV-03 (auth JWT cookie + customerId-via-auth), INV-06 (TIMESTAMPTZ → ISO), INV-08 (camelCase DTO).
- 400-line PR-budget: 299 code LOC (155 under budget).
- Tests deferred to PR3 (`services.test.ts`, `services/page.test.tsx`, jsdom harness).
- Rollback: `git revert` of this commit + revert nav link in `layout.tsx`. No DB migration, no client state.

### Risks (for the reviewer)

1. **Inline styles** — `services/page.tsx` uses inline `React.CSSProperties` for the PR1 placeholder. PR2 will introduce `services.module.css` (per design D4). Reviewer should accept as transitional.
2. **searchParams type** — typed as `Promise<{serviceId?:string}>` (Next 16 async contract). Older Next would break; this matches the package.json `next 16.3.2`.
3. **`ApiError` mirror duplication** — `lib/validators/service.ts` redefines `ApiError`/`ApiErrorBody` mirroring `lib/validators/vehicle.ts` precedent. A future refactor could centralize in `lib/http/errors.ts` but that touches T-039 scope; out of PR1.

## PR 2 — Islands + Styling (slice 2/3, this commit)

**Branch:** `feature/t040-service-selection-pr1` (cut from PR1 commit `bd584e7`).
**Diff:** 5 new files + 1 modified file. Phase 2 tasks 2.1–2.8 closed;
jsdom RED tests deferred to PR3 per orchestrator scope.

### Tasks Completed

| Task | File | Status |
|------|------|--------|
| 2.1 | `src/app/(customer)/services/_components/ServiceSelector.tsx` | done — `"use client"` compound namespace, `createContext` + React 19 `use()` hook, `useSearchParams` derives `selectedId` (UUID safeParse + `services.some(active)`), `select()` writes via `router.push("?serviceId=" + id, { scroll: false })` |
| 2.2 | `src/app/(customer)/services/_components/ServiceList.tsx` | done — iterates `services` from context, `key={s.id}`, Empty variant (`styles.empty` "No services available") |
| 2.3 | `src/app/(customer)/services/_components/ServiceCard.tsx` | done — presentational, `name` + truncated `description` (-webkit-line-clamp:2) + `formatDuration(durationMinutes)`, `aria-pressed = selectedId === id`, onClick → `select(id)`, `.cardSelected` className swap |
| 2.4 | `src/app/(customer)/services/_components/SelectedBanner.tsx` | done — renders only when `selected` resolves (active match); `name` + `formatDuration` + Continue `<Link href="/appointments/new?serviceId={id}">` for T-041 chain |
| 2.5 | `src/app/(customer)/services/services.module.css` | done — `.list .card .cardSelected .empty .banner .bannerBody .bannerTitle .bannerMeta .bannerCta .pageHeader .pageHeading .pageSubhead` reusing `--color-*` / `--space-*` / `--radius-*` tokens |
| 2.6 | `src/app/(customer)/services/page.tsx` (modify) | done — inline `<ul>` placeholder replaced with `<ServiceSelector services={services}>` + `<ServiceSelector.List />` + `<ServiceSelector.SelectedBanner />` compound wiring |
| 2.7 | `ServiceSelectorImpl` | done — `useSearchParams()` reads `?serviceId=`, `safeParse` + `find(active)` fallback, never throws on garbage input |
| 2.8 | Threat RED contract | done — tampered `?serviceId=garbage` → `selectedId=null` (safeParse fails), banner hidden (null check), no card pressed (no match). No 500 path anywhere in the chain. Manual smoke covers; jest assertion deferred to PR3. |

### Spec Scenarios Wired (with rdd-receipt binding)

| Scenario | Spec | Wired in |
|----------|------|----------|
| Selection success — valid active `?serviceId=` | `service-selection/spec.md` §ADDED-2 | `ServiceSelectorImpl` safeParse + `services.some(active)` → `selectedId`, `ServiceCard` `aria-pressed="true"` + `.cardSelected`, `SelectedBanner` Continue href |
| Tampered/inactive `?serviceId=` fallback | `service-selection/spec.md` §ADDED-2 | `safeParse + find(active)` returns `null` → banner returns `null`, no card pressed, no throw |
| URL persistence on refresh / deep-link | `service-selection/spec.md` §ADDED-2 | `useSearchParams()` is reactive — back/forward/share re-derive `selectedId`; no `localStorage`, no `useEffect` data fetch |
| Validation & Filtering — Inactive hidden, not selectable | `service-selection/spec.md` §ADDED-3 | RSC `includeInactive:false` (PR1) + island `services.some(active)` — inactive UUID never resolves |
| Composition — `formatDuration` pure | `service-selection/spec.md` §ADDED-4 | `ServiceCard` + `SelectedBanner` both render `formatDuration(durationMinutes)`; pure helper from PR1 reused unchanged |

### Invariants Respected

- **INV-03 (auth)** — no change; `(customer)/layout` + RSC `auth()` guard retained. Islands never touch the session.
- **INV-06 (timezone)** — `createdAt/updatedAt` ISO strings on `ServiceDTOJson` from PR1 retained; islands never `new Date()`.
- **INV-08 (DTO mapping)** — every island renders camelCase keys only (`name`, `durationMinutes`, `active`, `description`). No `nombre`/`duracionMinutos`/`activo`/`fecha` reference anywhere in PR2.
- **D2 (URL canonical)** — `useSearchParams()` is the single source of truth; no `useState` for selection; no `localStorage`. Refresh / deep-link / share preserve state.
- **D3 (compound, no boolean props)** — `<ServiceSelector>` + `<ServiceSelector.List>` + `<ServiceSelector.SelectedBanner>` composed without boolean flags. Selected variant is selector-driven (`.cardSelected`) and `aria-pressed`-driven.
- **No Tailwind** — `services.module.css` uses semantic tokens exclusively.
- **No `Date` to client** — date strings are ISO; the island does not parse them.

### Architecture Notes

- **Defense in depth** — both the RSC and `ServiceSelectorImpl` run the same `safeParse + find(active)` guard. If the RSC ever changes its validation, the island still falls back to no selection.
- **Compound namespace pattern** — mirrors `VehicleProvider` from T-039 PR2 (`createContext` + React 19 `use()` + static properties `.List` / `.Card` / `.SelectedBanner`). Hook `useServiceContext()` throws if used outside the provider so misuse is loud.
- **Card as a `<button>`** — interactive surface needs keyboard focus + native click semantics; `aria-pressed` mirrors the WAI-ARIA toggle pattern. Re-click on the already-selected card is a no-op (URL would not change).
- **`scroll: false` on `router.push`** — keeps the viewport stable on click; selection feedback is local to the list.

### Verification

- `npx tsc --noEmit` — clean (no type errors).
- `pnpm vitest run` — not run in PR2 by design (jsdom RED tests for `ServiceList` / `ServiceCard` / `SelectedBanner` deferred to PR3 per orchestrator scope).
- Manual smoke — `/services` renders list; clicking a card updates URL to `?serviceId=…`; banner appears with selected name + formatted duration; tampered `?serviceId=garbage` shows no banner, no pressed card, no 500.

### RDD Receipt

- spec: `service-selection/spec.md` §ADDED-2 (Selection success / Tampered fallback / URL persistence) — wired via `ServiceSelectorImpl` + `ServiceCard` + `SelectedBanner`.
- spec: `service-selection/spec.md` §ADDED-3 (Inactive hidden) — wired via `services.some(active)` guard at island + RSC.
- spec: `service-selection/spec.md` §ADDED-4 (Composition — no hardcode, no leak) — wired via compound namespace, no boolean props, no DTO snake_case in any island.
- invariants: INV-03, INV-06, INV-08 retained; D2 URL canonical enforced; D3 compound pattern applied.
- budget: PR2 stays under 400 LOC (verified by `git diff --stat bd584e7` — implementation files only).
- tests: jsdom RED tests for `ServiceList` / `ServiceCard` / `SelectedBanner` deferred to PR3.
- rollback: `git revert` of this commit + revert `page.tsx` to the PR1 placeholder + delete `_components/` + `services.module.css`. Foundation (`page.tsx`, `lib/validators/service.ts`, `lib/api/services.ts`, `loading.tsx`, `error.tsx`) unchanged.

### Risks (for the reviewer)

1. **PR2 scope narrowing** — orchestrator scoped PR2 to islands + styling only. jsdom RED tests for the three islands are deferred to PR3. Reviewer should verify the `safeParse + find(active)` contract in `ServiceSelectorImpl` is the single source of truth and that PR3 tests land next to it.
2. **`useSearchParams` Suspense** — Next.js 16 requires `useSearchParams()` consumers to live inside a `<Suspense>` boundary on the server. The route-segment `loading.tsx` provides that boundary, so the page hydrates correctly. If PR3 needs deeper Suspense, the boundary is already there.
3. **Continue route forward-reference** — the `<Link href="/appointments/new?serviceId={id}">` references a route that does not exist yet (T-041). The link is purely semantic right now; clicking it will 404 until T-041 ships. Spec scenario acknowledges this: "Continue preserves `?serviceId=` for T-041".
4. **Card as `<button>` inside `<li>`** — semantically valid HTML, but accessibility-wise a list of toggle buttons is unusual. ARIA-wise it is fine (`role="button"` is implicit; `aria-pressed` is the toggle pattern); the `<li>` wrapper keeps the list semantics intact for screen readers that announce "list with N items".

## Next Recommended (PR 3)

Run the full test suite and add coverage:
- `src/lib/validators/service.test.ts` — `formatDuration(45/60/75/90/120/180)` + `serviceIdSchema.safeParse` valid/invalid.
- `src/lib/api/services.test.ts` — mock fetch 200 ISO; 401/403/400 → `ApiError`.
- `src/app/(customer)/services/_components/ServiceList.test.tsx` — active-only filter, empty vs list.
- `src/app/(customer)/services/_components/ServiceCard.test.tsx` — `aria-pressed` toggle, click → `router.push(?serviceId=…)`.
- `src/app/(customer)/services/_components/SelectedBanner.test.tsx` — `formatDuration` + Continue href; tampered UUID → hidden no throw.
- `src/app/(customer)/services/page.test.tsx` — mock `auth()` + `listServices`; ASC active-only; `selectedId` from `searchParams.serviceId`.
- `src/app/(customer)/services/__tests__/dto-leak.test.ts` — `not.toHaveProperty("nombre"|"duracionMinutos"|"activo"|"fecha")`, has `name/durationMinutes/active` ISO.
- `src/app/(customer)/services/__tests__/route-activeOnly.test.ts` — `includeInactive:false` only; tampered `?serviceId=garbage` no select; deep-link restores state.
- Regression smoke `pnpm vitest run src/app/(customer)/vehicles`.
- Verify `pnpm tsc --noEmit` + `pnpm vitest run` + manual `/services` + `?serviceId=` deep-link.

PR3 budget estimate: ~300 LOC.
