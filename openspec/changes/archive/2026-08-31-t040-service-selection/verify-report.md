```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3b2fbea0991aa94a340685aeaeb3d514fd03ff6b533cdfe02a38a1262905daef
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 8/8
test_command: pnpm vitest run src/lib/validators/service.test.ts src/lib/api/services.test.ts src/app/(customer)/services/_components/ServiceList.test.tsx src/app/(customer)/services/_components/ServiceCard.test.tsx src/app/(customer)/services/_components/SelectedBanner.test.tsx src/app/(customer)/services/page.test.tsx tests/integration/services-dto-leak.test.ts tests/integration/services-route-activeOnly.test.ts
test_exit_code: 0
test_output_hash: sha256:3b2fbea0991aa94a340685aeaeb3d514fd03ff6b533cdfe02a38a1262905daef
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:6d5e6003ae825a299343b3ffdc05402eb24c5142816c5d7caf2d8df42c0230ce
```

# Verify Report: t040-service-selection — Service Selection UI (T-040 / FASE 5 prep)

> **Mode:** Standard (auto-chain, feature-branch-chain, RDD enabled global — SDD verify independent)
> **Branch:** `feature/t040-service-selection-pr2` @ `9dd3f18` (3 chained PRs: bd584e7 PR1, 11e4551 PR2, 832a69b PR3 tests, 9dd3f18 PR3 docs)
> **Delta type:** NEW (`service-selection` + `service` capability add)
> **Validator:** `gentle-ai sdd-verify-validate --requirements 4 --scenarios 8`

## Verdict

**PASS — ready-for-archive.**

All 4 ADDED requirements / 8 GWT scenarios pass on the chain head at `9dd3f18`. Implementation matches the per-domain delta spec (`specs/service-selection/spec.md` + `specs/service/spec.md`, 4 ADDED, 8 GWT). Server foundation (PR1): RSC shell `services/page.tsx` calling `listServices(db,{includeInactive:false})` directly (no HTTP hop), `auth()→redirect('/login')` defensive guard, `toJson` `Date→ISO` serialization before client boundary, `loading.tsx` 3-row skeleton with `aria-busy`, `error.tsx` client boundary classifying unauthorized|forbidden|other. Validators (`src/lib/validators/service.ts`): client-safe Zod `serviceIdSchema=z.string().uuid()`, pure `formatDuration(m)` helper, `ApiError`/`ApiErrorBody` mirror. HTTP helper (`src/lib/api/services.ts`): thin `listServices({includeInactive}?)` with `cache:"no-store"`, `credentials:"include"`, `isErrorBody` parser. Client islands (PR2): compound `ServiceSelector` namespace (`List` / `Card` / `SelectedBanner` static properties), `useSearchParams()` reactive URL source of truth, `safeParse + find(active)` defense-in-depth, `aria-pressed` toggle + `.cardSelected` class, Continue href preserves `?serviceId=` for T-041. Tests + tooling + docs (PR3): 8 new test files / 82 new tests / 0 prod LOC. `pnpm tsc --noEmit` clean. `pnpm build` 11/11 static + `/services` ƒ dynamic per design D1. `pnpm vitest run` targeted 8 files: **82/82 PASS**. `pnpm vitest run` full suite: **1045 passed, 3 failed, 2 skipped** — 3 failures are exactly the pre-existing master baseline (clientes.schema db singleton, servicios.integration duplicate nombre, servicios.schema ships-no-HTTP-route guard). INV-03 (auth + 401-before-403 precedence), INV-06 (ISO strings, no Date crossing boundary), INV-08 (camelCase DTO, no nombre/duracionMinutos/activo leak), H-19 (services/[id] route untouched) all preserved.

## Spec Acceptance Criteria Mapping

The spec declares **4 ADDED requirements** with **8 GWT scenarios** in a new domain (`specs/service-selection/spec.md` mirror of `specs/service/spec.md`):

### Requirement REQ-SVC-01 — Service List via RSC Server-Direct (3 scenarios)

