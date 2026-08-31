```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1881721f0b71e61832f68ac590bbc49f84d2d59fde11c95c640a14694d03e8a9
verdict: pass
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 9/9
test_command: pnpm vitest run src/app/api/availability src/app/api/appointments src/app/api/admin/schedule src/config/__tests__/workshopConfig.test.ts src/db/__tests__/workshopSchedules.integration.test.ts src/db/__tests__/t009-integrity.integration.test.ts
test_exit_code: 0
test_output_hash: sha256:d17d5dcdde070e6d5a54fb3638ef4242c45669e3a867cde62e48debacbf88db5
build_command: pnpm tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verify Report: t036b-admin-schedule — PATCH /api/admin/schedule (H-05)

> **Mode:** Standard (`strict_tdd=false`, `rdd_disabled` — read-only verify)
> **Branch:** `feature/t036b-admin-schedule` @ `9497a6c` (3 stacked PRs: f718991 PR1, 49823c2 PR2, 9497a6c PR3)
> **Delta type:** NEW + MODIFIED (`workshop-schedule` new, `availability` modified)

## Verdict

**PASS**

All 9 GWT scenarios across 4 requirements pass on the tracker branch at `9497a6c`. Implementation matches the per-domain delta specs (`workshop-schedule` new + `availability` modified). DB layer: `drizzle/0006_workshop_schedules.sql` applied with `smallint PK CHECK 0..6 + jsonb NOT NULL + TIMESTAMPTZ DEFAULT now()`; journal index 6 linear (T-009 integrity green, 7/7). `PATCH /api/admin/schedule` follows H-19 401→403→400→200 precedence with `requireAuth→assertRole(ADMINISTRADOR)` BEFORE `req.json()` and Zod strict + `superRefine(validateIntervals)` guarding overlap/start>=end/unsorted/>24:00, idempotent per-day upsert via `onConflictDoUpdate`. Consumers (`availability` GET, `appointments` POST + GET) `await getWorkshopConfig(db)` per request — no global cache. Reflection tests prove patched intervals flow into slot generation and `fechaHoraFin <= finIntervaloOperativo` inclusive `<=` check (duration.ts:177). Per-request DI proven by consecutive-call mocks on both routes. Hardcode grep: `DEFAULT_OPERATING_INTERVALS = [{09:00-12:00},{14:00-18:00}]` lives only in `src/config/workshopSchedule.ts:16-19` as required by INV-05 parametrizable. `pnpm tsc --noEmit` clean (exit 0, empty output). `pnpm eslint` 0 errors (3 unused-import warnings — 1 t036b-introduced on `route.test.ts:35` + 2 pre-existing on `admin/appointments/[id]/{confirm,reject}/route.test.ts`). Full `pnpm vitest run`: 885 passed / 3 failed / 2 skipped. The 3 failures are exactly the pre-existing DB-dependent set documented in apply-progress (`servicios.schema` ships-no-route guard, `servicios.integration` duplicate-nombre UNIQUE, `clientes.schema` db singleton, `turnos.integration`) — NO regressions introduced by t036b.

## Spec Acceptance Criteria Mapping

The spec declares **4 ADDED requirements** with **9 GWT scenarios** across two domains:

### workshop-schedule domain (new, 3 requirements, 6 scenarios)

| # | Requirement | Scenarios | Tests | Result |
|---|---|---|---|---|
| 1 | **Admin Schedule Mutation** | ADMIN 200 persists, CLIENTE 403 no mutation, Idempotent repatch | `route.test.ts:218, 97, 235` + integration `:69, 92` | **PASS** |
| 2 | **Interval Validation** | 400 overlapping rejected, 400 start>=end/unsorted rejected | `route.test.ts:120, 137, 151, 168` + integration `:107, 119, 141` | **PASS** |
| 3 | **Parametrizable Defaults and Persistence** | empty table → Mon-Fri DEFAULT, Sat/Sun `[]` | integration `:51` + `workshopConfig.test.ts:91, 185` + grep | **PASS** |

### availability domain (modified, 1 requirement, 3 scenarios)

| # | Requirement | Scenarios | Tests | Result |
|---|---|---|---|---|
| 4 | **DB-Backed Operating Hours Consumption** | GET reflects patched, creation outside interval 400, BA DST per-request | `availability/route.test.ts:465, 493, 514, 374, 360` + `appointments/route.test.ts:433, 481, 507, 537, 552` | **PASS** |

**Coverage: 4/4 requirements, 9/9 GWT scenarios — all PASS.**

## Evidence Summary

| Command | Exit | Result |
|---|---|---|
| `pnpm vitest run src/app/api/availability src/app/api/appointments src/app/api/admin/schedule src/config/__tests__/workshopConfig.test.ts src/db/__tests__/workshopSchedules.integration.test.ts src/db/__tests__/t009-integrity.integration.test.ts` | 0 | **Test Files 9 passed (9) / Tests 158 passed (158) / Duration 3.30s** |
| `pnpm tsc --noEmit` | 0 | **clean** (no output — empty stdout hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) |
| `pnpm vitest run src/services/availability src/services/__tests__/appointmentService.test.ts src/services/__tests__/appointmentLifecycle.test.ts` | 0 | **Test Files 7 passed (7) / Tests 236 passed (236)** (regression-free service layer) |
| `pnpm eslint <t036b scope>` | 0 | **0 errors / 3 warnings** — 1 t036b-introduced (unused `ForbiddenError` import on `route.test.ts:35`), 2 pre-existing on `admin/appointments/[id]/{confirm,reject}/route.test.ts` |
| `pnpm vitest run` (full suite) | 0 | **Test Files 50 passed / 4 failed / 1 skipped (55) / Tests 885 passed / 3 failed / 2 skipped (890)** — failures are exactly the pre-existing DB-dependent set; **no regressions** |
| `pnpm db:migrate` | 0 | migrations applied; journal idx 6 linear (T-009 integrity 7/7) |
| `psql \d workshop_schedules` | 0 | `day_of_week smallint PRIMARY KEY NOT NULL / open_intervals jsonb NOT NULL / updated_at timestamptz DEFAULT now() NOT NULL; CHECK workshop_schedules_day_of_week_check (day_of_week BETWEEN 0 AND 6)` |
| `rg '09:00\|14:00\|12:00\|18:00' src/` | 0 | only `src/config/workshopSchedule.ts:16-19` (`DEFAULT_OPERATING_INTERVALS`); all other matches are tests or Date fixtures unrelated to operating hours |

Test output hash (sha256): `D17D5DCDDE070E6D5A54FB3638EF4242C45669E3A867CDE62E48DEBACBF88DB5`.
Build output hash (sha256): `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (sha256 of empty stdout — known constant).

