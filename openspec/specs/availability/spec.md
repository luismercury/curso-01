# Delta for Availability — T-026 Traceability (EC-02)

> Pure-test change: no behavior change. Locks 7 T-026 minima + EC-02 `200 {availableSlots: []}` against frozen `WorkshopConfig`, `tstzrange &&`, inclusive `<=`, BA DST. T-021..T-025 unchanged.

## ADDED Requirements

### Requirement: Empty-Day Baseline (parametrized)

The system MUST return all candidates when no active turnos exist, via `WorkshopConfig` (`slotStepMinutes=30`, `timezone=America/Argentina/Buenos_Aires`, e.g. `09:00-12:00/14:00-18:00`) with inclusive `fechaHoraFin <= finIntervaloOperativo`.

#### Scenario: Empty weekday 60min returns 12 slots
- GIVEN open weekday `2026-09-07`, config `capacityPerSlot=1, slotStepMinutes=30, timezone=America/Argentina/Buenos_Aires`, `fetchActiveTurnos` mocked `[]` for `getBaDayUtcRange(date,timezone)`
- WHEN `getAvailableSlotsForDate` called with `durationMinutes=60`
- THEN `availableSlots` is `["09:00","09:30","10:00","10:30","11:00","14:00","14:30","15:00","15:30","16:00","16:30","17:00"]` sorted

#### Scenario: DST oracle does not alter count
- GIVEN BA wall `new Date('2026-09-07T09:00:00-03:00')` converted via `Intl.DateTimeFormat` delta (not hardcoded `-03:00`)
- WHEN wrapper computes `getBaDayUtcRange("2026-09-07",timezone)` then delegates to pure
- THEN UTC range matches `baWallTimeToUtcDate` oracle and count stays 12

### Requirement: Single Active Appointment Occupancy

The system MUST treat any candidate with `tstzrange(start,end) && tstzrange(existing.fechaHoraInicio,existing.fechaHoraFin)` overlapping a `PENDIENTE` or `CONFIRMADO` turno as occupied when `count >= capacityPerSlot`.

#### Scenario: PENDIENTE 09:00-10:00 blocks 09:00/09:30 not 10:00
- GIVEN `durationMinutes=60`, `capacityPerSlot=1`, existing `09:00-10:00 PENDIENTE`
- WHEN wrapper filters with mocked fetch containing that entry
- THEN `09:00,09:30` absent, `10:00` present (half-open `[)` via `getTime()`)

#### Scenario: CONFIRMADO blocks identically
- GIVEN same interval with `estado=CONFIRMADO`
- WHEN same call
- THEN identical result — both statuses in `ACTIVE_STATUSES` block

### Requirement: Overlapping Count vs Capacity

The system MUST evaluate `countOverlapping < capacityPerSlot` (DI integer `>=1`, not hardcoded `1` nor boolean).

#### Scenario: Table capacity 1 vs 2 vs 3
- GIVEN candidate `09:00 60min`, fixtures two `09:00-10:00` entries (`PENDIENTE`+`CONFIRMADO`)
- WHEN `capacityPerSlot=1` with 1 overlap THEN blocked
- WHEN `capacityPerSlot=2` with 1 overlap THEN available; with 2 overlaps THEN blocked
- AND `RECHAZADO/CANCELADO` same interval does not increment count

### Requirement: Duration-Parametrized Filtering

The system MUST generate candidates with `step=30` and keep only those where `fechaHoraFin=start+durationMinutes` satisfies `fechaHoraFin <= finIntervaloOperativo` via `calculateEndAndValidate` + `findContainingInterval` (DST-aware).

#### Scenario: Duration table on empty day
- GIVEN open weekday, mocked `[]`
- WHEN `durationMinutes` varies
- THEN `30→14` (incl. `11:30,17:30`), `60→12` (incl. `11:00` where `11:00+60==12:00` valid), `90→10` (last `10:30/16:30`), `120→8`

#### Scenario: Duration filter precedes overlap
- GIVEN `durationMinutes=90`
- WHEN candidates generated before overlap counting
- THEN `11:30` never generated (`13:00>12:00`) regardless of fixtures