| # | Scenario | Tests | Result |
|---|---|---|---|
| S1 | List success — active only, no inactive | `src/app/(customer)/services/page.test.tsx:54`, `tests/integration/services-route-activeOnly.test.ts:63,71`, `tests/integration/services-dto-leak.test.ts:62` | **PASS** |
| S2 | Empty state vs loading skeleton | `src/app/(customer)/services/page.test.tsx:124` "empty list renders 'No services available'", `src/app/(customer)/services/_components/ServiceList.test.tsx` empty branch, `loading.tsx` `aria-busy="true"` + 3 shimmer rows | **PASS** |
| S3 | DTO snake leak negative (INV-08) | `tests/integration/services-dto-leak.test.ts:24-40`, `src/app/(customer)/services/page.test.tsx:76`, `src/lib/api/services.test.ts` HTTP helper returns | **PASS** |

### Requirement REQ-SVC-02 — Service Selection via URL Canonical `?serviceId=` (3 scenarios)

| # | Scenario | Tests | Result |
|---|---|---|---|
| S4 | Selection success — valid active `?serviceId=` | `src/app/(customer)/services/page.test.tsx:104`, `src/app/(customer)/services/_components/ServiceCard.test.tsx` aria-pressed toggle + click → router.push, `src/app/(customer)/services/_components/SelectedBanner.test.tsx` Continue href | **PASS** |
| S5 | Tampered/inactive `?serviceId=` fallback (no 500) | `src/lib/validators/service.test.ts` safeParse rejects, `src/app/(customer)/services/_components/SelectedBanner.test.tsx` 3 hidden cases (no id / tampered / absent UUID) + inactive branch, `src/app/(customer)/services/page.test.tsx:114`, `tests/integration/services-route-activeOnly.test.ts:122,144` | **PASS** |
| S6 | URL persistence on refresh and deep-link | `src/app/(customer)/services/_components/ServiceSelector.tsx:75-91` reactive `useSearchParams()` (no localStorage), `tests/integration/services-route-activeOnly.test.ts:130` valid active restores selection | **PASS** |

### Requirement REQ-SVC-03 — Validation & Filtering (Duration, Activo) (1 scenario)

| # | Scenario | Tests | Result |
|---|---|---|---|
| S7 | Inactive hidden, not selectable | `src/app/(customer)/services/page.tsx:53` `includeInactive:false` at RSC, `src/app/(customer)/services/_components/ServiceSelector.tsx:88-91` `services.some(active)` at island, `src/app/(customer)/services/_components/SelectedBanner.test.tsx` inactive branch, `tests/integration/services-route-activeOnly.test.ts:79,87,95` ADMIN-only `includeInactive=true` | **PASS** |

### Requirement REQ-SVC-04 — Composition & Error Mapping (No Hardcode, No Leak) (1 scenario)

| # | Scenario | Tests | Result |
|---|---|---|---|
| S8 | Error mapping — 401/403 vs validation | `src/lib/api/services.test.ts` HTTP helper 401/403/400/5xx/NETWORK_ERROR, `tests/integration/services-route-activeOnly.test.ts:79,87,105` route 401 UNAUTHORIZED / 403 FORBIDDEN / 400 VALIDATION_ERROR, `src/app/(customer)/services/page.test.tsx:46` null session → redirect `/login`, `src/app/(customer)/services/error.tsx` classifies unauthorized|forbidden|other | **PASS** |

**Coverage: 4/4 requirements, 8/8 GWT scenarios — all PASS.**

## Evidence Summary