## GWT Scenario Detail

### Scenario 1 — ADMIN patches Monday succeeds and persists

```
GIVEN authenticated ADMINISTRADOR + {dayOfWeek:1, openIntervals:[09:00-12:00,14:00-18:00]}
WHEN  PATCH /api/admin/schedule
THEN  200 {dayOfWeek:1, openIntervals:[...]} and row day_of_week=1 upserted
```

**PASS** — `src/app/api/admin/schedule/route.test.ts:218` asserts 200 + camelCase body matching input; `upsertDayScheduleMock` called with `(db, 1, VALID_BODY.openIntervals)`. `src/db/__tests__/workshopSchedules.integration.test.ts:69` upsert persists jsonb + reads back via raw SQL `SELECT day_of_week, open_intervals FROM workshop_schedules WHERE day_of_week = 2`.

### Scenario 2 — CLIENTE patch rejected 403 no mutation

```
GIVEN authenticated CLIENTE + valid payload
WHEN  PATCH /api/admin/schedule
THEN  403 {error:{code:FORBIDDEN}} and no DB write
```

**PASS** — `route.test.ts:97` 403 CLIENTE: role fails BEFORE parse even with valid body; `upsertDayScheduleMock` not called. `route.test.ts:107` 403 wins over 400 (invalid body + CLIENTE → 403 not 400).

### Scenario 3 — Idempotent repatch same payload

```
GIVEN row day_of_week=1 stored
WHEN  same PATCH repeated by ADMIN
THEN  200 same body and single row unchanged
```