### Requirement: Outside Operating Hours

The system MUST return `[]` when date has no `openIntervals` or existing turnos lie outside intervals.

#### Scenario: Closed Saturday and outside-interval entry
- GIVEN `date=2026-09-12` Saturday no intervals, `durationMinutes=60`, mocked fetch `[{13:00-14:00 PENDIENTE}]` (gap `12:00-14:00`)
- WHEN wrapper called
- THEN `availableSlots` is `[]`; the `13:00` entry creates no slot

### Requirement: EC-02 No Availability — 200 with availableSlots []

The system MUST signal "no hay disponibilidad" as `200 {date, availableSlots: []}` with no `error` key, distinct from `400/404` validation errors, for both fully-booked and closed causes.

#### Scenario: EC-02 fully booked 60/90 and closed day named
- GIVEN fully booked: all candidates for `60` (and separately `90`) covered by `PENDIENTE` entries, OR closed Saturday with any mocked data; `serviceId` valid and active, DI `WorkshopConfig`
- WHEN `GET /api/availability?date=&serviceId=` via route (auth mocked) or via `getAvailableSlotsForDate`
- THEN status `200`, body `{date:"YYYY-MM-DD", availableSlots:[]}` sorted, `error` absent, test name contains `EC-02`, no `ValidationError` thrown for empty

### Requirement: Closing Boundary Exclusion — T-022b 11:30+90

The system MUST exclude candidates where `start+duration>finIntervaloOperativo` using inclusive `<=` (`11:00+60==12:00` valid, `11:30+90==13:00>12:00` invalid).

#### Scenario: 11:30+90 excluded before overlap
- GIVEN open weekday, `durationMinutes=90`, mocked `[]`
- WHEN `generateSlotsForDate`/`getAvailableSlots`/wrapper executed
- THEN `11:30` and beyond-close mirror absent, `10:30+90==12:00` present; `calculateEndAndValidate({start:BA 11:30,duration:90})` is `valid=false`

### Requirement: DB-Backed Operating Hours Consumption (t036b-admin-schedule)

The system SHALL resolve operating hours per-request via `await getWorkshopConfig(db)` (merging `workshop_schedules` rows with parametrizable defaults, `timezone=America/Argentina/Buenos_Aires` DST-aware via `getBaDayUtcRange` / `baWallTimeToUtcDate`) for `GET /api/availability` slot generation and `POST /api/appointments` `fechaHoraFin <= finIntervaloOperativo` inclusive `<=` check. The system SHALL NOT cache globally; a patched schedule SHALL reflect on the next request. Creation outside patched intervals SHALL return `400 {error:{code:VALIDATION_ERROR}}` via `calculateEndAndValidate`, distinct from `409` capacity rejection, and SHALL NOT execute `countActiveOverlappingForUpdate`.

#### Scenario: GET availability reflects patched schedule
- GIVEN ADMINISTRADOR patched Tuesday to `[{09:00-10:00}]` and `service duration=60`
- WHEN `GET /api/availability?date=2026-09-08&serviceId=...` (Tuesday BA)
- THEN `200 {availableSlots: ["09:00"]}` (was `12` before) via `getWorkshopConfig(db)`

#### Scenario: Creation outside patched interval rejected
- GIVEN same patched Tuesday `09:00-10:00` close
- WHEN `POST /api/appointments` with `startDateTime=2026-09-08T11:00:00-03:00` duration 60 (`fin=12:00 > finIntervaloOperativo 10:00`)
- THEN `400 {error:{code:VALIDATION_ERROR}}` and no `countActiveOverlappingForUpdate` executed

#### Scenario: BA DST per-request resolution
- GIVEN patched schedule near BA DST transition
- WHEN `GET /api/availability` via `getBaDayUtcRange` then `baWallTimeToUtcDate` oracle
- THEN UTC range matches oracle and slot count matches patched intervals

#### Scenario: Two consecutive requests re-call provider (no global cache)
- GIVEN consecutive `GET /api/availability` calls against the same `db`
- WHEN `getWorkshopConfig(db)` is instrumented
- THEN it is invoked once per request (no module/global cache)