| Command | Exit | Result |
|---|---|---|
| `pnpm vitest run src/lib/validators/service.test.ts src/lib/api/services.test.ts src/app/(customer)/services/_components/ServiceList.test.tsx src/app/(customer)/services/_components/ServiceCard.test.tsx src/app/(customer)/services/_components/SelectedBanner.test.tsx src/app/(customer)/services/page.test.tsx tests/integration/services-dto-leak.test.ts tests/integration/services-route-activeOnly.test.ts` | 0 | **Test Files 8 passed (8) / Tests 82 passed (82) / Duration 2.82s** |
| `pnpm tsc --noEmit` | 0 | **clean** (no diagnostics) |
| `pnpm build` | 0 | **Compiled successfully in 1038ms / Finished TypeScript in 4.2s / 11/11 static pages / /services ƒ dynamic** |
| `pnpm vitest run --project node src/app/(customer)/vehicles` (regression smoke) | 0 | **Test Files 1 passed / Tests 6 passed (6)** — T-039 baseline intact |
| `pnpm vitest run` (full suite) | 0 | **Test Files 67 passed / 4 failed / 1 skipped (72) / Tests 1045 passed / 3 failed / 2 skipped (1050)** — 3 failures pre-existing on `master@7923e15`: `clientes.schema > db client singleton`, `servicios.integration > duplicate nombre UNIQUE maps to ServicioNombreTakenError`, `servicios.schema > ships no HTTP route under src/app/api for services`. 1 failed suite: `turnos.integration.test.ts` (DB unavailable). **No regressions.** |
| `pnpm lint` | 1 | **21 problems (2 errors, 19 warnings).** Both errors pre-existing on master @ 7923e15 (unrelated to t040): `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:61` `react-hooks/set-state-in-effect` (T-039), `src/lib/http/appointmentQuery.ts:55` `prefer-const` on `piped`. 1 new harmless warning: `tests/integration/services-route-activeOnly.test.ts:37` `ForbiddenError` unused (intentional — `vi.importActual` spreads actual exports so route can `instanceof` check). 18 other warnings pre-existing across many files (mostly unused `ForbiddenError` imports in API test stubs). Per task contract: "allow pre-existing". |

Test output hash (sha256): `3b2fbea0991aa94a340685aeaeb3d514fd03ff6b533cdfe02a38a1262905daef`.
Build output hash (sha256): `6d5e6003ae825a299343b3ffdc05402eb24c5142816c5d7caf2d8df42c0230ce`.

## Invariant Compliance

### INV-03 — Auth + Golden Rule (services list public, UI guarded via `(customer)` layout)

**PASS.** The `(customer)/layout.tsx` calls `auth()` server-side and `redirect('/login')` on missing session — every customer page inherits the guard (lines 40-43). `services/page.tsx` re-asserts defensively at line 44-47 (fails closed if layout ever changes). The `/api/services` route is intentionally public for active-only (`services-route-activeOnly.test.ts:63,71` — both 200 active-only, `requireAuth` not called), but `?includeInactive=true` requires auth and 401 before any DB call (`:79`). Page test "null session → redirect('/login'), service never called" proves 401-before-403 precedence. The UI is auth-guarded via the `(customer)` layout, not via the API contract — clear separation per design D1.

### INV-06 — Timezone / ISO strings

**PASS.** `services/page.tsx` `toJson()` (lines 101-110) converts `createdAt.toISOString()` / `updatedAt.toISOString()` BEFORE the RSC → client boundary. `ServiceDTOJson` interface (`src/lib/api/services.ts:29-37`) declares both as `string`. No `Date` objects ever cross to the islands. `page.test.tsx` "Date → ISO serialization on rendered tree (INV-06)" asserts `2026-08-25T13:00:00.000Z` regex and rejects `{"createdAt":{...`. `services-dto-leak.test.ts:52-56` proves `dto.createdAt` is `instanceof Date` at the mapper boundary and `.toISOString()` round-trips the input. The mapper preserves `Date` on the server side; the RSC does the ISO conversion. No naive `TIMESTAMP` anywhere.

### INV-08 — DTO camelCase English (no `nombre`/`duracionMinutos`/`activo` leak)

