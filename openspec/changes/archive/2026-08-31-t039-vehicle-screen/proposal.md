# Proposal: t039-vehicle-screen — Vehicle Management Screen (FASE 8 UI-01 T-039)

## Intent

Expose T-014 vehicles API as first FASE 8 UI. RSC shell `/vehicles` + islands — unblocks T-040..049. Fixes `customerId` via server `auth()` JWT httpOnly.

## Scope

### In Scope
- RSC `(customer)/vehicles/page.tsx` — `auth()`→id→fetch, Suspense, 401→`/login`
- Islands `VehicleList` + `VehicleForm` (`use client`, `credentials:include`, `router.refresh()`)
- `lib/api/vehicles.ts` (`no-store`, error parse)
- `lib/validators/vehicle.ts` — `normalizePatente`, `plate /^[A-Z0-9]{6,7}$/`, `year 1900..now+1`, `brand/model 2..100`
- States: skeleton, empty `[]`, 401/403/409/400; nav + `globals.css` minimal, vitest jsdom, INV-03/08

### Out of Scope
- Tailwind full system
- Server Actions bypass + `GET /api/me` (deferred; no URL id)
- Pagination

## Capabilities

### New Capabilities
- `vehicle`: CRUD UI (list/create, validation, ownership, DTO) → `specs/vehicle/spec.md`

### Modified Capabilities
- None

## Approach

**A RSC+islands (chosen) vs B SPA vs C Server Actions.**

A: RSC `auth()` derives id (JWT) — no URL id, no race. Keeps DT-03 boundary (`POST/GET .../vehicles` camelCase via `toVehiculoDTO`), enables `server-parallel-fetching`/`suspense`/`serialization`. Client only mutations. Base for T-042.
B: SPA — waterfall, no SSR, dedup breach, needs endpoint.
C: Server Actions bypass T-014, couple UI→DB, break thin handler.
Confirmed 2026-08-31 id 411: `customerId = Server auth()`. Golden rule: never trust client id; if URL has id, `assertOwnership`.
Composition: `VehicleProvider` + `VehicleList/Empty/Error/Form.Create`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `(customer)/vehicles/page.tsx` | New | RSC shell, Suspense |
| `VehicleList/Form.tsx` | New | Islands, Zod, errors |
| `lib/api/vehicles.ts` | New | Fetch helper |
| `lib/validators/vehicle.ts` | New | Pure Zod |
| `(customer)/layout.tsx` + `globals.css` | Modified | Nav + styles |
| `vitest.config.ts` | Modified | jsdom+RTL |
| `auth.ts` + `vehicles/route.ts` | Read-only | INV-03, T-014 DONE |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `auth()` wiring | Med | Mock `auth()`, keep handler safe |
| Plate `ABC-123`→`ABC123` UX | High | Preview + hint, map 400 `issues` |
| `now+1` hydration | Med | `maxYear` server→prop |
| 401 vs 403 | Med | RSC redirect / client push+ banner |
| 409 UNIQUE race | Low | Field error |
| Styling drift | Low | Minimal tokens |

## Rollback Plan

No migration. Delete `vehicles/*`, helpers; revert layout/css/vitest. `git revert` one commit.

## Dependencies

- T-014 DONE, T-035/T-050 DONE
- RDD ON — planning ok, commits need receipt
- Blocks T-040/T-042

## Success Criteria

- [ ] `GET /vehicles` lists own DTOs via RSC `auth()`→fetch, Suspense+empty
- [ ] `POST` creates (`credentials:include`, Zod, 409 inline, revalidate)
- [ ] INV-03 no client id, `assertOwnership` if URL id; INV-08 camelCase/ISO
- [ ] 401→login, 403 banner, 400 `issues`
- [ ] Hybrid persisted Engram + file