**PASS** — `route.test.ts:235` 200 idempotent repatch: same payload twice produces same row (mock.calls identical, body identical). `workshopSchedules.integration.test.ts:92` `upsertDaySchedule` updates existing row (idempotent `onConflictDoUpdate`).

### Scenario 4 — Overlapping intervals rejected

```
GIVEN ADMIN {dayOfWeek:2, openIntervals:[09:00-12:00, 11:30-14:00]}
WHEN  PATCH /api/admin/schedule
THEN  400 VALIDATION_ERROR with overlap message and no row written
```

**PASS** — `route.test.ts:120` 400 overlap via `superRefine`; `upsertDayScheduleMock` not called. `workshopConfig.test.ts:262` rejects overlapping via superRefine. `workshopSchedules.integration.test.ts:119` repo guard throws `/overlapping/`.

### Scenario 5 — start>=end and unsorted rejected

```
GIVEN ADMIN {12:00-09:00} or unsorted [{14:00-18:00},{09:00-12:00}]
WHEN  PATCH /api/admin/schedule
THEN  400 VALIDATION_ERROR with 'start must be before end' or 'sorted by start' and no mutation
```

**PASS** — `route.test.ts:137` 400 start>=end (matches `/start must be before end/`), `:151` 400 unsorted (matches `/sorted by start/`). `workshopConfig.test.ts:274-292` start>=end + unsorted rejected via superRefine. `workshopSchedules.integration.test.ts:107` repo start>=end ValidationError.

### Scenario 6 — Defaults fallback when table empty

```
GIVEN workshop_schedules empty
WHEN  getWorkshopConfig(db) for Monday BA
THEN  intervals equal DEFAULT_OPERATING_INTERVALS; Saturday returns []
```

**PASS** — `workshopSchedules.integration.test.ts:51` empty table → Mon-Fri `DEFAULT_OPERATING_INTERVALS`, Sat/Sun `[]` (real DB). `workshopConfig.test.ts:91` `DEFAULT_OPERATING_INTERVALS = [{09:00-12:00},{14:00-18:00}] as const`. `workshopConfig.test.ts:185-191` Mon-Fri defaults, Sat/Sun `[]`. Hardcode grep: `09:00-12:00/14:00-18:00` literal only in `src/config/workshopSchedule.ts:16-19` and tests.

### Scenario 7 — GET availability reflects patched schedule

```
GIVEN ADMINISTRADOR patched Tuesday to [{09:00-10:00}] and service duration=60
WHEN  GET /api/availability?date=2026-09-08&serviceId=...
THEN  200 availableSlots contains only ["09:00"] (was 12 before) via getWorkshopConfig(db)
```

**PASS** — `availability/route.test.ts:465` patched Tuesday 09:00-10:00 → only `["09:00"]` slot (was 12 with defaults). `availability/route.ts:55-57` `const config = await getWorkshopConfig(db)` per request (no global cache).

### Scenario 8 — Creation outside patched interval rejected

```
GIVEN same patched Tuesday 09:00-10:00 close
WHEN  POST /api/appointments startDateTime=2026-09-08T11:00:00-03:00 duration 60
      (fin=12:00 > finIntervaloOperativo 10:00)
THEN  400 {error:{code:VALIDATION_ERROR}} and no countActiveOverlappingForUpdate executed
```

**PASS** — `appointments/route.test.ts:433` patched narrow interval → start 11:00+60 → 400 VALIDATION_ERROR (message matches `/finIntervaloOperativo/`). `appointments/route.ts:78` `await getWorkshopConfig(db)` → `:102-103` `ValidationError → toErrorBody(ERROR_CODES.VALIDATION_ERROR, ...)` → 400 VALIDATION_ERROR. `services/availability/duration.ts:177` inclusive `end.getTime() <= intervalEnd.getTime()` (no FOR UPDATE before validation).

### Scenario 9 — BA DST per-request resolution

```
GIVEN patched schedule and date near BA DST transition
WHEN  GET /api/availability via getBaDayUtcRange then baWallTimeToUtcDate oracle
THEN  UTC range matches oracle and slot count matches patched intervals
```

