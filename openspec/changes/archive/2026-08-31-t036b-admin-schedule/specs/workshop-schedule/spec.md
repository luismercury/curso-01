# Workshop Schedule Specification

## Purpose

Per-day operating hours mutated by ADMIN via `PATCH /api/admin/schedule`, persisted to `workshop_schedules`. Parametrizable (INV-01/05), DB-backed, BA timezone (`America/Argentina/Buenos_Aires`).

## Requirements

### Requirement: Admin Schedule Mutation

The system SHALL expose `PATCH /api/admin/schedule` accepting `{dayOfWeek:0..6, openIntervals:[{start:HH:mm,end:HH:mm}]}`. The system SHALL enforce `requireAuth → assertRole(ADMINISTRADOR)` before `req.json()`; unauthenticated SHALL return 401, non-ADMIN SHALL return 403 `{error:{code:FORBIDDEN}}` with no mutation. On success SHALL upsert `workshop_schedules(day_of_week PK CHECK 0..6, open_intervals jsonb, updated_at timestamptz)` for that single day and SHALL return 200 `{dayOfWeek, openIntervals}`. The operation SHALL be idempotent.

#### Scenario: ADMIN patches Monday succeeds and persists
- GIVEN authenticated ADMINISTRADOR and `{dayOfWeek:1, openIntervals:[{09:00-12:00},{14:00-18:00}]}`
- WHEN `PATCH /api/admin/schedule`
- THEN 200 `{dayOfWeek:1, openIntervals:[...]}` and row `day_of_week=1` upserted

#### Scenario: CLIENTE patch rejected 403 no mutation
- GIVEN authenticated CLIENTE and valid payload
- WHEN `PATCH /api/admin/schedule`
- THEN 403 `{error:{code:FORBIDDEN}}` and no DB write

#### Scenario: Idempotent repatch same payload
- GIVEN row `day_of_week=1` already stored
- WHEN same PATCH repeated by ADMINISTRADOR
- THEN 200 same body and single row unchanged

### Requirement: Interval Validation

The system SHALL validate `openIntervals` via `validateIntervals` (Zod `superRefine`) and SHALL reject when `start>=end`, overlapping, unsorted, or outside `00:00-24:00`. Invalid SHALL return 400 `{error:{code:VALIDATION_ERROR, issues}}` and SHALL NOT mutate.

#### Scenario: Overlapping intervals rejected
- GIVEN ADMIN payload `{dayOfWeek:2, openIntervals:[{09:00-12:00},{11:30-14:00}]}`
- WHEN `PATCH /api/admin/schedule`
- THEN 400 `VALIDATION_ERROR` with overlap message and no row written

#### Scenario: start>=end and unsorted rejected
- GIVEN ADMIN payload `{dayOfWeek:2, openIntervals:[{12:00-09:00}]}` or unsorted `[{14:00-18:00},{09:00-12:00}]`
- WHEN `PATCH /api/admin/schedule`
- THEN 400 `VALIDATION_ERROR` with `start must be before end` or `sorted by start` and no mutation

### Requirement: Parametrizable Defaults and Persistence

The system SHALL treat `workshop_schedules` rows as overrides merged by `getWorkshopConfig(db)` with `DEFAULT_OPERATING_INTERVALS=[{09:00-12:00},{14:00-18:00}]` (parametrizable, INV-05). When no row exists, Mon-Fri SHALL fallback to defaults and Sat/Sun SHALL return `[]` closed. Defaults SHALL reside only in `workshopSchedule.ts`.

#### Scenario: Defaults fallback when table empty
- GIVEN `workshop_schedules` empty
- WHEN `getWorkshopConfig(db)` for Monday BA
- THEN intervals equal `DEFAULT_OPERATING_INTERVALS`; Saturday returns `[]`
