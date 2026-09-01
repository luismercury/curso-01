# Proposal: t040-service-selection — Service Selection UI (FASE 8 UI-02 T-040)

## Intent

Expose T-017 `GET /api/services` as catalog where client picks active service; selection via `?serviceId=` feeds T-041→T-043 (`serviceId+durationMinutes`, INV-05).

## Scope

### In Scope
- RSC `services/page.tsx` — `auth()` guard, `listServices(db,{includeInactive:false})` direct, `Date→ISO`, `searchParams.serviceId` UUID
- Islands `ServiceSelector` compound (`List/Card/Banner`) — `useSearchParams` + `router.push(?serviceId=)`, `aria-pressed`, `formatDuration`
- `lib/api/services.ts` + `lib/validators/service.ts` (UUID, `formatDuration`, `ApiError`)
- `loading.tsx` skeleton + `error.tsx` (401→/login, 403)
- `services.module.css` reusing tokens, no Tailwind
- Tests `jsdom` + DTO leak checks

### Out of Scope
- Tailwind full, Server Actions, `GET /api/me`
- Availability logic (T-042), `/appointments/new` alias (redirect doc)

## Capabilities

### New Capabilities
- `service-selection`: browse active services, URL selection, CTA continue with `serviceId` — `specs/service-selection/spec.md`

### Modified Capabilities
- None

## Approach

**A chosen: RSC direct + URL islands.** SSR `listServices` (no hop, D1), URL canonical (deep-link/refresh); T-041 reads `searchParams` server-side. `durationMinutes` via `find(id)`.

**B rejected:** client `useEffect` + `localStorage` — waterfall, RTT, lost on refresh, breaks chain.
**C rejected:** Server Actions — POST for read-only, bypasses DT-03.

**Composition:** compound `List/Card/Banner`, no boolean bloat. **Data:** `server-serialization`, `server-parallel-fetching`, `async-suspense`, `no-shared-state`.

**Delivery:** 3-PR chain <400/PR — PR1 ~350, PR2 ~300, PR3 ~400 (T-039 mirror).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `(customer)/services/page.tsx` | New | RSC shell, `searchParams` UUID |
| `_components/ServiceSelector.tsx` | New | Compound islands, URL push |
| `services.module.css` | New | Token reuse |
| `loading.tsx, error.tsx` | New | Suspense + boundary |
| `lib/api/services.ts` | New | Thin helper |
| `lib/validators/service.ts` | New | UUID + formatDuration |
| `(customer)/layout.tsx` | Modified | Nav link |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `activo=false` leak | Med | `includeInactive:false` only; `INVALID_SERVICE` banner |
| Tampered `?serviceId=` | Med | `z.uuid().safeParse` + `find(active)` fallback |
| DTO leak `nombre` | Low | `toServicioDTO` only; test `not.toHaveProperty` |
| CSS drift | Low | Reuse tokens; extract `card.module.css` if >30 lines |

## Rollback Plan

No migration. Delete `services/*`, helpers, revert nav. `git revert` per PR.

## Dependencies

- T-017 DONE (public `activeOnly`, `ServicioDTO` camelCase ISO)
- T-039 DONE (RSC guard, compound, CSS modules, vitest jsdom)
- T-051 DONE; blocks T-041/T-042

## Success Criteria

- [ ] RSC lists active `ServiceDTOJson[]`, no Spanish/snake leak, ISO dates
- [ ] Select writes `?serviceId=`, selected ring + banner + Continue preserves param; deep-link works
- [ ] `[]` empty vs skeleton vs `error.tsx` 401→/login correct
- [ ] `formatDuration` display, no client `fechaHoraFin` calc
- [ ] jsdom tests: List/Card/Banner + invalid UUID + inactive filter
- [ ] Hybrid persisted Engram + file