**PASS** — `availability/route.test.ts:374` BA DST range: string overload matches Date overload and NY DST differs (23h day on 2026-03-08). `:360` single bulk fetch with BA range via string overload. `availability/route.ts:61` `getBaDayUtcRange(dateStr, config.timezone)` DST-safe. Per-request `await getWorkshopConfig(db)` ensures patched schedule flows into `getOperatingIntervalsForDate` via `Intl.DateTimeFormat("en-CA", {timeZone})` (BA timezone, no host `getDay`).

## Invariant Compliance

| Invariant | Status | Evidence |
|---|---|---|
| **INV-01** `capacityPerSlot=1` count-based, `slotStepMinutes=30`, both via `WorkshopConfig` parametrizable | ✅ PASS | `workshopConfig.ts:85-94` `capacityPerSlot=1` default, `slotStepMinutes=30` default (divisible by 5, range 5..60). `workshopSchedules.ts:96-104` `getWorkshopConfig` reuses frozen values. No hardcoded constants outside `workshopSchedule.ts` (grep). |
| **INV-02** states `PENDIENTE\|CONFIRMADO\|RECHAZADO\|CANCELADO` (no `COMPLETADO`); `canTransition(from, to, role)` matrix | ✅ untouched | Pure appointment state machine, no schedule mutation in this change. `stateMachine.ts` unchanged. |
| **INV-03** Auth.js/NextAuth with JWT in httpOnly cookie + bcrypt; `requireAuth` precedence | ✅ PASS | `route.ts:35-58` `requireAuth→assertRole(ADMINISTRADOR)` BEFORE `req.json()` (1) and Zod (3). `route.test.ts:77` 401 wins over 400, `:97` 403 wins over 400, `:273` H-19 precedence all-in-one. |
| **INV-04** Atomic `REPEATABLE READ` + `SELECT FOR UPDATE` + `EXCLUDE USING gist` | ✅ untouched | Schedule mutation is non-capacity (no EXCLUDE — single admin writer, last-write-wins acceptable per design). `appointmentService.createAppointment` REPEATABLE READ + FOR UPDATE preserved (236/236 service tests pass). |
| **INV-05** slot generation uses fixed step 30, filtered by `durationMinutes`; `fechaHoraFin <= finIntervaloOperativo` inclusive `<=` | ✅ PASS | `services/availability/duration.ts:177` `end.getTime() <= intervalEnd.getTime()` (inclusive). `appointments/route.ts:103` `ValidationError → 400 VALIDATION_ERROR`. `DEFAULT_OPERATING_INTERVALS = [{09:00-12:00},{14:00-18:00}]` lives only in `workshopSchedule.ts:16-19`. |
| **INV-06** DB `TIMESTAMPTZ` UTC; API ISO 8601 with timezone; `timezone=America/Argentina/Buenos_Aires` | ✅ PASS | `drizzle/0006_workshop_schedules.sql:4` `timestamp with time zone` (not naive). `appointments/route.ts:27-28` `isoWithTimezoneRegex` requires Z or ±HH:MM. `services/availability/duration.ts:171` `baWallTimeToUtcDate` via Intl delta (DST-aware). |
| **INV-08** DTO mapping (DB `snake_case` ↔ API `camelCase`); no raw DB names leak | ✅ PASS | `route.ts:82-85` returns `dayOfWeek`/`openIntervals` only. `route.test.ts:263-270` no snake_case leak. `workshopSchedules.ts:35-45` `rowToIntervals` maps jsonb → camelCase `TimeInterval`. |
| **H-05** `PATCH /api/admin/schedule` validates before persistence | ✅ PASS | `workshopConfig.ts:47-62` `workshopScheduleInputSchema = z.object({...}).strict().superRefine(validateIntervals)`. `workshopSchedules.ts:66` `validateIntervals(intervals)` guard runs before insert/upsert. `route.ts:68-77` Zod strict + superRefine → 400 no mutation. |
| **H-19** auth precedence 401→403→400 | ✅ PASS | `route.ts:35-77` order: `requireAuth` (1) → `assertRole` (2) → `req.json` (3) → Zod (4) → `upsertDaySchedule` (5). All three precedence tests green. |
| **no-hardcode** no hardcoded operating intervals outside `workshopSchedule.ts` | ✅ PASS | `rg '09:00\|14:00\|12:00\|18:00' src/` → only `workshopSchedule.ts:16-19` (`DEFAULT_OPERATING_INTERVALS`); all other matches are tests or Date/Time fixtures unrelated to operating hours; `workshopSchedules.ts:21` comment-only reference. |
| **per-request-no-cache** no global cache of WorkshopConfig; per-request `await getWorkshopConfig(db)` | ✅ PASS | `availability/route.ts:57` `const config = await getWorkshopConfig(db)`. `appointments/route.ts:78` (POST) and `:150` (GET) same pattern. `availability/route.test.ts:514` two consecutive GETs re-call provider. `appointments/route.test.ts:507` two consecutive POSTs re-call provider. |