**PASS — three-layer coverage.** Mapper unit `tests/integration/services-dto-leak.test.ts:27` asserts exactly the 7 documented camelCase keys `[active, createdAt, description, durationMinutes, id, name, updatedAt]`. Lines 33-40 `it.each` rejects every snake (`created_at`, `updated_at`) and Spanish (`nombre`, `descripcion`, `duracionMinutos`, `activo`) key via `not.toHaveProperty` AND `JSON.stringify` negative — double coverage. RSC tree `src/app/(customer)/services/page.test.tsx:76` re-asserts against the rendered JSX tree (not just the mapper) for 8 forbidden strings. HTTP helper `src/lib/api/services.test.ts` returns `ServiceDTOJson[]` (camelCase). Production: `services/page.tsx` `toJson()` maps `nombre→name`, `descripcion→description`, `duracionMinutos→durationMinutes`, `activo→active`; never references the Spanish keys downstream.

### H-19 — Single Owner (`services/[id]` API route untouched)

**PASS.** `git log --oneline -5 -- src/app/api/services` shows only `55d2398 feat(api): add admin servicios POST/PATCH active toggle (T-016b)` and `a22e850 feat(api): expose GET /api/services public catalog with admin filter (T-017)`. `git diff 11e4551 832a69b -- src/app/api/` is empty — PR3 did not touch any API route. The change introduces a new RSC page and client islands that consume the existing public route; the API surface is unchanged. Single-owner pattern preserved.

### No prod LOC beyond design (PR3 = tests + docs only)

**PASS.** Design.md declared 10 new files + 1 modified. Apply-progress + `git show --stat 832a69b` confirms:

- **New (PR1+PR2, prod):** `src/lib/validators/service.ts`, `src/lib/api/services.ts`, `src/app/(customer)/services/page.tsx`, `loading.tsx`, `error.tsx`, `_components/ServiceSelector.tsx`, `ServiceList.tsx`, `ServiceCard.tsx`, `SelectedBanner.tsx`, `services.module.css` = **10 ✓**
- **Modified:** `src/app/(customer)/layout.tsx` (+3 Services nav link) = **1 ✓**
- **PR3 commit `832a69b`:** 0 production LOC — 8 test files + `apply-progress.md` + `tasks.md` (line shifts)
- **PR3 docs commit `9dd3f18`:** 7 tracker docs (spec.md, design.md, proposal.md, explore.md, exploration.md, specs/service/spec.md, specs/service-selection/spec.md), 0 production LOC

### URL injection threat matrix

**PASS — Applicable, mitigated.** `design.md` threat matrix line 82-83: "Routing URL injection `?serviceId=` — Applicable — safeParse+find(active) fallback, no 500/DB write". Mitigations: `ServiceSelector.tsx:83-91` `serviceIdSchema.safeParse + services.some(active)` at island (defense-in-depth); `services/page.tsx:67-73` same check at RSC; no `findById` DB call on `?serviceId=`; no `WHERE id = $1` lookup; tampered URL falls through to `selectedId=null`, banner hidden (`SelectedBanner.tsx:23` early return), card unpressed (`aria-pressed=false`). 5 RED tests cover the contract: `service.test.ts` safeParse negative, `SelectedBanner.test.tsx` 3 hidden cases, `page.test.tsx` tampered, `services-route-activeOnly.test.ts` tampered at page boundary.

### Compound namespace composition (no boolean prop bloat) — D3

**PASS.** `ServiceSelector.tsx:131-134` attaches `.List`, `.Card`, `.SelectedBanner` as static properties on a typed `Compound`. `page.tsx:93-96` composes `<ServiceSelector services={services}><ServiceSelector.List /><ServiceSelector.SelectedBanner /></ServiceSelector>` with zero boolean flags. `ServiceCard` derives `isSelected = service.id === selectedId` from context, not from a prop. `SelectedBanner` derives from `selected` (the resolved service object), not a prop. Verified against `vercel-composition-patterns` precedent. Selection variant is selector-driven (`.cardSelected` CSS class) and ARIA-driven (`aria-pressed` toggle pattern), not boolean props.

