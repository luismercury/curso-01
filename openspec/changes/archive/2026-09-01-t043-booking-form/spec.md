# Booking Form Specification — t043-booking-form (New Capability)

> New capability, no prior spec. Adds the missing vehicle-selector step to F-04's 4-selection booking form on /appointments/new and the submit/confirm action that calls POST /api/appointments. Closes FL-01 booking flow: from `/services` (T-040) → date (T-041) → slot (T-042) → vehicle (T-043) → result (T-044). No new domain.

## Purpose

Deliver the missing vehicle-selection UI on /appointments/new (vehicleId already preserved in URL but no selector exists) and wire Confirm to POST /api/appointments (T-039). 201 → /appointments?confirmed=<id> for T-044; 409/403/401/0-vehicles → inline banners with remediation. All 4 selections remain URL-canonical (refresh/back/share lossless).

[Cite implementation-plan.md T-043, Functional-Spec.md:164-173 F-04, Technical-spec.md:574-635, 700-720, 760-770.]

## Requirements

### Requirement: RSC Vehicle List Fetch

The system SHALL keep `/(customer)/appointments/new` as `force-dynamic revalidate=0` guarded by `auth() → redirect("/login")` (INV-03). SHALL extend `Promise.all([getWorkshopConfig(db), listServices(db,{includeInactive:false})])` with `listVehiclesByCustomer(db, session.user.id)` server-direct in parallel (D1 — no HTTP hop). SHALL map to `VehicleDTOJson[]` (brand/model/year/plate/customerId/createdAt/updatedAt ISO) via `vehiculo.ts:20-30` and never leak `marca`/`patente`/`cliente_id`/`fecha_*` (INV-08).

#### Scenario: Authenticated user with vehicles
- GIVEN `auth` ok, `session.user.id === customerId`, `listVehiclesByCustomer` returns `[{brand, model, year, plate, ...}]`
- WHEN RSC resolves
- THEN HTML includes VehicleSelector with DTO primitives only; no `marca`/`patente` substrings

#### Scenario: Zero vehicles
- GIVEN `auth` ok, `listVehiclesByCustomer` returns `[]`
- WHEN RSC resolves
- THEN CTA "Add a vehicle to book" → /vehicles; BookingForm absent or disabled

#### Scenario: Unauthenticated
- GIVEN `auth` null
- WHEN RSC resolves
- THEN `redirect("/login")`, no `listVehiclesByCustomer` call, no DTO leak

### Requirement: URL-Canonical VehicleSelector Compound

The system SHALL provide `"use client"` compound `VehicleSelector` (`List`/`Card`/`SelectedBanner`/`ClearButton`/`Empty`) mirroring `ServiceSelector.tsx:1-134`: `createContext` + `use` for state; `useSearchParams().get("vehicleId")` reactively; `vehicleIdSchema` uuid + `vehicles.some(v=>v.id===candidate&&v.customerId===userId)` guard (tampered/deleted/foreign → `null`); `select(id)` → `router.push("?vehicleId="+id,{scroll:false})`; `clear()` → `params.delete("vehicleId")` via `URLSearchParams(searchParams.toString())`; `Empty` when `vehicles.length===0`; `SelectedBanner` only when `selectedId&&selected&&selected.customerId===userId`; `VehicleCard` as `<button type="button" role="radio" aria-checked>` with `brand model (year) — plate`.

#### Scenario: Selection writes URL with siblings preserved
- GIVEN `?serviceId=uuidA&date=2026-09-10&slot=09:30`, `vehicles=[{id:uuidV,…}]`
- WHEN click vehicle uuidV
- THEN URL `?serviceId=uuidA&date=2026-09-10&slot=09:30&vehicleId=uuidV`, `router.push({scroll:false})`, banner shows summary

#### Scenario: Clear deletes vehicleId sibling
- GIVEN `?vehicleId=uuidV`, banner rendered
- WHEN click Clear
- THEN `params.delete("vehicleId")`, banner hidden, sibling params intact

#### Scenario: Tampered / foreign vehicle
- GIVEN `?vehicleId=uuidV-other-user` or `?vehicleId=garbage`
- WHEN guard `vehicles.some(...)` fails
- THEN no `aria-checked=true`, banner hidden, no 500

### Requirement: Confirm/Submit Compound + POST /api/appointments

The system SHALL provide `"use client"` compound `BookingForm` (`Summary`/`Submit`/`ErrorBanner`) mounted only when `selectedService&&selectedDate&&selectedSlot&&selectedVehicle` all resolved: `Summary` 4-row card (Service/Vehicle/Date/Time); `Submit` `<button type="button" disabled={!allValid||isPending} aria-busy={isPending}>`; on click build `startDateTime=\`${selectedDate}T${selectedSlot}:00-03:00\`` (BA fixed -03:00 Law 26.474/2009, TODO(DST) escape to `slotGenerator.baWallTimeToUtcDate`); call `submitBooking({vehicleId,serviceId,startDateTime})` from `lib/api/appointments.ts` (`credentials:include`, JSON, mirrors `lib/api/vehicles.ts:42-49` + `lib/http/errors.ts:10-42`); 201→`router.push("/appointments?confirmed="+dto.id,{scroll:false})`; 409 `APPOINTMENT_NOT_AVAILABLE`→`ErrorBanner`+`router.refresh()`; 403 `FORBIDDEN`→banner+`params.delete("vehicleId")`; 422 `INVALID_SERVICE`→banner+`params.delete("serviceId")`+CTA /services; 401→`window.location.assign("/login?next=/appointments/new")`; other→generic banner+retry; `useTransition`/`isPending` gates Submit — no double INSERT.