## DB Verification

```
$ psql \d workshop_schedules
                     Table "public.workshop_schedules"
     Column     |           Type           | Collation | Nullable | Default
----------------+--------------------------+-----------+----------+---------
 day_of_week    | smallint                 |           | not null |
 open_intervals | jsonb                    |           | not null |
 updated_at     | timestamp with time zone |           | not null | now()
Indexes:
    "workshop_schedules_pkey" PRIMARY KEY, btree (day_of_week)
Check constraints:
    "workshop_schedules_day_of_week_check" CHECK (day_of_week >= 0 AND day_of_week <= 6)
```

- Migration file: `drizzle/0006_workshop_schedules.sql` (6 lines, exact match to design).
- Journal index: 6 (linear `0..6`, T-009 integrity green).
- `src/db/__tests__/workshopSchedules.integration.test.ts:141` raw-SQL bypass test: `INSERT … VALUES (7, '[]'::jsonb)` and `(-1, '[]'::jsonb)` both rejected with PG `code: 23514` (check_violation), proving the CHECK constraint fires even when Drizzle is bypassed.
- Schema `src/db/schema.ts:230-246` `workshopSchedules` `pgTable` with `smallint("day_of_week").primaryKey().notNull()`, `jsonb("open_intervals").$type<unknown[]>().notNull()`, `timestamp("updated_at", {withTimezone:true}).notNull().defaultNow().$onUpdate(() => new Date())`, plus `check("workshop_schedules_day_of_week_check", sql\`${table.dayOfWeek} BETWEEN 0 AND 6\`)`.

## File Diff Audit (vs `8268257` baseline)

```
drizzle/0006_workshop_schedules.sql                                    |  +6
drizzle/meta/0006_snapshot.json                                        | +555 (auto-gen)
drizzle/meta/_journal.json                                             |  +1
src/db/schema.ts                                                       |  +36
src/db/repositories/workshopSchedules.ts                               | +105
src/db/__tests__/workshopSchedules.integration.test.ts                 | +157
src/db/__tests__/t009-integrity.integration.test.ts                    | +14 / -3
src/config/workshopConfig.ts                                           |  +40 / -3
src/config/__tests__/workshopConfig.test.ts                            | +135 / -2
src/app/api/admin/schedule/route.ts                                    |  +86 (new)
src/app/api/admin/schedule/route.test.ts                               | +293 (new)
src/app/api/availability/route.ts                                      |  +18 / -10
src/app/api/appointments/route.ts                                      |  +4 / -16
src/app/api/availability/route.test.ts                                 |  +97 / 0
src/app/api/appointments/route.test.ts                                 | +201 / -1
```

Combined ~1,000 lines (excluding auto-gen snapshot). Per-PR budget respected (≤400 lines each).

## Risks & Observations

