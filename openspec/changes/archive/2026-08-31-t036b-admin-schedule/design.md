# Design: t036b-admin-schedule — PATCH /api/admin/schedule (H-05)

## Technical Approach

DB per-day `workshop_schedules` + `getWorkshopConfig(db)` merges rows with `DEFAULT_OPERATING_INTERVALS` fallback. `PATCH /api/admin/schedule` ADMIN-only, Zod strict + `validateIntervals` superRefine, upserts one `dayOfWeek`. Consumers `availability` and `appointments` swap frozen import for `await getWorkshopConfig(db)` per-request, preserving INV-05 inclusive `<= finIntervaloOperativo` and INV-06 UTC/BA DST. No global cache; pure helpers reused.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Per-day `workshop_schedules` vs single-row `workshop_config` | Single-row needs read-modify-write full week → lost update; per-day 1:1 PATCH, idempotent | **Per-day** — `smallint PK 0..6 CHECK`, `open_intervals jsonb NOT NULL`, `updated_at TIMESTAMPTZ` |
| `getWorkshopConfig(db)` vs frozen / mutable singleton | Frozen ephemeral; mutable breaks `Object.freeze` invariant, diverges on Vercel; file fails readonly FS | **DB provider** — merge rows → `WeeklySchedule`; empty → Mon-Fri defaults, Sat-Sun `[]`; frozen kept as fallback |
| Zod `strict+superRefine(validateIntervals)` vs regex-only | Regex passes overlap/start>=end/unsorted/>24:00 → corrupts `generateSlotsForDate` | **Reuse `validateIntervals`** — `start<end`, `00:00-24:00`, sorted, `prev.end<=curr.start`; route + repo guard |
| Per-request `await getWorkshopConfig(db)` vs global cache | Global cache → stale availability until restart | **Per-request** — `~5ms` PG, no `next/cache` or `let cached` |
| `drizzle/0006_*.sql` idx 6 vs ad-hoc SQL | Missing journal bump breaks T-009 linear check | **drizzle-kit generate** — `CHECK 0..6` + journal idx 6 |

## Data Flow

```
PATCH /api/admin/schedule {dayOfWeek, openIntervals}
  requireAuth→401, assertRole(ADMIN)→403 before req.json
  Zod strict+superRefine(validateIntervals)→400 {issues} no mutation
  upsertDaySchedule(db, dayOfWeek, openIntervals) → 200 {dayOfWeek, openIntervals}

GET /api/availability | POST /api/appointments
  requireAuth → await getWorkshopConfig(db) → getBaDayUtcRange(DST)
  → getOperatingIntervalsForDate → calculateEndAndValidate(end<=finIntervaloOperativo→400)
  → getAvailableSlotsForDate / countActiveOverlappingForUpdate → 200/201/409
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `drizzle/0006_*.sql` + `meta/_journal.json` | Create/Modify | `workshop_schedules(day_of_week smallint PK 0..6, open_intervals jsonb, updated_at TIMESTAMPTZ)` |
| `src/db/schema.ts` | Modify | Add `workshopSchedules` pgTable |
| `src/db/repositories/workshopSchedules.ts` | Create | `getWorkshopConfig`/`getDay`/`upsertDay`, snake↔camel, `validateIntervals` guard |
| `src/config/workshopConfig.ts` | Modify | Add `getWorkshopConfig(db)` merging rows + defaults; keep frozen fallback; `server-only` |
| `src/app/api/admin/schedule/route.ts` | Create | `PATCH` `requireAuth→assertRole` before parse, strict+superRefine, 401/403/400, `dynamic='force-dynamic'` |
| `src/app/api/availability/route.ts` | Modify | `await getWorkshopConfig(db)` DI |
| `src/app/api/appointments/route.ts` | Modify | Same swap for `finIntervaloOperativo` |
| `src/config/workshopSchedule.ts` | Keep | Helpers reused unchanged |

## Interfaces / Contracts

```typescript
workshop_schedules: { day_of_week: 0..6 PK, open_intervals: jsonb NOT NULL, updated_at: timestamptz }
getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig> // rows→WeeklySchedule, fallback defaults
getDaySchedule(db, dayOfWeek): Promise<TimeInterval[] | null>
upsertDaySchedule(db, dayOfWeek, intervals): Promise<TimeInterval[]>
PATCH /api/admin/schedule {dayOfWeek:0..6, openIntervals:[{start,end}]} strict+superRefine(validateIntervals)
  → 200 {dayOfWeek, openIntervals} | 401 | 403 | 400 VALIDATION_ERROR {issues}
validateIntervals: throws ValidationError if start>=end/overlap/unsorted/>24:00
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | Overlap/start>=end/unsorted/>24:00 reject, adjacent allow | `workshopSchedule.test.ts` pure throws |
| Repo integration | Empty→defaults Mon-Fri/Sat `[]`; upsert read-back | PG truncate + upsert assert `WeeklySchedule` |
| Route | CLIENTE→403 no write; invalid→400 no mutation; ADMIN→200; unauth→401 | `vi.mock` `requireAuth`/`db`, assert envelope + not called on 400/403 |
| Availability reflects | Patch Tue `09:00-10:00` then `GET availability?date=Tue` → `["09:00"]` only | Seed row → `getWorkshopConfig` → `getAvailableSlotsForDate` |
| Creation outside | `POST appointments T11:00+60` →400 distinct from 409, no FOR UPDATE | Assert 400 before `countActiveOverlappingForUpdate` |

## Threat Matrix

| Boundary | Applicable | Reason / Expected Behavior | Planned RED Test |
|----------|------------|----------------------------|------------------|
| Routing (new PATCH handler) | **Applicable** | New `PATCH /api/admin/schedule` must enforce `requireAuth→assertRole` before parse; search path `src/app/api/admin/schedule/route.ts` | CLIENTE token →403; missing token →401 even with valid body |
| Shell / subprocess | N/A | No `exec`, `spawn`, or shell interpolation; Zod strict JSON only | — |
| VCS / PR automation | N/A | No git/gh invocations; migration via `drizzle-kit generate` only | — |
| Executable-file classification | N/A | No file upload or `isExecutable` handling | — |
| Process integration | N/A | No worker/queue IPC; per-request DB read only, no fork | — |

Fail: invalid never reaches DB (400 `issues`); auth returns `{error:{code}}` no stack; patched reflects next request.

## Migration / Rollout

`drizzle-kit generate` → `0006` + journal idx 6 linear `0..6`. Empty table → fallback defaults (no behavior change). PATCH populates rows; rollback `TRUNCATE` or revert migration → frozen defaults. RLS none v1 (`assertRole`). No user data loss.

## Open Questions

- [ ] Confirm `updated_at` `$onUpdate` vs DB trigger acceptable for raw-SQL writes (defer to T-009 if needed)
- [ ] Optional `GET /api/admin/schedule` for verification — out of scope unless UI needs it
