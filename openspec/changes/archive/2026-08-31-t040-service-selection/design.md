# Design: t040-service-selection — Service Selection UI

## Technical Approach

RSC `services/page.tsx` calls `listServices(db,{includeInactive:false})` direct (no hop, D1). `(customer)/layout` guards `auth()→/login`; page only derives `selectedId` from `searchParams.serviceId`. `ServicioDTO→ServiceDTOJson` (`Date→ISO`) to islands. Selection URL-canonical `?serviceId=` (`useSearchParams`+`router.push`), `z.uuid`+`find(active)` fallback. Compound `ServiceSelector` (List/Card/Banner) + `formatDuration`. Mirrors T-039; feeds T-041→T-042 via `serviceId+durationMinutes` (INV-05).

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| D1 Fetch | A: RSC direct / B: client fetch | B waterfall+RTT lost SSR; A fastest FCP | **A** direct `force-dynamic` |
| D2 Store | A: URL `?serviceId=` / B: state/Context / C: localStorage | B/C lost refresh, breaks T-041 | **A** URL canonical |
| D3 Composition | A: compound List/Card/Banner / B: boolean props | B prop bloat | **A** compound |
| D4 Styling | A: `services.module.css` tokens / B: shared card | B premature | **A** minimal module |
| D5 Helpers | A: thin helper+validator / B: inline | B no reuse for T-042 | **A** both files |

## Data Flow

```
[layout (customer)] auth() ──→ redirect /login if no session
        │
[(customer)/services/page.tsx RSC] ── listServices(db,{includeInactive:false})
        │  ├─ toJson: Date→ISO ─→ ServiceDTOJson[] (activeOnly, ASC)
        │  └─ searchParams.serviceId ── safeParse(uuid) ── find(active) ─→ selectedId|null
        │
        ├─ loading.tsx Suspense skeleton (aria-busy)  error.tsx boundary
        │
        └─► ServiceSelector islands ("use client")
             ├─ ServiceList {services} → ServiceCard × N (aria-pressed, .cardSelected)
             │        └─ onClick → router.push("?serviceId="+id)
             └─ SelectedBanner {selected} → formatDuration → Continue /appointments/new?serviceId=
                                └─ derives durationMinutes via find (no N+1, no client fechaHoraFin)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(customer)/services/page.tsx` | Create | RSC `force-dynamic`, direct `listServices`, `toJson` ISO, `searchParams` UUID |
| `src/app/(customer)/services/_components/ServiceSelector.tsx` | Create | Compound List/Card/Banner, `useSearchParams`+`router.push`, `aria-pressed` |
| `src/app/(customer)/services/_components/ServiceList.tsx` | Create | `key={id}` iterate, empty vs list |
| `src/app/(customer)/services/_components/ServiceCard.tsx` | Create | `name` + `formatDuration` + truncated desc |
| `src/app/(customer)/services/_components/SelectedBanner.tsx` | Create | Only if `find(active)` hit, Continue preserves `?serviceId=` |
| `src/app/(customer)/services/services.module.css` | Create | `.list .card .cardSelected .empty .banner` tokens |
| `src/app/(customer)/services/loading.tsx` | Create | 3 shimmer `aria-busy` |
| `src/app/(customer)/services/error.tsx` | Create | `unauthorized/forbidden/other` boundary |
| `src/lib/api/services.ts` | Create | `listServices` helper `cache:no-store`, `ApiError` |
| `src/lib/validators/service.ts` | Create | `z.uuid` + `formatDuration` pure |
| `src/app/(customer)/layout.tsx` | Modify | Nav `Services` link |
| `vitest.config.ts` | Verify | `jsdom` glob already covers `_components` |

## Interfaces / Contracts

```ts
export interface ServiceDTOJson { id:string; name:string; description:string|null; durationMinutes:number; active:boolean; createdAt:string; updatedAt:string }
export async function listServices(opts?:{includeInactive?:boolean}):Promise<ServiceDTOJson[]>
export class ApiError extends Error { code:string; status:number; issues?:unknown[] }
export const serviceIdSchema: z.ZodString // z.string().uuid()
export function formatDuration(m:number):string // 60→"60 min" 90→"1h 30m" 120→"2h"
type ServicesPageProps = { searchParams?:{serviceId?:string} }
```

No `Date` to client; `nombre→name` via `toServicioDTO`; `selectedId=safeParse+find(active)??null`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `formatDuration` 60/90/120/45, `serviceIdSchema` UUID | `vitest` node |
| Unit | `isErrorBody`/`statusToFallbackCode` | node mocked fetch |
| Component jsdom | List active-only ASC, hide inactive; empty vs skeleton `aria-busy` | RTL |
| Component jsdom | Card `aria-pressed`+`.cardSelected`, click→`router.push(?serviceId=)` | RTL mock nav |
| Component jsdom | Banner `formatDuration`+Continue href; tampered→hidden no throw | RTL |
| Integration | DTO leak `not.toHaveProperty(nombre/duracionMinutos)` has `name/durationMinutes` ISO | node mock listServices |
| Integration | RSC `includeInactive:false` only; public no-auth path | route test |

## Threat Matrix

No `references/threat-matrix.md` in repo; assessed generically:

| Area | Applicable | RED Test |
|------|------------|----------|
| Routing URL injection `?serviceId=` | **Applicable** — `safeParse`+`find(active)` fallback, no 500/DB write | jsdom tampered → no selection |
| Shell/subprocess | N/A — no exec | — |
| VCS/PR automation | N/A | — |
| Executable-file | N/A | — |
| Process integration | N/A | — |

## Migration / Rollout

No migration. 3-PR chain <400/PR: PR1 shell+skeleton, PR2 islands+CSS, PR3 helpers+tests. Rollback `git revert`.

## Open Questions

- [ ] `/services` canonical vs `/appointments/new` alias — needs stub for T-041?
- [ ] Continue target lock: `/appointments/new?serviceId=` vs availability route?
