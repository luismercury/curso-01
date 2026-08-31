# Proposal: t036b-admin-schedule — PATCH /api/admin/schedule (H-05)

## Intent
ADMIN mutates operating hours per `dayOfWeek 0-6`. `WorkshopConfig` is frozen — changes vanish on restart, `GET /api/availability` ignores them. Solves Functional §6.2/H-05, keeps `09:00-12:00/14:00-18:00` parametrizable per INV-01/05.

## Scope

### In Scope
- Migration `0006_workshop_schedules` (`day_of_week PK 0..6`, `open_intervals jsonb`, `updated_at timestamptz`)
- Repo `workshopSchedules.ts` + `getWorkshopConfig(db)` merging DB rows + defaults
- `PATCH /api/admin/schedule {dayOfWeek, openIntervals}` ADMIN-only persisted
- Swaps: `availability` + `appointments` → `await getWorkshopConfig(db)` (`finIntervaloOperativo`)
- Tests: 403, 400, availability reflects, outside-interval creation rejected

### Out of Scope
- Full-week `PUT`, UI, env/in-memory mutation (rejected)

## Capabilities

> Contract for sdd-spec. Researched `openspec/specs/availability` and `openspec/specs/appointment`.

### New Capabilities
- `workshop-schedule`: per-day `PATCH` mutation, `validateIntervals` superRefine, `workshop_schedules` persistence

### Modified Capabilities
- `availability`: consumes `getWorkshopConfig(db)`; availability + `fechaHoraFin <= finIntervaloOperativo` honor patched schedule (INV-05)

## Approach

**A — DB-backed `workshop_schedules` (RECOMMENDED):** per-day `jsonb` upsert, `getWorkshopConfig(db)` builds `WeeklySchedule`, reuses pure helpers — zero slot logic change.

*B — in-memory/file:* ephemeral on Vercel, breaks `Object.freeze`, multi-instance divergence — debt.
*C — env-only 501:* fails H-05 `PATCH → 200`.

A is spec-aligned (§6.3.1/§8.9 parametrizable, INV-01/05), Vercel-safe, durable, small blast radius (1 migration + 1 repo ~80L + 1 route ~70L + 2 swaps).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `drizzle/0006_*.sql` + `_journal.json` | New | table `CHECK 0..6`, idx 6 |
| `src/db/repositories/workshopSchedules.ts` | New | `getWorkshopConfig`, `upsertDaySchedule`, snake↔camel |
| `src/config/workshopConfig.ts` | Modified | add `getWorkshopConfig(db)`, keep frozen fallback |
| `src/app/api/admin/schedule/route.ts` | New | `PATCH` `requireAuth→assertRole` before parse, Zod `superRefine` |
| `src/app/api/availability/route.ts` | Modified | `await getWorkshopConfig(db)` per request |
| `src/app/api/appointments/route.ts` | Modified | same swap for `finIntervaloOperativo` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Validation bypass (overlap/start>=end) | Med | `validateIntervals` in Zod + pre-write; test overlapping/unsorted |
| Auth bypass (CLIENTE patches) | Med | `requireAuth→assertRole` before `req.json()`; 403 test |
| Stale availability | Low | per-request `getWorkshopConfig(db)`, no global cache; assert post-PATCH |
| Hard-code regression INV-01/05 | Low | defaults only in `workshopSchedule.ts` |

## Rollback Plan
Truncate `workshop_schedules` or revert migration; routes fall back to frozen `workshopConfig` (empty table → defaults). No user data loss.

## Dependencies
- T-035 `assertRole` + `requireAuth`
- T-019b `WorkshopConfig` / pure helpers reused
- `jsonb` + `drizzle-kit`

## Success Criteria
- [ ] ADMIN `PATCH` valid → `200 {dayOfWeek, openIntervals}` persisted; CLIENTE → `403 FORBIDDEN`
- [ ] Invalid intervals (overlap/start>=end/unsorted/>24:00) → `400 VALIDATION_ERROR` + `issues`, no mutation
- [ ] Post-PATCH `GET /api/availability` reflects; creation outside interval → `400` (`finIntervaloOperativo`)
- [ ] No hard-coded intervals outside `workshopSchedule.ts`; INV-05 parametrizable
- [ ] Migration idx 6 linear, tests/build green, review <400 lines
