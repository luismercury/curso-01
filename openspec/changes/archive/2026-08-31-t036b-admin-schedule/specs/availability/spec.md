# Delta for Availability

## ADDED Requirements

### Requirement: DB-Backed Operating Hours Consumption

The system SHALL resolve operating hours per-request via `await getWorkshopConfig(db)` (merging `workshop_schedules` rows with parametrizable defaults, `timezone=America/Argentina/Buenos_Aires` DST-aware via `getBaDayUtcRange`/`baWallTimeToUtcDate`) for `GET /api/availability` slot generation and `POST /api/appointments` `fechaHoraFin <= finIntervaloOperativo` check. The system SHALL NOT cache globally; patched schedule SHALL reflect on next request. Creation outside patched intervals SHALL return 400 `{error:{code:VALIDATION_ERROR}}` via `calculateEndAndValidate` inclusive `<=`.

#### Scenario: GET availability reflects patched schedule
- GIVEN ADMINISTRADOR patched Tuesday to `[{09:00-10:00}]` and `service duration=60`
- WHEN `GET /api/availability?date=2026-09-08&serviceId=...` (Tuesday BA)
- THEN 200 `availableSlots` contains only `["09:00"]` (was 12 before) via `getWorkshopConfig(db)`

#### Scenario: Creation outside patched interval rejected
- GIVEN same patched Tuesday `09:00-10:00` close
- WHEN `POST /api/appointments` with `startDateTime=2026-09-08T11:00:00-03:00` duration 60 (`fin=12:00 > finIntervaloOperativo 10:00`)
- THEN 400 `{error:{code:VALIDATION_ERROR}}` and no `countActiveOverlappingForUpdate` executed

#### Scenario: BA DST per-request resolution
- GIVEN patched schedule and date near BA DST transition
- WHEN `GET /api/availability` via `getBaDayUtcRange` then `baWallTimeToUtcDate` oracle
- THEN UTC range matches oracle and slot count matches patched intervals
