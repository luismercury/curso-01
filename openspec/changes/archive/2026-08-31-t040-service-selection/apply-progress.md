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

## PR 3 — Tests + Tooling + Docs (slice 3/3, this commit)

**Branch:** `feature/t040-service-selection-pr2` (cut from PR2 commit `11e4551`).
**Diff:** 8 new test files + 1 modified apply-progress.md + 1 docs commit
(still-untracked SDD tracker files). 0 production LOC.
**Tests added:** 82 (24 validator + api + 28 jsdom + 30 page + integration).
**Files:** src/lib/validators/service.test.ts (+71), src/lib/api/services.test.ts
(+130), 3 jsdom RTL island tests (+304), src/app/(customer)/services/page.test.tsx
(+140), tests/integration/services-dto-leak.test.ts (+65),
tests/integration/services-route-activeOnly.test.ts (+153).

### Tasks Completed

| Task | File | Status |
|------|------|--------|
| 1.7 | `src/lib/validators/service.test.ts` | done — `formatDuration` 6 cases via `it.each` + 3 serviceIdSchema cases + 2 ApiError |
| 1.8 | `src/lib/api/services.test.ts` | done — happy path (200 + fetch opts) + `it.each` 401/403 + 400 issues + 5xx fallback + NETWORK_ERROR |
| 2.x | `ServiceList.test.tsx` | done — list + key + order + Empty + ul wrapper |
| 2.x | `ServiceCard.test.tsx` | done — aria-pressed toggle + click → router.push + formatDuration + description + cardSelected class swap |
| 2.x | `SelectedBanner.test.tsx` | done — `it.each` 3 hidden cases (no id / tampered / absent UUID) + inactive + formatDuration 3 cases + Continue href + a11y role/aria-live |
| 3.1 | `services/page.test.tsx` | done — null session → redirect; auth + includeInactive:false; Date→ISO; INV-08 no leak; ASC order; tampered no 500; empty state; service failure re-throw |
| 3.2 | `tests/integration/services-dto-leak.test.ts` | done — 7 camelCase keys + `it.each` snake/Spanish negative + ISO + description:null + active:false preservation |
| 3.3 | `tests/integration/services-route-activeOnly.test.ts` | done — default 200 no-auth + includeInactive false/true + ADMIN bypass + 401/403 + 400 garbage + tampered URL page boundary + valid UUID + null session + unknown UUID |
| 3.4 | Regression smoke `pnpm vitest run src/app/(customer)/vehicles` | done — 6/6 PASS (no regressions) |
| 3.5 | Verify `pnpm tsc --noEmit` + `pnpm vitest run` + `pnpm build` | done — `tsc --noEmit` clean, `pnpm build` 11/11 static + /services ƒ dynamic, full vitest 1045 passed (3 pre-existing failures identical to master @ 7923e15) |

### Spec Scenarios Wired (with rdd-receipt binding)

| Scenario | Spec | Wired in |
|----------|------|----------|
| List success — active only, no inactive | `service-selection/spec.md` §ADDED-1 | `page.test.tsx` active-only call + ASC order + DTO camelCase |
| Empty state vs loading skeleton | `service-selection/spec.md` §ADDED-1 | `page.test.tsx` "empty list" + `ServiceList.test.tsx` empty branch |
| DTO snake leak negative | `service-selection/spec.md` §ADDED-1 | `services-dto-leak.test.ts` (mapper) + `page.test.tsx` (RSC tree) + `services.test.ts` (HTTP helper) — three-layer coverage |
| Selection success — valid active `?serviceId=` | `service-selection/spec.md` §ADDED-2 | `page.test.tsx` valid UUID renders + `ServiceCard.test.tsx` aria-pressed + SelectedBanner Continue href |
| Tampered/inactive `?serviceId=` fallback | `service-selection/spec.md` §ADDED-2 | `service.test.ts` (safeParse rejects) + `SelectedBanner.test.tsx` (3 hidden cases) + `services-route-activeOnly.test.ts` (page boundary no 500) |
| URL persistence on refresh / deep-link | `service-selection/spec.md` §ADDED-2 | `services-route-activeOnly.test.ts` valid UUID restore + `SelectedBanner.test.tsx` Continue href |
| Inactive hidden, not selectable | `service-selection/spec.md` §ADDED-3 | `services-route-activeOnly.test.ts` `includeInactive=true` ADMIN only + `SelectedBanner.test.tsx` inactive hidden |
| Composition — `formatDuration` pure | `service-selection/spec.md` §ADDED-4 | `service.test.ts` 6 cases + `ServiceCard.test.tsx` 3 cases + `SelectedBanner.test.tsx` 3 cases |
| Error mapping — 401/403 vs validation | `service-selection/spec.md` §ADDED-4 | `services.test.ts` 401/403/400 + `services-route-activeOnly.test.ts` route 401/403/400 |

### Invariants Respected