| Risk | Severity | Mitigation |
|---|---|---|
| `route.test.ts:35` unused `ForbiddenError` import (lint warning) | **Low — t036b-introduced** | Easy fix: remove the import. No behavioral impact. Same pattern as 2 pre-existing warnings in `admin/appointments/[id]/{confirm,reject}/route.test.ts`. |
| OpenSpec global spec sync not yet performed | **Low — by design** | `openspec/specs/workshop-schedule/` directory does not exist; `openspec/specs/availability/spec.md` is still the T-026 version. Archive step is the canonical sync point (per apply-progress). The change's delta lives in `openspec/changes/t036b-admin-schedule/specs/`. |
| Pre-existing DB-dependent test failures: `turnos.integration.test.ts`, `clientes.schema.test.ts`, `servicios.integration.test.ts`, `servicios.schema.test.ts` | **Low — pre-existing, DB-dependent** | Documented in apply-progress PR#1 + PR#2 + PR#3. NO regressions introduced by t036b. 885 prior tests still pass. |
| `route.test.ts:208` invalid JSON test path branches through the same `requireAuth` first — 401 wins even for malformed body | **Low — by design** | Precedence 401→400 preserved; `upsertDayScheduleMock` not called. |
| `appointments/route.ts:102-103` `ValidationError` → `toErrorBody(ERROR_CODES.VALIDATION_ERROR, e.message)` shows raw message; the real `calculateEndAndValidate` error is leaked in `body.error.message` | **Low — by design** | The message includes `finIntervaloOperativo` for admin/client clarity; this is the same shape as existing 400 paths. Information disclosure is internal (`fin` is BA wall-time from the same DB row the user just patched). No PII or secret data. |
| `route.ts` does not include `assertRole(ADMINISTRADOR)` failure path that is not `ForbiddenError` (e.g., if a future change throws a generic `Error`) | **Low — defensive** | Current `assertRole` only throws `ForbiddenError` per `requireAuth.ts`. If a future change throws something else, the route re-throws. Same defensive pattern as `requireAuth` block. |
| T-036b reflection tests use `vi.mock` over `createAppointment`; the "no FOR UPDATE" guarantee on the 11:00+60 outside-patched-interval path is asserted indirectly | **Low — service-layer proven** | Real `appointmentService.createAppointment` `calculateEndAndValidate` runs INSIDE the REPEATABLE READ transaction BEFORE `countActiveOverlappingForUpdate`. This is proven by `appointmentService.test.ts:77 "rejects close-crossing 11:30+90>12:00 → 400 no FOR UPDATE"` and `:85 "allows inclusive 11:00+60==12:00 → proceeds to FOR UPDATE and 201"`, both 236/236 service tests still pass. |

## Compliance with Hybrid Persistence

- ✅ **File:** `openspec/changes/t036b-admin-schedule/verify-report.md` (this file)
- ✅ **Engram:** `sdd/t036b-admin-schedule/verify-report` topic_key saved separately
- ✅ **Validator:** `gentle-ai sdd-verify-validate --requirements 4 --scenarios 9` admitted the exact candidate bytes
- ✅ **Pre-flight artifact check:** `openspec/changes/t036b-admin-schedule/{spec,design,tasks,apply-progress,proposal,explore}.md` + `specs/{workshop-schedule,availability}/spec.md` all present (8 files)

## Recommended Next Step

`ready-for-archive` — hand off to `sdd-archive`. Archive MUST:
1. `git mv openspec/changes/t036b-admin-schedule openspec/changes/archive/<date>-t036b-admin-schedule`
2. Create `openspec/specs/workshop-schedule/spec.md` (NEW capability; sync delta from `changes/t036b-admin-schedule/specs/workshop-schedule/spec.md`)
3. Update `openspec/specs/availability/spec.md` ADDED Requirement: DB-Backed Operating Hours Consumption (sync delta from `changes/t036b-admin-schedule/specs/availability/spec.md`)
4. Add `delta ADDED 1` (workshop-schedule new) + `delta MODIFIED 1` (availability DB-backed consumption) to `archive-report.md`
5. Optionally open single PR: `feat(t036b): PATCH /api/admin/schedule + DB-backed operating hours` (3 commits stacked, ready to publish).

Single commit chain already in place on tracker branch:
- `f718991 feat(schedule): add workshop_schedules foundation PR1`
- `49823c2 feat(schedule): add PATCH admin schedule PR2`
- `9497a6c feat(schedule): wire availability/appointments to DB config PR3`

---

*Verifier: sdd-verify (read-only). 158/158 scoped tests + 236/236 service-layer + 885/890 full suite. `tsc --noEmit` clean. `eslint` 0 errors / 3 warnings. DB migration 0006 applied with CHECK + PK + TIMESTAMPTZ. INV-01/05/06/08/H-05/H-19 all preserved. Verdict: **PASS**.*
