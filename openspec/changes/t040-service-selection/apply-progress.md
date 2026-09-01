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

## Next Recommended (PR 2)

Implement the `ServiceSelector` compound islands:
- `_components/ServiceSelector.tsx` (`"use client"`) — `ServiceSelector.List` / `.Card` / `.SelectedBanner` compound.
- `_components/ServiceList.tsx` — iterates `ServiceDTOJson[]`, empty vs list variants.
- `_components/ServiceCard.tsx` — presentational `name` + `formatDuration(durationMinutes)` + truncated `description`, `aria-pressed` from selected id.
- `_components/SelectedBanner.tsx` — only when `find(active)` hit; `Continue` `<Link href="/appointments/new?serviceId={id}">`.
- `services.module.css` — `.list`, `.card`, `.cardSelected`, `.empty`, `.banner`, `.meta` reusing `--color-*` / `--space-*` / `--radius-*` tokens.
- 2.6/2.7/2.8 jsdom tests (per tasks.md Phase 2).

PR2 budget estimate: ~300 LOC.
