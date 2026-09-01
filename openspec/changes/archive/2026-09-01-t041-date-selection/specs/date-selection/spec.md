# Delta for date-selection — t041-date-selection (New Capability)

> New capability, no prior spec. FL-01 step 4 `?date=YYYY-MM-DD` BA (INV-06) → `GET /api/availability?date=&serviceId=` (INV-08/03). Feeds T-042; no new API.

## ADDED Requirements

### Requirement: RSC Shell via Server-Direct with BA Derivation

The system SHALL render `/(customer)/appointments/new` as async RSC `export const dynamic="force-dynamic"` (no SSG). SHALL guard via `auth()` (INV-03) — unauthenticated SHALL `redirect("/login")`. SHALL call `getWorkshopConfig()` for `timezone=America/Argentina/Buenos_Aires` + `operatingHours→closedDows`, and `listServices(db,{includeInactive:false})` to resolve `selectedService` by `searchParams.serviceId` (UUID `find(active)`). SHALL validate `searchParams.date` via `dateSchema` → `selectedDate: Date|null` (noon BA), derive `min=todayBa`/`max=todayBa+60d` via `Intl en-CA`, pass `{selectedDate,min,max,closedDows,timezone,selectedService}` to `DateSelector`. All DTOs camelCase (INV-08).

#### Scenario: Shell success — BA today + service resolution
- GIVEN auth passes, `WorkshopConfig timezone BA`, `listServices→[{id:uuidA,active:true}]`, URL `?serviceId=uuidA&date=2026-09-01`
- WHEN RSC validates `date` via `dateSchema` + derives `min/max` via `Intl en-CA`
- THEN renders `selectedService=uuidA`, `selectedDate`=BA noon `2026-09-01`, `min`=today BA, `max`=+60d

#### Scenario: Tampered ?date fallback — no 500
- GIVEN URL `?serviceId=uuidA&date=not-a-date` or `2026-13-40` or `2026-02-30`
- WHEN RSC `dateSchema.safeParse` fails (regex/superRefine noon mismatch)
- THEN `selectedDate=null`, banner hidden, 200 no throw

### Requirement: URL-Canonical Date Selection (Native Input)

The system SHALL provide `"use client"` `DateSelector` reading `useSearchParams` and writing `?date=YYYY-MM-DD` via `router.push` + `URLSearchParams` (no `localStorage`). SHALL render native `<input type="date" min max>` (BA `YYYY-MM-DD` strings). On `onChange` SHALL set/delete `date` while preserving siblings `serviceId`/`vehicleId`. SHALL expose `SelectedBanner` with `Continue href="?serviceId=&date="` for T-042. State survives refresh/deep-link/share.

#### Scenario: Date selection writes ?date= preserving siblings
- GIVEN URL `?serviceId=uuidA&vehicleId=uuidV`, `min=2026-09-01 max=2026-10-31`
- WHEN user picks `2026-09-10` via input
- THEN `router.push("?serviceId=uuidA&vehicleId=uuidV&date=2026-09-10",{scroll:false})`, refresh keeps selection

#### Scenario: Clear date deletes param, siblings intact
- GIVEN URL `?serviceId=uuidA&date=2026-09-10`
- WHEN user clears input (empty)
- THEN `router.push("?serviceId=uuidA")`, `selectedDate=null`

### Requirement: BA Date Validation — min/max/ClosedDows (INV-06)

The system SHALL validate in `lib/validators/date.ts` pure: `DATE_MAX_DAYS=60`, `dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).superRefine(noon round-trip)`, `getTodayBaYmd(tz)`, `addBaDays(ymd,days,tz)`, `isPastBa(ymd,tz)`, `getBaDayUtcRange(ymd,tz)`. `getTodayBaYmd` SHALL use `Intl.DateTimeFormat("en-CA",{timeZone})` — SHALL NOT use `toISOString()`/UTC. `max` SHALL be `addBaDays(todayBa,60)`. Closed hint SHALL derive `closedDows: number[]` (0=Sun) from `WorkshopConfig.operatingHours`; past/overflow/closed SHALL fallback `null` or hint, T-042 returns `200 []` on closed.

#### Scenario: Past date rejected — fallback null
- GIVEN `todayBa=2026-09-01`, URL `?date=2026-08-31`
- WHEN `superRefine` checks `value < min` / `isPastBa`
- THEN fails → `selectedDate null`, input disabled via `min`, no 500

#### Scenario: Overflow date 2026-02-30 fallback null
- GIVEN URL `?date=2026-02-30` (regex passes, calendar invalid)
- WHEN noon round-trip parses to `2026-03-02` mismatch
- THEN fails → `null`, no throw, banner hidden

#### Scenario: Closed weekday hint
- GIVEN `operatingHours Mon-Fri` → `closedDows=[0,6]`, pick `2026-09-06` Sunday BA
- WHEN `DateSelector` renders with `closedDows`
- THEN shows "Closed on Sundays" hint; selection allowed, T-042 returns `200 []`

### Requirement: Guard Missing serviceId — CTA to /services (INV-08)

The system SHALL guard `!serviceId` or not found in active list → render CTA `href="/services"` ("Select a service first"), SHALL NOT render `DateSelector` orphaned. When valid, SHALL render `DateSelector`; `SelectedBanner` SHALL appear only when both `selectedService` and `selectedDate` non-null, preserving both params for T-042.

#### Scenario: Missing serviceId shows CTA
- GIVEN URL `/appointments/new` or `?date=2026-09-10` without `serviceId`
- WHEN RSC `find(active, id===serviceId)` → not found
- THEN CTA `href="/services"` shown, `DateSelector`/`SelectedBanner` hidden, no 500

#### Scenario: Sibling preservation — serviceId + vehicleId survive changes
- GIVEN `?serviceId=uuidA&vehicleId=uuidV` and user changes date
- WHEN valid date selected or cleared
- THEN URL always retains `serviceId`+`vehicleId` alongside `date`

### Requirement: Loading and Error Boundaries for RSC (INV-03, INV-08)

The system SHALL provide `appointments/new/loading.tsx` skeleton (`aria-busy`, shimmers) and `appointments/new/error.tsx` boundary (401→`/login` redirect, no leak; generic→retry). Both wrap RSC awaiting `auth()+getWorkshopConfig+listServices`. Styles via `appointments.module.css` tokens, no Tailwind, no `fecha` leak.

#### Scenario: Loading skeleton vs error 401 vs success
- GIVEN pending `auth()+config` vs 401 vs success
- WHEN Next.js renders `loading.tsx` / `error.tsx` / page
- THEN pending→skeleton `aria-busy`; 401→login link/redirect; success→`DateSelector` or CTA guard
