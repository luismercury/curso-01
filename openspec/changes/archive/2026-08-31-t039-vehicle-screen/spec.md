# Delta for vehicle — t039-vehicle-screen (New Capability)

> Aggregate delta — canonical per-domain: `specs/vehicle/spec.md`. New capability, no prior spec.

## ADDED Requirements

### Requirement: Vehicle List via RSC Server Auth

The system SHALL render `GET /vehicles` deriving `customerId` via server `auth()` JWT httpOnly, fetching `GET /api/customers/{customerId}/vehicles` with `no-store`. SHALL return `200 VehicleDTO[]` ordered `createdAt ASC`. SHALL show Suspense skeleton while loading, empty state for `[]`, `401→/login` redirect, `403` inline banner. No client URL `customerId`.

#### Scenario: List success — own vehicles
- GIVEN authenticated CLIENTE with 2 vehicles owned (`clienteId==authUser.id`), `auth()` returns `customerId`
- WHEN RSC shell calls list helper with that id
- THEN response `200` contains `VehicleDTO[]` length 2 ordered ASC and page renders list

#### Scenario: Empty state and loading skeleton
- GIVEN authenticated CLIENTE with zero vehicles (`findVehiculosByClienteId` returns `[]`)
- WHEN RSC renders with Suspense boundary
- THEN skeleton shows while pending and then empty message "No vehicles yet" (no 404) with create form visible

#### Scenario: 401 before 403 precedence on list
- GIVEN no valid `authjs.session-token` JWT vs non-owner CLIENTE calling `GET /api/customers/{otherId}/vehicles`
- WHEN request hits route
- THEN no-JWT → `401 {error:{code:UNAUTHORIZED}}` before any validation; non-owner → `403 {error:{code:FORBIDDEN}}` even if `customerId` malformed; RSC maps 401→redirect `/login`, 403→banner

### Requirement: Vehicle Create with Client Validation and Server Mirror

The system SHALL provide `"use client"` form via `lib/api/vehicles.ts` (`credentials:include`, `no-store`, parse `ErrorBody {error:{code,message,issues?}}`). SHALL validate client-side mirroring `vehicleCreateInputSchema` strict: `brand`/`model` trimmed `2..100`, `year` int `1900..maxYear` (`maxYear` server prop to avoid hydration mismatch), `plate` via `normalizePatente` (`trim+toUpper+strip [\s-]`) then `/^[A-Z0-9]{6,7}$/`. On valid SHALL `POST` and on `201 VehicleDTO` SHALL `router.refresh()`. Inline `400 issues` mapping.

#### Scenario: Create success 201 and revalidate
- GIVEN authenticated CLIENTE, form `{brand:"Peugeot", model:"207", year:2011, plate:"abc-123"}` normalized to `ABC123` passes client Zod
- WHEN helper `POST` with `credentials:include`
- THEN response `201 VehicleDTO {id,customerId,brand,model,year,plate}` and list includes new entry after `router.refresh()`

#### Scenario: Validation rejects plate and year
- GIVEN form `{brand:"Peugeot", model:"207", year:1800}` or `plate:"AB!@#"` or `plate:"AB1"` (too short) after `normalizePatente`
- WHEN client validates or server parses `vehicleCreateInputSchema`
- THEN client shows inline error before fetch; server fallback `400 {error:{code:VALIDATION_ERROR, issues}}` with path `plate`/`year`

#### Scenario: Duplicate plate 409 global UNIQUE
- GIVEN `patente` `ABC123` already exists (global `UNIQUE`, any owner) and client passes validation
- WHEN `POST` creates vehicle
- THEN service maps `23505` to `409 {error:{code:PLATE_ALREADY_EXISTS}}` and form maps to field error "Plate already exists" without clearing brand/model

### Requirement: Ownership Golden Rule and DTO Invariants (INV-03/INV-08)

The system SHALL derive `customerId` only from `auth()` JWT (`sub`+`role`) and SHALL `assertOwnership(customerId,authUser)` if URL carries id (`ADMINISTRADOR` bypass else `403`). SHALL return `VehicleDTO` camelCase via `toVehiculoDTO` (`marca→brand, modelo→model, anio→year, patente→plate, cliente_id→customerId`) with ISO UTC strings, no snake/Spanish leak.

#### Scenario: DTO contains camelCase only — snake leak negative
- GIVEN row `{id, cliente_id, marca, modelo, anio, patente, created_at, updated_at}` TIMESTAMPTZ UTC
- WHEN `GET` or `POST` returns DTO
- THEN body has `brand,model,year,plate,customerId,createdAt,updatedAt` (ISO strings), and `NOT.toHaveProperty("marca")|("patente")|("cliente_id")|("fecha")`

### Requirement: UX Composition and Error Mapping

The system SHALL compose `VehicleProvider` + `VehicleList`/`Empty`/`ErrorBanner`/`VehicleForm.Create` (no boolean-prop bloat), wrap list in `Suspense` skeleton, handle `401→login` (RSC redirect/client `push`), `403` banner, `400` inline `issues`, `409` plate error. `maxYear` server prop. Helper pure client-safe.

#### Scenario: Error mapping and auth divergence
- GIVEN form valid but server returns `401` vs `403` vs `400` with `issues` vs `409`
- WHEN helper parses `ErrorBody`
- THEN `401` → `router.push("/login")`, `403` → banner "Not owner", `400` → inline per `issues[0].path`, `409` → plate field error