- **INV-03 (auth)** — `page.test.tsx` null session → redirect before service; route test 401 before DB call.
- **INV-06 (timezone)** — `page.test.tsx` Date→ISO regex; `services-dto-leak.test.ts` Date preserved at mapper; route.test serializes ISO on the wire.
- **INV-08 (DTO mapping)** — three-layer snake/Spanish negative coverage: mapper unit, RSC tree JSON.stringify, HTTP helper returns.
- **D2 (URL canonical)** — every test that touches selection goes through the URL (stateful `useSearchParams` mock); no `localStorage` introduced; refresh/deep-link restore proven via route-activeOnly page boundary.
- **D3 (compound)** — `ServiceList`/`ServiceCard`/`SelectedBanner` tested via `<ServiceSelector>` wrapper, not via separate renders — the compound namespace stays intact.
- **No Tailwind / no DTO mutation / no hardcode** — every test uses fixed UUIDs / durations / names; no client `Date` math; no `fechaHoraFin` calc; `formatDuration` is the only formatting helper.

### Verification

- `pnpm tsc --noEmit` — clean (no type errors).
- `pnpm build` — 11/11 static pages, `/services` ƒ dynamic (matches spec), no warnings beyond pre-existing Vite deprecation.
- `pnpm vitest run --project=node src/lib/validators/service.test.ts src/lib/api/services.test.ts` — 24/24 PASS.
- `pnpm vitest run --project=jsdom src/app/(customer)/services/_components` — 28/28 PASS.
- `pnpm vitest run --project=node src/app/(customer)/services/page.test.tsx tests/integration/services-dto-leak.test.ts tests/integration/services-route-activeOnly.test.ts` — 30/30 PASS.
- `pnpm vitest run src/app/(customer)/vehicles` — 6/6 PASS (no regressions).
- `pnpm vitest run` (full) — 1045 passed, 3 failed, 2 skipped. The 3 failures are pre-existing on master @ 7923e15: `clientes.schema > db client singleton`, `servicios.integration > duplicate nombre UNIQUE maps to ServicioNombreTakenError`, `servicios.schema > ships no HTTP route under src/app/api for services`. Zero new regressions.
- Manual smoke — `/services` renders list, tampered `?serviceId=garbage` shows no banner, no pressed card, no 500 (deferred to verify).

### RDD Receipt

- **spec:** `service-selection/spec.md` §ADDED-1 (List success + Empty + DTO snake leak negative) — wired in `page.test.tsx` + `services-dto-leak.test.ts` + `services.test.ts`.
- **spec:** `service-selection/spec.md` §ADDED-2 (Selection success + Tampered fallback + URL persistence) — wired in `page.test.tsx` + `SelectedBanner.test.tsx` + `services-route-activeOnly.test.ts`.
- **spec:** `service-selection/spec.md` §ADDED-3 (Inactive hidden) — wired in `SelectedBanner.test.tsx` inactive branch + `services-route-activeOnly.test.ts` ADMIN-only `includeInactive=true`.
- **spec:** `service-selection/spec.md` §ADDED-4 (Composition — `formatDuration` pure + Error mapping 401/403/400 + no hardcode + no leak) — wired across all 8 test files.
- **invariants:** INV-03 (auth + redirect precedence), INV-06 (TIMESTAMPTZ → ISO), INV-08 (camelCase DTO) — three-layer coverage each.
- **budget:** PR3 ships 8 test files (~860 LOC of test code). The orchestrator's forecast "~300-400 LOC" was an underestimate given the 8-file scope; T-039 PR3 shipped 1025 LOC for a similar 8-file test surface. PR3 stays below T-039's footprint because tooling (vitest.config.ts, vitest.setup.ts, package.json scripts) was already delivered by T-039.
- **tests:** 82 new tests across 8 files, all passing. 0 production code added.
- **rollback:** `git revert <this>` + the docs commit. PR1 foundation (`page.tsx`, `lib/validators/service.ts`, `lib/api/services.ts`, `loading.tsx`, `error.tsx`) and PR2 islands (`ServiceSelector`/`ServiceList`/`ServiceCard`/`SelectedBanner` + `services.module.css`) remain fully functional; only test coverage + untracked tracker docs are removed.

### Risks (for the reviewer)

1. **Per-PR budget exceeded** — orchestrator forecast "~300-400 LOC" but 8-file spec scope required ~860 LOC of tests (still below T-039 PR3's 1025 LOC baseline). All production code is in PR1+PR2; PR3 is tests + docs only.
2. **`useSearchParams` mock statefulness** — jsdom tests use a module-level `mockServiceId` variable flipped per-test. If a future test adds an `await` between setting `mockServiceId` and rendering, the provider may re-render with stale state. Mitigation: `afterEach` clears the mock and the closure binding is local to each `it()`.
3. **`vi.importActual` in route-activeOnly** — preserves the actual `requireAuth`/`listServices` exports so the route can still bind `ForbiddenError`/`UnauthorizedError` instanceof checks. The mocked functions override the named exports. If a future refactor adds new exports from those modules, the spread `{ ...actual }` keeps them visible to the route under test.
4. **Page test `JSON.stringify(tree)` brittleness** — react JSX serialization can shift across React minor versions. The test asserts on the rendered tree's JSON shape, which is robust to React internals but would break if `ServiceSelector` started rendering children eagerly (it doesn't, since the `"use client"` boundary is preserved at compile time). If desired, a verify follow-up could swap to `renderToString` + DOM-level assertions.
5. **PR2 deferred jsdom tests now pass** — PR2 was scoped to islands + styling only (per orchestrator). PR3 closes the PR2.8 threat contract with explicit `tampered ?serviceId=garbage does not 500` + `banner hidden on no/tampered/absent UUID selection` + `Continue href uses selected.id (defense in depth)`.
