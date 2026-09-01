# Delta for service — t040-service-selection (New Capability, alias of service-selection)

> Alias — canonical is `specs/service-selection/spec.md`. Duplicated for tooling expecting `service` domain. Content identical.

## ADDED Requirements

### Requirement: Service List via RSC Server-Direct (INV-08, T-017)

The system SHALL render `/(customer)/services` as async RSC guarded by `auth()` (`redirect('/login')` via `(customer)` layout). SHALL call `listServices(db,{includeInactive:false})` direct (no HTTP hop, `dynamic="force-dynamic"`), SHALL map `ServicioDTO→ServiceDTOJson` via `toServicioDTO` (`nombre→name, descripcion→description, duracionMinutos→durationMinutes, activo→active`) with `createdAt/updatedAt` ISO UTC strings, ordered `createdAt ASC`, SHALL return `200` active-only. SHALL wrap in `loading.tsx` Suspense skeleton (`aria-busy`) and `error.tsx` boundary. `GET /api/services` remains public active-only; UI auth guard is independent.

#### Scenario: List success — active only, no inactive
- GIVEN 3 services (`60,90,120` active) + 1 `activo=false`, `listServices` mocked `activeOnly=true`
- WHEN RSC `auth()` passes and calls `listServices(db,{includeInactive:false})`
- THEN page renders 3 `ServiceCard` ordered ASC, inactive absent, DTO has `name/durationMinutes/active` ISO, no `nombre`

#### Scenario: Empty state vs loading skeleton
- GIVEN `listServices` returns `[]` vs pending `auth()+listServices`
- WHEN RSC renders with file-convention boundaries
- THEN `[]` → "No services available" empty (no 404, no selector) vs pending → skeleton shimmers (`aria-busy`)

#### Scenario: DTO snake leak negative
- GIVEN DB row `{nombre, descripcion, duracionMinutos, activo, created_at}` TIMESTAMPTZ UTC
- WHEN RSC or `lib/api/services.ts` returns DTO
- THEN `NOT.toHaveProperty("nombre")|("duracionMinutos")|("activo")|("fecha")`, has `name,description,durationMinutes,active,createdAt,updatedAt`

### Requirement: Service Selection via URL Canonical (`?serviceId=`)

The system SHALL provide `"use client"` compound `ServiceSelector` (`ServiceSelector.List`/`.Card`/`.SelectedBanner`, no boolean-prop bloat) reading/writing `?serviceId=` via `useSearchParams` + `router.push("?serviceId="+id,{scroll:false})`. SHALL derive `selectedId` from `searchParams.serviceId` validated `z.string().uuid()` + `find(active)`; invalid/tampered/inactive → fallback no selection (no 500) with banner hidden. SHALL derive `durationMinutes` by `find` on `ServiceDTOJson[]` (no N+1, no client `fechaHoraFin` calc). SHALL show selected ring (`aria-pressed="true"` + `.cardSelected`) + `SelectedBanner` with `formatDuration(durationMinutes)` and `Continue` link preserving `?serviceId=` for T-041. State SHALL persist on refresh/deep-link/share; SHALL NOT use `localStorage`.

#### Scenario: Selection success — valid active `?serviceId=`
- GIVEN list `[{id:uuidA,active:true,durationMinutes:90}]`, URL `?serviceId=uuidA`
- WHEN RSC validates UUID + `find(active)` and islands render
- THEN `Card uuidA` `aria-pressed=true` + banner "1 h 30 min" + `Continue href="/appointments/new?serviceId=uuidA"`

#### Scenario: Tampered/inactive `?serviceId=` fallback
- GIVEN URL `?serviceId=not-uuid` or UUID absent from list or `activo=false` hidden
- WHEN RSC/client validates `safeParse` + `find(active)`
- THEN no card selected, banner hidden, no 500, shows "Select a service" hint

#### Scenario: URL persistence on refresh and deep-link
- GIVEN user selected `uuidA` via click (`router.push`)
- WHEN page refreshed or URL shared `/services?serviceId=uuidA`
- THEN RSC re-validates same UUID and renders selected state without `localStorage`

### Requirement: Validation & Filtering (Duration, Activo)

The system SHALL display `durationMinutes` via pure `formatDuration` (`60→"60 min",90→"1 h 30 min",120→"2 h"`) from `ServiceDTOJson` only. SHALL hide `activo=false` (never selectable); `GET /api/services` default `activeOnly` and RSC `includeInactive:false` enforce it. SHALL treat invalid `serviceId` as no selection, not `VALIDATION_ERROR` 500.

#### Scenario: Inactive hidden, not selectable
- GIVEN seed `Cambio 60 active`, `Revisión 120 inactive`
- WHEN list renders and URL `?serviceId=inactiveId`
- THEN inactive not in `ServiceList`, `find(active)` fails, banner hidden

### Requirement: Composition & Error Mapping (No Hardcode, No Leak)

The system SHALL compose `ServiceSelector.List` iterating `key={s.id}` UUID stable, `ServiceCard` presentational (`name`, truncated `description`, `formatDuration`), `SelectedBanner` explicit variant; SHALL NOT hardcode service names. SHALL expose `lib/validators/service.ts` pure (`z.uuid`, `formatDuration`) and `lib/api/services.ts` thin helper (`cache:"no-store"`, `credentials:"include"` optional, `ApiError {error:{code,message,issues?}}`, `isErrorBody`) for any client refetch. SHALL map `401→redirect /login` (RSC) / `push` (client), `403` banner, distinct from `400/404` on `?includeInactive` misuse. No `Date` passed to client, no `nombre` leak, no Tailwind.

#### Scenario: Error mapping — 401/403 vs validation
- GIVEN unauthenticated vs non-admin `?includeInactive=true` vs tampered `serviceId`
- WHEN route/helper parses `ErrorBody`
- THEN 401→`/login`, 403→banner, tampered → no error thrown (fallback), not 500

> Note: `/appointments/new` alias — if `serviceId` present redirect to T-041 date step, else redirect to `/services`; documented, not implemented here.
