# Tasks: t040-service-selection — Service Selection UI

> Mirrors T-039 split. RDD receipt required per PR: commit body MUST
> include `rdd-receipt: <evidence>` referencing a spec scenario.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900 (10 new + 1 modified + 6 tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 foundation → PR2 islands → PR3 tests |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | RSC shell + helpers + nav | PR 1 | `pnpm vitest run lib/validators/service.test.ts lib/api/services.test.ts` | `pnpm dev` → `/services` | delete page + revert nav |
| 2 | Compound islands + CSS | PR 2 | `pnpm vitest run services/_components/*.test.tsx` | click card → URL `?serviceId=` | delete `_components` + CSS; empty list works |
| 3 | RSC + DTO leak + finalize | PR 3 | `pnpm vitest run` (full) | manual `/services` + deep-link | revert PR diff |

## Phase 1: Foundation (PR 1)

- [x] 1.1 Create `src/lib/validators/service.ts` — `serviceIdSchema=z.string().uuid()`, pure `formatDuration(m)`, re-export `ApiError`/`ApiErrorBody`.
- [x] 1.2 Create `src/lib/api/services.ts` — `ServiceDTOJson` type, thin `listServices({includeInactive}?)` (`cache:"no-store"`, `isErrorBody`).
- [x] 1.3 Create `src/app/(customer)/services/page.tsx` — RSC `force-dynamic`, `auth()`, `listServices(db,{includeInactive:false})`, `toJson` `Date→ISO`, `searchParams.serviceId` `safeParse+find(active)`, passes to `<ServiceSelector>`.
- [x] 1.4 Create `src/app/(customer)/services/loading.tsx` — Suspense skeleton (3 shimmer rows, `aria-busy`).
- [x] 1.5 Create `src/app/(customer)/services/error.tsx` — client boundary; 401→`router.push('/login')`, 403→banner, other→retry.
- [x] 1.6 Modify `src/app/(customer)/layout.tsx` — add `<Link href="/services">Services</Link>` to nav.
- [x] 1.7 RED `src/lib/validators/service.test.ts` — `formatDuration(45/60/75/90/120/180)`; `serviceIdSchema.safeParse` valid/invalid.
- [x] 1.8 RED `src/lib/api/services.test.ts` — mock fetch `200` ISO; `401/403/400`→`ApiError`.

## Phase 2: Islands (PR 2)

- [x] 2.1 Create `_components/ServiceSelector.tsx` — `"use client"` compound (`.List`/`.Card`/`.SelectedBanner`), `useSearchParams`+`router.push(?serviceId=${id},{scroll:false})`.
- [x] 2.2 Create `_components/ServiceList.tsx` — iterate `key={s.id}`; `EmptyState` "No services available" when `[]`.
- [x] 2.3 Create `_components/ServiceCard.tsx` — presentational `name`, truncated `description`, `formatDuration`, `aria-pressed` from selected id.
- [x] 2.4 Create `_components/SelectedBanner.tsx` — only when `find(active)`; `name`+`formatDuration`+Continue `<Link href="/appointments/new?serviceId={id}">`.
- [x] 2.5 Create `services.module.css` — `.list .card .cardSelected .empty .banner .meta` reusing `--color-*`/`--space-*`/`--radius-*`.
- [x] 2.6 Modify `services/page.tsx` — replace minimal `<ul>` placeholder with `<ServiceSelector services={services}>` compound wiring.
- [x] 2.7 `useSearchParams` handling — `searchParams.get("serviceId")` validated UUID + active fallback; no 500, no crash.
- [x] 2.8 Threat RED — tampered `?serviceId=garbage` shows no selection, banner hidden, no card pressed (jsdom tests in PR3 lock the contract).

> Phase 2 jsdom RED tests (ServiceList/Card/Banner.test.tsx) intentionally
> deferred to PR3 — orchestrator scoped PR2 to islands+styling only, under
> the 400 LOC PR budget. The defense-in-depth `safeParse + find(active)` is
> the contract under test; it lives in `ServiceSelectorImpl` so the three
> RED tests land next to one source of truth.

## Phase 3: Integration + Verify (PR 3)

- [x] 3.1 RED `services/page.test.tsx` — mock `auth()`+`listServices`; ASC active-only, `selectedId` from `searchParams.serviceId`.
- [x] 3.2 RED `tests/integration/services-dto-leak.test.ts` — `not.toHaveProperty("nombre"|"duracionMinutos"|"activo"|"fecha")`, has `name/durationMinutes/active` ISO (INV-08).
- [x] 3.3 RED `tests/integration/services-route-activeOnly.test.ts` — `includeInactive:false` only; tampered `?serviceId=garbage` no select; deep-link restores state.
- [x] 3.4 Regression smoke `pnpm vitest run src/app/(customer)/vehicles`.
- [x] 3.5 Verify `pnpm tsc --noEmit`+`pnpm vitest run`+`pnpm build`+manual `/services`+`?serviceId=` deep-link.
- [x] 3.6 NOTE: `/appointments/new` alias deferred to T-041.