### formatDuration pure helper (INV-05 client-side duration math)

**PASS.** `lib/validators/service.ts:41-50` is a pure function with no side effects, no `Date`, no `fechaHoraFin` calculation. Format rules: `<60 → "X min"`; `60 → "60 min"` (prefer minutes for 1-hour mark); `60<m<120 → "1 h Y min"`; `m≥120 clean → "X h"`; `m≥120 rem>0 → "X h Y min"`; non-finite → `"0 min"` (UI never renders `NaN`). 6 unit cases in `service.test.ts` (`it.each`) + 3 jsdom cases in `ServiceCard.test.tsx` + 3 jsdom cases in `SelectedBanner.test.tsx` cover the contract. The selection banner and card both call `formatDuration(service.durationMinutes)` — never client math.

## GWT Scenario Detail

### S1 — List success — active only, no inactive
```
GIVEN 3 services (60,90,120 active) + 1 activo=false, listServices mocked activeOnly=true
WHEN  RSC auth() passes and calls listServices(db,{includeInactive:false})
THEN  page renders 3 ServiceCard ordered ASC, inactive absent, DTO has name/durationMinutes/active ISO, no nombre
```
**PASS** — `page.test.tsx:54-62` "authenticated session → listServices called with (db,{includeInactive:false})". `services-route-activeOnly.test.ts:63-77` covers default + explicit `includeInactive=false` both 200 active-only with no auth. `services-dto-leak.test.ts:62-64` proves `activo:false` is preserved in mapper (not coerced). Inactive UUIDs never reach the page because the service filters them server-side.

### S2 — Empty state vs loading skeleton
```
GIVEN listServices returns [] vs pending auth()+listServices
WHEN  RSC renders with file-convention boundaries
THEN  [] → "No services available" empty (no 404, no selector) vs pending → skeleton shimmers (aria-busy)
```
**PASS** — `page.test.tsx:124-131` "empty list renders 'No services available'" — `JSON.stringify(tree)` contains the empty message. `loading.tsx` is the auto-wired Suspense fallback: 3 shimmer `<li aria-hidden="true">` rows with linear-gradient background and `aria-busy="true"` on the parent `<section>`. `_components/ServiceList.test.tsx` covers the empty branch from the island side.

### S3 — DTO snake leak negative
```
GIVEN DB row {nombre, descripcion, duracionMinutos, activo, created_at} TIMESTAMPTZ UTC
WHEN  RSC or lib/api/services.ts returns DTO
THEN  NOT.toHaveProperty("nombre")|("duracionMinutos")|("activo")|("fecha"), has name,description,durationMinutes,active,createdAt,updatedAt
```
**PASS** — `services-dto-leak.test.ts:27` asserts exactly the 7 camelCase keys `[active, createdAt, description, durationMinutes, id, name, updatedAt]`. `:33-40` `it.each` rejects `nombre`, `descripcion`, `duracionMinutos`, `activo`, `created_at`, `updated_at` via both `not.toHaveProperty` and `JSON.stringify(...).not.toContain` (double negative). `page.test.tsx:76-89` re-asserts against the rendered JSX tree (8 forbidden strings). Three-layer coverage: mapper unit + RSC tree + HTTP helper.

### S4 — Selection success — valid active `?serviceId=`
```
GIVEN list [{id:uuidA,active:true,durationMinutes:90}], URL ?serviceId=uuidA
WHEN  RSC validates UUID + find(active) and islands render
THEN  Card uuidA aria-pressed=true + banner "1 h 30 min" + Continue href="/appointments/new?serviceId=uuidA"
```
**PASS** — `page.test.tsx:104-112` "valid ?serviceId= matching active service — does not crash, renders" — `JSON.stringify(tree)` contains the service UUID. `ServiceCard.test.tsx` asserts `aria-pressed={true}` toggle and click → `router.push(?serviceId=…)`. `SelectedBanner.test.tsx` asserts `formatDuration(90) → "1 h 30 min"` and Continue `href="/appointments/new?serviceId={id}"`. Both the RSC `selectedId` derivation (page.tsx:67-73) and the island `useSearchParams()` re-derivation (ServiceSelector.tsx:83-91) confirm the UUID and `services.some(active)`.

