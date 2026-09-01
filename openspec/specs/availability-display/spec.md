# Availability Display Specification — t042-show-availability (New Capability)

> New capability, no prior spec. RSC fetches `?serviceId=+?date=` BA → `HH:mm` grid writing `?slot=` siblings. Bridges T-041 FL-01 step 5 → T-043 booking. No `POST`. Reuses T-025 domain.

## Purpose

Show only bookable `HH:mm` that survive `durationMinutes`, `fechaHoraFin <= finIntervaloOperativo`, `count < capacityPerSlot`, and closed `[]` filters (INV-01 `capacityPerSlot=1`, INV-05 `slotStep 30`, INV-06 BA timezone, INV-08 camelCase). `WorkshopConfig` is source of truth.

## Requirements

### Requirement: RSC Conditional Availability Fetch

The system SHALL keep `/(customer)/appointments/new` as `dynamic="force-dynamic" revalidate=0` guarded by `auth()` → `redirect("/login")` (INV-03). SHALL keep `Promise.all([getWorkshopConfig(db), listServices(db,{includeInactive:false})])` parallel. When `selectedService` (UUID `find(active)`) AND `selectedDate` (`YYYY-MM-DD` BA) are valid, SHALL call server-direct `getAvailableSlotsForDate({date:noonDate, durationMinutes, config, fetchActiveTurnos:(r)=>findActiveTurnosByDateRange(db,r)})` where `noonDate=new Date(date+"T12:00:00.000Z")` and map `formatSlotsAsHHmm(...,config.timezone)` → `availableSlots:string[]` (`[]` for closed/fully-booked). Otherwise `availableSlots=null`. Only `string[]` crosses to client. Tampered/inactive `?serviceId=` → `null`, no fetch.

#### Scenario: Valid pair fetches filtered HH:mm
- GIVEN `auth` ok, `?serviceId=uuidA` active `60min`, `?date=2026-09-10` BA valid, `config` BA `slotStep30 capacity1`
- WHEN RSC resolves `selectedService&&selectedDate` and calls `getAvailableSlotsForDate` → `formatSlotsAsHHmm`
- THEN HTML includes `AvailabilitySlots` with `["09:00","09:30",...]` filtered `fechaHoraFin<=finIntervalo`, `force-dynamic` kept

#### Scenario: Tampered fallback — no 500
- GIVEN `?serviceId=not-uuid`/inactive or `?date=2026-02-30`/past/`>60d max`
- WHEN validation `serviceIdSchema`/`dateSchema`+`getBaDayUtcRange`+`isPastBa`/`addBaDays` fails
- THEN `selected* = null`, `availableSlots=null`, no domain call, 200 hint/CTA

### Requirement: URL-Canonical AvailabilitySlots Compound

The system SHALL provide `"use client"` compound `AvailabilitySlots` (`Grid`/`Empty`/`SelectedBanner`) reading `useSearchParams` and writing `?slot=HH:mm` via `router.push` + `URLSearchParams(searchParams.toString())` `{scroll:false}`, preserving `serviceId`/`date`/`vehicleId`. SHALL enforce `slotSchema=/^(?:[01]\d|2[0-3]):(?:00|30)$/` (INV-05 step 30). Grid SHALL be `role="radiogroup"` with `role="radio" aria-checked` per slot; `includes` guard ignores `?slot=` not in `availableSlots`. `SelectedBanner` SHALL render only when `selectedService&&selectedDate&&selectedSlot` valid (includes). Clear SHALL `delete("slot")`.

#### Scenario: Selection preserves siblings
- GIVEN `?serviceId=uuidA&date=2026-09-10&vehicleId=uuidV`, `slots=["09:00","09:30"]`
- WHEN click `09:30`
- THEN `router.push("?serviceId=uuidA&date=2026-09-10&vehicleId=uuidV&slot=09%3A30",{scroll:false})`, banner shows `09:30`

#### Scenario: Clear and invalid guard
- GIVEN `?slot=09:30` or `?slot=25:00` tampered/not in `slots`
- WHEN clear `delete("slot")` or guard `!includes(slot)`
- THEN clear → URL without `slot`, banner hidden; tampered → no pressed state, no 500

### Requirement: BA Validation and Empty States

The system SHALL derive `min=getTodayBaYmd(tz)` (`Intl en-CA`), `max=addBaDays(todayBa,60,tz)`, `closedDows:number[]` (0=Sun..6=Sat, `[]` when `operatingHours[dow]` empty) from `getWorkshopConfig(db)` (INV-06). Past/overflow/`>max` → `selectedDate null`. Closed or fully-booked (`count>=capacity`) → `200 []` → `Empty` distinguishes closed (`closedDows.includes(getBaDow(date,tz))` → "Closed") vs EC-02 booked ("No availability"). `fechaHoraFin<=finIntervaloOperativo` via `calculateEndAndValidate` is server-authoritative.

#### Scenario: Closed vs booked vs tampered
- GIVEN Sunday `2026-09-06` closed `[0,6]` vs open fully-booked `2026-09-10` vs `?date=2026-02-30`
- WHEN resolving `availableSlots`
- THEN closed → `[]` "Closed on Sundays"; booked → `[]` EC-02 "No availability"; tampered → `null` hint

#### Scenario: Duration and HH:mm invariants
- GIVEN `duration 90`, `slotStep30`, slots filtered `fechaHoraFin<=finIntervalo`
- WHEN `11:30+90` would exceed `12:00`
- THEN absent; all strings match `slotSchema` sorted, `availableSlots` camelCase only

### Requirement: Loading and Error Boundaries Reuse

The system SHALL reuse `loading.tsx` (`aria-busy` shimmers) and `error.tsx` boundary for availability branch; pending `auth()+config+list+getAvailableSlotsForDate` shows same skeleton. `401` → `/login`, generic → retry without leak. No per-slot `Suspense`; grid renders sync from `string[]`. Styles extend `appointments.module.css` (`slotGrid`/`slotButton`/`slotSelected`), no Tailwind.

#### Scenario: Loading vs empty vs error
- GIVEN pending availability vs resolved `[]` vs thrown error
- WHEN Next.js renders segment
- THEN pending → shimmer `aria-busy`; `[]` → `Empty` EC-02/closed; error → retry button

#### Scenario: Auth still gates fetch
- GIVEN unauthenticated `?serviceId=uuidA&date=2026-09-10`
- WHEN `auth()` null
- THEN `redirect("/login")`, no `getAvailableSlotsForDate` call