#### Scenario: All 4 valid → submit → 201 → navigate to T-044
- GIVEN valid `serviceId`+`date`+`slot`+`vehicleId`
- WHEN click Confirm
- THEN fetch POST 201 TurnoDTO → `router.push("/appointments?confirmed="+dto.id,{scroll:false})`, `aria-busy=true` during flight

#### Scenario: 0 vehicles → Confirm disabled + CTA
- GIVEN `vehicles.length===0`
- WHEN page renders
- THEN Submit absent or `disabled`, CTA "Add a vehicle to book" → /vehicles

#### Scenario: 409 race → inline banner + refetch slots
- GIVEN server returns 409 `APPOINTMENT_NOT_AVAILABLE`
- WHEN fetch rejects `ApiError {code: APPOINTMENT_NOT_AVAILABLE}`
- THEN `ErrorBanner` `role="alert"` "El horario seleccionado ya no se encuentra disponible", `router.refresh()` re-runs T-042 fetch, siblings intact

#### Scenario: 403 ownership → clear ?vehicleId= + banner
- GIVEN server returns 403 (vehicle tampered between SSR and submit)
- WHEN fetch rejects `ApiError {code: FORBIDDEN}`
- THEN `ErrorBanner` "Vehicle not found or not owned", `params.delete("vehicleId")`, VehicleSelector re-renders unselected, siblings preserved

#### Scenario: Idempotent submit
- GIVEN user double-clicks Confirm rapidly
- WHEN first click in flight
- THEN button `disabled`+`aria-busy=true`; second click no-op; only 1 INSERT (server REPEATABLE READ + EXCLUDE gist also guards)

### Requirement: BA Timezone Reconstruction + INV Compliance

The system SHALL reconstruct `startDateTime` as `${YYYY-MM-DD}T${HH:mm}:00-03:00` (BA -03:00 fixed since 2009-12 Law 26.474, IANA `America/Argentina/Buenos_Aires` no DST). SHALL satisfy `route.ts:27` `Z|[+-]HH:MM` regex. SHALL NOT use `new Date(\`${date}T${slot}\`).toISOString()` (host TZ drift, INV-06). SHALL document `TODO(DST)` escape to `slotGenerator.baWallTimeToUtcDate` offset-delta. All RSC→client primitives remain camelCase English (INV-08) — no `cliente_id`/`marca`/`patente`/`fecha*`.

#### Scenario: BA -03:00 wall-clock → UTC
- GIVEN `?date=2026-09-10&slot=09:30`
- WHEN BookingForm builds `startDateTime`
- THEN `"2026-09-10T09:30:00-03:00"`; server stores `TIMESTAMPTZ "2026-09-10T12:30:00.000Z"`; not host-TZ derived

#### Scenario: All 4 selections preserved through chain
- GIVEN `serviceId`+`date`+`slot`+`vehicleId` all valid
- WHEN navigating/refreshing/sharing URL
- THEN RSC re-resolves all 4; BookingForm enables; primitives only cross server→client

## File Changes (informative)

| File | Action | Description |
|---|---|---|
| `openspec/specs/booking-form/spec.md` | Create | THIS spec (canonical, mirrors availability-display style) |
| `openspec/changes/t043-booking-form/spec.md` | Create | Thin pointer (byte-identical to canonical) |

## Testing Strategy

Layers:
- **Unit** `lib/api/appointments.test.ts`: POST contract, envelope 409/403/422/401, 201.
- **Validator** `vehicleId.test.ts`: uuid + ownership guard.
- **Compound jsdom** `VehicleSelector.test.tsx`: write/clear siblings, tampered, empty, banner.
- **Compound jsdom** `BookingForm.test.tsx`: gate, summary, 409+refresh, 403 clear, idempotency, TZ.
- **RSC** `page.test.tsx`: vehicles wire, 0-vehicles CTA, auth, INV-08.
- **E2E** `tests/e2e/t043-booking-form.spec.ts`: full chain → Confirm → navigate.

## Threat Matrix

N/A — no shell/subprocess/VCS/PR/executable. Pure RSC + `fetch` + `router.push`.

## Migration / Rollout

No migration. Additive `selectedService&&selectedDate&&selectedSlot&&selectedVehicle`; T-040/041/042 untouched. Rollback = revert; delete compounds + helper + CSS; restore `page.tsx`; `route.ts` unchanged.

## Open Questions

- [ ] `useTransition` (React 19) or local `isPending` for submit gate?
- [ ] On 401, `window.location.assign` or rely on next auth-gated throw?
- [ ] `VehicleSelector.Empty`: link to /vehicles or inline form?