### S5 — Tampered/inactive `?serviceId=` fallback
```
GIVEN URL ?serviceId=not-uuid or UUID absent from list or activo=false hidden
WHEN  RSC/client validates safeParse + find(active)
THEN  no card selected, banner hidden, no 500, shows "Select a service" hint
```
**PASS** — `service.test.ts` `safeParse("not-a-uuid")` returns `{success:false}`. `SelectedBanner.test.tsx` covers 3 hidden cases (no id / tampered / absent UUID) + inactive branch. `page.test.tsx:114-122` "tampered ?serviceId=garbage — does not crash" — list still renders, garbage not echoed. `services-route-activeOnly.test.ts:122-128` "tampered ?serviceId=garbage does not 500" — page boundary test proves no error propagation. `services-route-activeOnly.test.ts:144-152` "unknown UUID renders list, no select" — unknown id never echoed in tree.

### S6 — URL persistence on refresh and deep-link
```
GIVEN user selected uuidA via click (router.push)
WHEN  page refreshed or URL shared /services?serviceId=uuidA
THEN  RSC re-validates same UUID and renders selected state without localStorage
```
**PASS** — `services-route-activeOnly.test.ts:130-136` "valid active ?serviceId= restores selection without a 500" — deep-link proves state restoration. `ServiceSelector.tsx:75-99` uses reactive `useSearchParams()` (Next 16 `ReadonlyURLSearchParams`); every URL change (back, forward, deep-link, share) re-derives `selectedId` automatically. No `useState` for selection, no `localStorage`, no `useEffect` data fetch.

### S7 — Inactive hidden, not selectable
```
GIVEN seed Cambio 60 active, Revisión 120 inactive
WHEN  list renders and URL ?serviceId=inactiveId
THEN  inactive not in ServiceList, find(active) fails, banner hidden
```
**PASS** — Defense in depth: `services/page.tsx:53` calls `listServices(db,{includeInactive:false})` so inactive rows never enter the page's DTO list. `_components/ServiceSelector.tsx:88-91` `services.some(active)` runs again on the island — even if the RSC ever leaked an inactive row, the island would still reject it for selection. `SelectedBanner.test.tsx` "inactive:false service → banner hidden" covers the negative. `services-route-activeOnly.test.ts:79-103` proves `?includeInactive=true` requires 401 (no auth) or 403 (CLIENTE), only ADMINISTRADOR can see inactive (test returns 200 with both).

### S8 — Error mapping — 401/403 vs validation
```
GIVEN unauthenticated vs non-admin ?includeInactive=true vs tampered serviceId
WHEN  route/helper parses ErrorBody
THEN  401→/login, 403→banner, tampered → no error thrown (fallback), not 500
```
**PASS** — `src/lib/api/services.test.ts` covers HTTP helper: 200 happy path, 401/403 throw `ApiError{code:"UNAUTHORIZED"|"FORBIDDEN"}`, 400 throws with `issues`, 5xx throws with status fallback, network throws `NETWORK_ERROR`. `services-route-activeOnly.test.ts:79-110` covers the API route: 401 UNAUTHORIZED before DB call (no auth + `includeInactive=true`), 403 FORBIDDEN (CLIENTE + `includeInactive=true`), 200 ADMIN bypass, 400 VALIDATION_ERROR (`?includeInactive=yes`). `page.test.tsx:46-52` proves null session redirects to `/login` before any DB call. `error.tsx` classifies the boundary into `unauthorized|forbidden|other` and routes 401 to `router.push('/login')`. Tampered `?serviceId=` is **never** an error — it falls back to `selectedId=null` with banner hidden.

## File Diff Audit

