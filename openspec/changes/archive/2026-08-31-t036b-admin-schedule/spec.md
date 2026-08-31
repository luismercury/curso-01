# Spec Delta Index — t036b-admin-schedule

> Hybrid artifact index. Normative deltas live in `specs/workshop-schedule/spec.md` (new) and `specs/availability/spec.md` (modified). This file is a concatenated view for reviewers.

## Change
`t036b-admin-schedule` — `PATCH /api/admin/schedule` DB-backed `workshop_schedules`, `validateIntervals`, `getWorkshopConfig(db)` consumer swaps.

---

# Workshop Schedule — New Domain

See `specs/workshop-schedule/spec.md` for normative text.

**Summary**: ADMIN-only `PATCH /api/admin/schedule {dayOfWeek 0..6, openIntervals}` with `requireAuth→assertRole` before parse (401/403), validated via `validateIntervals` (`start<end`, sorted, non-overlapping, `00:00-24:00` → 400 `VALIDATION_ERROR` no mutation), persisted to `workshop_schedules(day_of_week PK jsonb)` single-day upsert idempotent 200, defaults parametrizable in `workshopSchedule.ts` only with empty-table fallback Mon-Fri `09:00-12:00/14:00-18:00` / Sat-Sun `[]`.

# Availability — Modified Domain

See `specs/availability/spec.md` for normative text.

**Summary**: `GET /api/availability` and `POST /api/appointments` SHALL consume `await getWorkshopConfig(db)` per-request (DST-aware BA) so `finIntervaloOperativo` reflects patched intervals; global cache forbidden; outside-interval creation → 400 `VALIDATION_ERROR` distinct from 409 capacity; slot generation `finIntervaloOperativo` inclusive `<=` honored.

## Coverage (7 scenarios)

| Domain | Requirement | Scenarios |
|--------|-------------|-----------|
| workshop-schedule | Admin Schedule Mutation | ADMIN 200 persists, CLIENTE 403 no mutation, idempotent |
| workshop-schedule | Interval Validation | 400 overlapping solapados, 400 start>=end/unsorted |
| workshop-schedule | Parametrizable Defaults | defaults fallback empty table |
| availability | DB-Backed Consumption | GET reflects patched, creation outside rejects 400, BA DST |

## Invariants

INV-01/05/06: `capacityPerSlot=1`, `slotStepMinutes=30`, `timezone=America/Argentina/Buenos_Aires` remain parametrizable via `WorkshopConfig`; DB `snake_case` ↔ API `camelCase`; `TIMESTAMPTZ` UTC; `fechaHoraFin <= finIntervaloOperativo` inclusive.

## Traceability

Proposal `t036b-admin-schedule` Capabilities: `workshop-schedule` new, `availability` modified. Technical-spec §8.9, §6.3.1. Pure helpers reused unchanged.
