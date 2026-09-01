# Design: t039-vehicle-screen — Vehicle Management Screen

## Technical Approach

RSC shell `src/app/(customer)/vehicles/page.tsx` derives `customerId` via `auth()` (JWT `sub`) before any fetch — golden rule, no client URL id. List uses **direct service** `listVehiclesByCustomer(db, customerId)` (SSR, no HTTP hop); create uses **HTTP helper** `src/lib/api/vehicles.ts` (`credentials:include`, `no-store`) to exercise T-014 contract. `Suspense` streams list, `error.tsx` handles 403/500, `redirect('/login')` on 401. Islands `VehicleList`/`VehicleForm` as compound components; Zod mirrored client-side with `maxYear` server prop (hydration guard). DTOs via `toVehiculoDTO` (INV-08, ISO).

Implements proposal A and spec 4 ADDED.

## Architecture Decisions

### D1 — RSC list fetch

| Option | Tradeoff | Decision |
|---|---|---|
| Direct `listVehiclesByCustomer(db,id)` | -1 RTT, no fetch mock | **Chosen** |
| `fetch(/api/.../vehicles)` from RSC | Extra hop, needs header forward | Rejected |
| Server Action | Bypasses T-014 boundary | Rejected |

Contract validated by client `POST` + integration tests.

### D2 — Route

| Option | Tradeoff | Decision |
|---|---|---|
| `(customer)/vehicles/page.tsx` | Shares guard layout, future T-040/T-042 | **Chosen** |
| `vehicles/page.tsx` | Guard duplicated | Rejected |

### D3 — Client validation

| Option | Tradeoff | Decision |
|---|---|---|
| Pure Zod `src/lib/validators/vehicle.ts` | Bundle-safe, no `server-only` | **Chosen** |
| Import `db/validators` / `vehicleService` | Breaks client bundle | Rejected |

Server stays truth for 409/400.

### D4 — Composition

| Option | Tradeoff | Decision |
|---|---|---|
| Compound `VehicleProvider` + `VehicleList/Empty/ErrorBanner` + `VehicleForm.Create` | No boolean bloat | **Chosen** |
| Monolithic `VehicleCard editable` | Prop explosion | Rejected |

### D5 — Styling

| Option | Tradeoff | Decision |
|---|---|---|
| `globals.css` + `vehicles.module.css` minimal | Zero deps | **Chosen** |
| Tailwind | Heavy for one screen | Deferred |

## Data Flow

```
auth() → customerId → listVehiclesByCustomer(db,id) → VehiculoDTO[] (Date→ISO)
  └ 401→redirect('/login')  403→ErrorBanner
RSC page.tsx (no-store, Suspense skeleton)
  ├ VehicleList (props: VehicleDTOJson[] ISO)
  ├ VehicleProvider (client context)
  └ VehicleForm {customerId,maxYear} → Zod→ POST via lib/api/vehicles.ts
       201→router.refresh() | 400 issues→field | 409→plate | 401→push /login | 403→banner
```

`maxYear` server-computed.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(customer)/layout.tsx` | Create | Guard nav to /vehicles |
| `src/app/(customer)/vehicles/page.tsx` | Create | RSC shell, `auth()`→service, Suspense |
| `src/app/(customer)/vehicles/error.tsx` | Create | 403 banner / 500 fallback |
| `src/app/(customer)/vehicles/loading.tsx` | Create | Skeleton |
| `src/app/(customer)/vehicles/_components/VehicleProvider.tsx` | Create | Context `{vehicles,status}` |
| `src/app/(customer)/vehicles/_components/VehicleList.tsx` | Create | List + Empty + Card |
| `src/app/(customer)/vehicles/_components/VehicleForm.tsx` | Create | `"use client"` Zod, preview, 409, refresh |
| `src/app/(customer)/vehicles/vehicles.module.css` | Create | Tokens + skeleton |
| `src/lib/api/vehicles.ts` | Create | `fetchVehicles`/`createVehicle` |
| `src/lib/validators/vehicle.ts` | Create | Pure Zod |
| `src/app/globals.css` | Modify | Tokens |
| `vitest.config.ts` | Modify | jsdom project |
| `package.json` | Modify | `jsdom`, RTL |

## Interfaces / Contracts

```ts
type VehicleDTOJson = { id:string; customerId:string; brand:string; model:string; year:number; plate:string; createdAt:string; updatedAt:string };
type VehicleCreatePayload = { brand:string; model:string; year:number; plate:string };
export async function fetchVehicles(customerId:string): Promise<VehicleDTOJson[]>;
export async function createVehicle(customerId:string, p:VehicleCreatePayload): Promise<VehicleDTOJson>;
// fetch(url,{credentials:"include",cache:"no-store"}), throws ApiError {code,message,issues?,status}
type VehicleFormProps = { customerId:string; maxYear:number };
type ErrorBody = { error:{code:string; message:string; issues?:{path:string[],message:string}[]} };
// 401→redirect/push /login, 403→banner, 400→field, 409→plate
```

Validation: brand/model 2..100, year 1900..maxYear, plate normalized→`/^[A-Z0-9]{6,7}$/` strict.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (node) | `normalizePatente`, Zod edges, DTO leak `marca` | vitest |
| Unit (jsdom) | `VehicleForm` errors, 409 keep values, 201 refresh, `Empty`/`Skeleton` | RTL + mock `lib/api/vehicles` |
| Integration | `GET/POST /api/customers/[customerId]/vehicles` 401→403 precedence, DTO ASC | vitest + DB + `jose` jwt |
| Integration | RSC wire `auth()`→service, `maxYear` guard, `ErrorBody` parse | Mock `auth()`, `redirect` |

No E2E (T-061).

## Threat Matrix

Routing/auth Applicable; VCS/PR not.

| Boundary | Adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Docs paths | `requirements.txt`, MDX exec | N/A — no doc execution | — | — |
| Git repo selection | `git -C`, paths | N/A — no VCS | — | — |
| Commit state | staged, `commit -a` | N/A | — | — |
| Push state | tracking, refspec | N/A | — | — |
| PR commands | `--head`, env prefix | N/A | — | — |
| **Next.js routing+auth** | no JWT, non-owner, bad uuid, spoof `customerId` | **Applicable** | `auth()` before fetch; `assertOwnership` if URL id; 401→redirect/push, 403→banner; 403 before 400 | (1) no-JWT→401 (2) non-owner bad uuid→403 (3) RSC no session→redirect (4) helper 401→push (5) prop tamper ignored |

N/A rows → no tasks.

## Migration / Rollout

No migration. Rollback: delete `(customer)/vehicles`, `lib/api/vehicles.ts`, `lib/validators/vehicle.ts`; revert `vitest.config.ts`/`globals.css`; `git revert`.

## Open Questions

- [ ] Verify `auth()` availability in RSC (NextAuth 5) vs `cookies()` fallback — probe in tasks.