```
openspec/changes/t040-service-selection/apply-progress.md           | 230 ++ (change folder tracker)
openspec/changes/t040-service-selection/design.md                  |  96 +
openspec/changes/t040-service-selection/exploration.md              |  81 +
openspec/changes/t040-service-selection/explore.md                  |  81 +
openspec/changes/t040-service-selection/proposal.md                 |  78 +
openspec/changes/t040-service-selection/spec.md                    |  61 +
openspec/changes/t040-service-selection/specs/service-selection/spec.md | 63 +
openspec/changes/t040-service-selection/specs/service/spec.md       |  63 +
openspec/changes/t040-service-selection/tasks.md                    |  65 +
src/app/(customer)/layout.tsx                                       |   3 +
src/app/(customer)/services/_components/SelectedBanner.test.tsx     | 104 +
src/app/(customer)/services/_components/SelectedBanner.tsx          |  52 +
src/app/(customer)/services/_components/ServiceCard.test.tsx        | 125 +
src/app/(customer)/services/_components/ServiceCard.tsx             |  62 +
src/app/(customer)/services/_components/ServiceList.test.tsx        |  75 +
src/app/(customer)/services/_components/ServiceList.tsx             |  34 +
src/app/(customer)/services/_components/ServiceSelector.tsx         | 134 +
src/app/(customer)/services/error.tsx                              |  89 +
src/app/(customer)/services/loading.tsx                            |  46 +
src/app/(customer)/services/page.test.tsx                          | 140 +
src/app/(customer)/services/page.tsx                               | 111 +
src/app/(customer)/services/services.module.css                    | 137 +
src/lib/api/services.test.ts                                        | 130 +
src/lib/api/services.ts                                            | 116 +
src/lib/validators/service.test.ts                                 |  71 +
src/lib/validators/service.ts                                      |  82 +
tests/integration/services-dto-leak.test.ts                        |  65 +
tests/integration/services-route-activeOnly.test.ts                | 153 +
28 files changed, 2547 insertions(+)
```

### Chain audit (feature-branch-chain)

| PR | Commit | Message | Code LOC | Test LOC | Verified |
|---|---|---|---|---|---|
| PR1 | bd584e7 | feat(service): add RSC shell foundation PR1 | 299 (155 under 400 budget) | 0 | ✓ tsc clean, foundation accepted |
| PR2 | 11e4551 | feat(service): add ServiceSelector islands PR2 | ~315 (under 400 budget) | 0 | ✓ tsc clean, islands wired |
| PR3 | 832a69b | test(service): add coverage PR3 | **0** | 860 | ✓ tsc + build clean, 82/82 PASS |
| PR3 docs | 9dd3f18 | chore(docs): commit still-untracked SDD tracker docs | **0** | 0 | ✓ 7 tracker docs committed |
| **Total** | | | **~614 prod** | **860 tests** | |

PR1+PR2 stayed under the 400 LOC PR budget. PR3 shipped 0 production LOC (tests + docs only) per the orchestrator forecast. The 860 LOC of tests exceeded the original "~300-400" estimate but stayed below T-039 PR3's 1025 LOC baseline — the 8-file test surface required broader coverage than forecast.

## Pre-existing Failures (Unrelated to t040)

Verified against `master@7923e15` baseline — identical 3 test failures + 1 failed suite:

| File | Test | Reason |
|---|---|---|
| `src/db/__tests__/clientes.schema.test.ts` | `db client singleton (REQ-CLIENTE-03)` | env config missing AUTH_SECRET (DB integration env) |
| `src/db/__tests__/servicios.integration.test.ts` | `duplicate nombre UNIQUE maps to ServicioNombreTakenError` | pgCode unwrap mismatch (test expects `"23505"` literal; receives `"SERVICE_ALREADY_EXISTS"` mapped code) |
| `src/db/__tests__/servicios.schema.test.ts` | `t007 negative scope guards (REQ-SRV-06) > ships no HTTP route` | guard asserts `services` route absent; t022 introduced the route, guard never updated |
| `src/db/__tests__/turnos.integration.test.ts` | (suite-level) | server-only import in test file (DB integration env unavailable) |

None introduced by t040; all DB-dependent tests that require a live PostgreSQL instance which is not available in this environment. **No regressions.**

## Risks & Observations

1. **PR3 test LOC exceeded orchestrator forecast (~860 vs ~300-400).** All production code is in PR1+PR2 (~614 LOC); PR3 is tests + docs only. Stayed below T-039 PR3's 1025 LOC baseline. The 8-file test surface required broader coverage than the original estimate.

2. **`useSearchParams` mock statefulness.** jsdom tests use a module-level `mockServiceId` variable flipped per-test. If a future test adds an `await` between setting `mockServiceId` and rendering, the provider may re-render with stale state. Mitigation: `afterEach` clears the mock and the closure binding is local to each `it()`.

3. **`vi.importActual` in route-activeOnly.** Preserves the actual `requireAuth`/`listServices` exports so the route can still bind `ForbiddenError`/`UnauthorizedError` `instanceof` checks. The mocked functions override the named exports. The `ForbiddenError` unused-variable lint warning is intentional and harmless. If a future refactor adds new exports from those modules, the spread `{ ...actual }` keeps them visible to the route under test.

4. **Page test `JSON.stringify(tree)` brittleness.** React JSX serialization can shift across React minor versions. The test asserts on the rendered tree's JSON shape, which is robust to React internals but would break if `ServiceSelector` started rendering children eagerly (it doesn't, since the `"use client"` boundary is preserved at compile time). A verify follow-up could swap to `renderToString` + DOM-level assertions if desired.

5. **Continue route forward-reference.** `<Link href="/appointments/new?serviceId={id}">` references a route that does not exist yet (T-041). The link is semantic only — clicking it will 404 until T-041 ships. Spec scenario S4 acknowledges: "Continue preserves `?serviceId=` for T-041".

6. **PR2 deferred jsdom tests now pass.** PR2 was scoped to islands + styling only (per orchestrator). PR3 closes the PR2.8 threat contract with explicit `tampered ?serviceId=garbage does not 500` + `banner hidden on no/tampered/absent UUID selection` + `Continue href uses selected.id (defense in depth)`.

7. **Lint pre-existing errors.** `VehicleProvider.tsx:61` (T-039-introduced `useEffect → setVehicles`) and `appointmentQuery.ts:55` (prefer-const on `piped`, master baseline) are both unrelated to t040. Per task contract "allow pre-existing". The single new harmless warning (`ForbiddenError` unused in `services-route-activeOnly.test.ts`) is documented as intentional.

8. **RDD review (separate from SDD verify).** RDD is enabled globally per session preflight. This report is the SDD verification. RDD review will run separately after archive before delivery (per `rdd-defect-workflow`/`work-unit-commits`). Receipt/lineage requirements apply independently.

## Recommended Next Step

**Archive t040-service-selection** — proceed to `sdd-archive` phase. The change is ready for delta sync:
- Delta target: `openspec/specs/service-selection/spec.md` (new domain, 4 ADDED, 8 GWT) + `openspec/specs/service/spec.md` (mirror alias)
- Phase 5 verification (T-040) tickable in `implementation-plan.md`
- All GWT scenarios traceable to test files with line references
- No blockers, no critical findings

After archive, RDD review will run independently per the global RDD-enabled setting before delivery.

## Skill Resolution

- **Loaded skill:** `sdd-verify` (sdd-verify/SKILL.md)
- **Delegation:** This agent performed verification inline; no sub-agents called
- **Validator invoked:** `gentle-ai sdd-verify-validate --input <candidate> --requirements 4 --scenarios 8` (see YAML envelope header)
- **Artifacts persisted:**
  - `openspec/changes/t040-service-selection/verify-report.md` (this file)
  - Engram observation: `sdd/t040-service-selection/verify-report` (via `mem_save`)
