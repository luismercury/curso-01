# Exploration: t036b-admin-schedule — PATCH /api/admin/schedule (H-05)

## Current State

**WorkshopConfig is a frozen constant, not a persisted table.**

- `src/config/workshopConfig.ts` (75L): `workshopConfig = Object.freeze(workshopConfigSchema.parse({}))` with `capacityPerSlot=1`, `slotStepMinutes=30`, `timezone="America/Argentina/Buenos_Aires"`, `operatingHours?: WeeklySchedule` (Partial Record 0..6). Schema enforces `capacity>=1`, `slotStep %5`, and `operatingHours` keys 0-6 via `validateIntervals` superRefine. `WORKSHOP_TIMEZONE` re-exported. Comment documents future provider `getWorkshopConfig(db): Promise<WorkshopConfig>` for T-036b — not yet implemented.
- `src/config/workshopSchedule.ts` (106L): Pure helpers. `DEFAULT_OPERATING_INTERVALS = [{09:00-12:00},{14:00-18:00}]`. `validateIntervals` enforces `start<end`, `00:00-24:00` bounds, sorted-by-start and `prev.end <= curr.start` (adjacent 12:00 allowed, overlap 11:30-14:00 rejected, unsorted rejected). Throws `ValidationError {code:VALIDATION_ERROR}`. `getOperatingIntervalsForDate(date,config)` derives BA dow via `Intl.DateTimeFormat(en-CA, {timeZone})` → `Date.UTC(...).getUTCDay()` (no host `getDay()`), returns `operatingHours[dow]` override or Mon-Fri fallback `DEFAULT_OPERATING_INTERVALS` or `[]` closed (Sat/Sun). DST-safe.
- `src/db/schema.ts` (213L): Tables `clientes`, `vehiculos`, `servicios`, `turnos`, `users`. **No `workshop_config` / `workshop_schedule` table.** Migration `drizzle/0004_graceful_james_howlett.sql` adds `EXCLUDE USING gist (tstzrange...) WHERE estado IN ('PENDIENTE','CONFIRMADO')`, `drizzle/0005_silly_rhino.sql` adds `users`. `_journal.json` has idx 0..5 linear, no index 6 yet.
- `src/services/availability/*`: `slotGenerator.ts` (139L) `generateSlotsForDate` loops `generateSlotsForDate step=slotStepMinutes`, `baWallTimeToUtcDate` via Intl delta (handles DST), filters via `calculateEndAndValidate` inclusive `end <= intervalEnd` (11:00+60==12:00 valid, 11:30+90==13:00 rejected). `duration.ts` (201L) single `durationSchema 30..120 %5`, `findContainingInterval`, `calculateEndAndValidate`, `parseIsoToUtc`. `availabilityService.ts` (157L) pure `getAvailableSlots` + async `getAvailableSlotsForDate` bulk `fetchActiveTurnos` once via `getBaDayUtcRange`. Pure DI config `{timezone, slotStepMinutes, capacityPerSlot, operatingHours}` — already future-proof.
- `src/app/api/availability/route.ts` (128L): Requires `requireAuth` before parse, validates `date YYYY-MM-DD` + `serviceId uuid`, resolves `BaDayUtcRange` + overflow check, guards `dto.active`, builds `config` directly from frozen `workshopConfig` import (not DB), delegates to `getAvailableSlotsForDate`. Presentation via `formatSlotsAsHHmm(..., timezone)`.
- `src/services/appointmentService.ts` (276L): `createAppointment` inside `REPEATABLE READ` transaction with H-13 order `assertOwnership -> servicio.active -> calculateEndAndValidate (inclusive <= finIntervaloOperativo)` before `countActiveOverlappingForUpdate` vs `capacityPerSlot`. Correctly fails `VALIDATION_ERROR` before FOR UPDATE. No dependency on persisted schedule beyond DI config.
- `src/app/api/admin/*`: Exists `GET /api/admin/appointments/route.ts` (81L) pattern — `requireAuth` + `assertRole(ADMINISTRADOR)` → 401/403 via `toErrorBody`, parses `parseAppointmentQuery`, builds DI config from `workshopConfig`. **No `src/app/api/admin/schedule/route.ts` exists.** Grep for `admin/schedule` yields zero hits outside specs.
- `middleware.ts` (41L): Edge JWT via `jose.jwtVerify` for `/api/*` except `GET /api/services` public and `/api/auth/*`. Returns 401 for missing/invalid token; does NOT enforce role — role is checked in route handlers via `requireAuth`/`assertRole` (defense in depth). T-036b must follow `services/[id]/route.ts` pattern: `requireAuth` then `assertRole(ADMINISTRADOR)` before any parse/DB.
- `src/lib/auth/requireAuth.ts` (91L), `src/lib/http/errors.ts` (93L): Standard envelope `{error:{code,message,issues?}}` with `VALIDATION_ERROR→400`, `FORBIDDEN→403`. Existing admin routes reuse this correctly.
- `Technical-spec.md §6.3.1 / §8.9` (verified L358-400, L676-701): Defines `WorkshopConfig {capacityPerSlot, slotStepMinutes, timezone, horarioOperativo}` as constant/future table, `PATCH /api/admin/schedule {dayOfWeek 0-6, openIntervals [{start,end}]}` ADMIN-only, validates `dayOfWeek 0-6, openIntervals no solapados, start<end, 00:00-24:00`, persists to `WorkshopConfig.horarioOperativo` (future `workshop_schedule`), invalidates cache, affects `GET /api/availability` and `fechaHoraFin <= finIntervaloOperativo`. Example intervals `09:00-12:00/14:00-18:00` must remain parametrizable, not hard-coded.
- `openspec/specs/availability/spec.md` (84L): Delta T-026 locks EC-02 empty [] `200`, capacity/overlap, duration filtering, closing boundary `11:30+90` excluded — no schedule-mutation requirement yet. `openspec/specs/appointment/spec.md` covers T-027/T-028 atomics. `openspec/changes/archive` shows T-036 (admin pending query) and T-037 (daily agenda) archived 2026-08-31 — no spec delta for schedule modification yet.
- `implementation-plan.md §10 T-036b` (L1096-1113): Depends on T-035 (role ADMIN) and T-019b (WorkshopConfig capacity/step/timezone). Must validate before T-037/T-038 admin chain.

**Gap:** Every invariant needed for T-036b is already proven in pure helpers/tests (`workshopSchedule.test.ts` 13 tests pass overlapping/sorted/start>=end/weeklySchema superRefine, `workshopConfig.test.ts` 16 tests DI/frozen). What is missing is **persistence** and the **route** that mutates it — currently any `operatingHours` override only lives until process restart (in-memory parse), and `GET /api/availability` reads the frozen default.

## Affected Areas

- `src/config/workshopConfig.ts` — DI interface + schema + frozen constant; add async provider `getWorkshopConfig(db)` and cache/invalidation hook, keep frozen fallback for cold start. No importers should switch off DI.
- `src/config/workshopSchedule.ts` — helpers stay pure; may add `WorkshopScheduleInput` type `{dayOfWeek:0..6, openIntervals:TimeInterval[]}` for route reuse (no logic change). Already implements validation required for T-036b.
- `src/db/schema.ts` + `drizzle/*` — new persisted shape. Minimal: `workshop_schedules` table `(day_of_week int 0..6 PK, open_intervals jsonb NOT NULL, updated_at TIMESTAMPTZ)` or single-row `workshop_config` with `operating_hours jsonb`. Requires migration `0006_*.sql` + `_journal.json` bump idx 6, PG `CHECK (day_of_week BETWEEN 0 AND 6)` optional. Choice impacts API payload (per-day PATCH vs full week).
- `src/db/repositories/workshopSchedules.ts` (new) — `getWorkshopConfig(db)`, `upsertDaySchedule(db, dayOfWeek, intervals)`, mapping snake_case DB `day_of_week, open_intervals` ↔ camelCase DTO. Must not leak hard-coded defaults.
- `src/app/api/admin/schedule/route.ts` (new) — `PATCH` only: `requireAuth`→`assertRole(ADMINISTRADOR)` before parse; `z.object({dayOfWeek: z.number().int().min(0).max(6), openIntervals: z.array(z.object({start:HH:mm,end:HH:mm}))).strict().superRefine(validateIntervals)` → 400 `VALIDATION_ERROR`; on success persist via repo + return `200 {dayOfWeek, openIntervals}`. Support `GET` optional for verification (not required but helps `GET /api/availability` reflect). Errors: unauth →401, non-ADMIN →403 `FORBIDDEN`, invalid intervals (solapados/start>=end/out-of-bounds) →400 `VALIDATION_ERROR`. No body mutation on failure.
- `src/app/api/availability/route.ts` — replace `workshopConfig` direct import with `await getWorkshopConfig(db)` (DI to `getAvailableSlotsForDate`). Must keep same 200 shape `{date, availableSlots}`; ensure no caching prevents reflecting updated schedule (currently no cache — safe, but if added later needs invalidation).
- `src/services/appointmentService.ts` — `createAppointment` already DI `Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">`; caller `src/app/api/appointments/route.ts` must also switch from frozen `workshopConfig` to `getWorkshopConfig(db)` so `fechaHoraFin <= finIntervaloOperativo` honors the patched schedule. T-022 `finIntervaloOperativo` validation depth is here.
- `src/services/availability/slotGenerator.ts` / `duration.ts` / `availabilityService.ts` — no change needed; already honor `config.operatingHours`. Verifies `T-021/T-022` loop `slotStart=step`, filter `end<=intervalEnd`.
- `middleware.ts` — no change (auth stays edge 401; role gating stays in route). T-036b must not add middleware role check (keep pattern of existing admin routes).
- `tests` — add route tests: `PATCH without ADMIN →403`, invalid intervals `400`, success → `GET /api/availability` reflects, creation outside new interval → `400 VALIDATION_ERROR`, finIntervaloOperativo shift affects slot list. Existing `workshopSchedule.test.ts` / `slotGenerator.test.ts` (9621L) / `t026-availability-critical.test.ts` (10092L) remain green.
- `openspec/*` — new delta spec `availability/schedule` or `workshop` for H-05; tasks must include migration, provider, route, availability integration, and edge-case validation.

## Approaches

### Approach A — DB-backed `workshop_schedules` table + PATCH persisted (RECOMMENDED)

Persist per-day JSONB intervals in PostgreSQL; `PATCH /api/admin/schedule` upserts one `dayOfWeek` row; `GET /api/availability` and `createAppointment` read via `getWorkshopConfig(db)` that merges rows into `WeeklySchedule` with fallback defaults.

- Pros: Honors INV-01/05 parametrizable not hard-coded; survives restart/replicas; audit-friendly; matches Technical-spec "futura tabla workshop_schedule parametrizable"; supports future full-week PUT without redesign; tests can truncate/seed; no file-system permissions on Vercel; cache invalidation is just next DB read.
- Cons: Requires migration (idx 6) + repository + `getWorkshopConfig` wiring in 2 routes; DB read adds ~5ms per availability call (negligible; can memoize per-request, not globally).
- Effort: Medium (1 migration + 1 repo file ~80L + 1 route ~70L + 2 call-site swaps).
- Validation: `validateIntervals` reused both in Zod superRefine and before DB write (defense in depth). Admin guard via `assertRole`. Invalid payload never reaches DB.
- Concurrency: No race on schedule — single admin writer; last write wins is acceptable. Availability reads are snapshot consistent per request. No need for advisory lock.

### Approach B — In-memory / file-backed config update (no migration)

Keep `workshopConfig` mutable module singleton (remove `Object.freeze`) or write JSON to `data/workshop.json`; `PATCH` mutates singleton/file and `GET /api/availability` reads it.

- Pros: No migration; quickest demo (single file write); tests trivially mock.
- Cons: **Violates persistence contract** — restart wipes change; violates Technical-spec "persistiendo en WorkshopConfig.horarioOperativo" interpreted as durable; breaks INV-01 future configurability; Vercel runtime is ephemeral/readonly filesystem → file approach fails in production; mutable singleton breaks `Object.isFrozen` invariant proven by 3 tests and would require weakening DI discipline; multi-instance deploys diverge.
- Effort: Low (30L route + mutate import).
- Risk: Would require rework to Approach A before launch; tech debt from day one.

### Approach C — Env-only (reject as non-solution)

Define `WORKSHOP_SCHEDULE` env var JSON; PATCH returns 501 or is not implemented.

- Pros: None for user story.
- Cons: Fails functional requirement "Modificar la disponibilidad general del taller" (Functional §6.2, H-05); no runtime mutation; admin cannot change schedule without redeploy; violates Technical-spec §8.9 contract `PATCH /api/admin/schedule → 200`. Rejected outright.
- Effort: N/A.

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| A — DB-backed | durable, spec-aligned, parametrizable, Vercel-safe, auditable | migration + repo + 2 call sites | Medium |
| B — in-memory/file | fast, no DB change | ephemeral, spec-violating, multi-instance divergence, breaks frozen invariant | Low (but debt) |
| C — env-only | zero code | fails H-05/PATCH contract | N/A |

## Recommendation

**Approach A** — `workshop_schedules` table (`day_of_week PK, open_intervals jsonb, updated_at TIMESTAMPTZ`) with `getWorkshopConfig(db)` provider.

Rationale:
1. **Spec and invariant alignment:** Technical-spec §6.3.1 and §8.9 explicitly call `WorkshopConfig.horarioOperativo` parametrizable via future table `workshop_schedule` and forbid hard-coding `09:00-12:00/14:00-18:00` example. Only A preserves that without encoding defaults in route logic. Tests (`workshopConfig.test.ts`) already prove intervals must be DI-param, not imported global.
2. **Minimal blast radius:** Pure helpers (`validateIntervals`, `getOperatingIntervalsForDate`, `calculateEndAndValidate`, `generateSlotsForDate`) require zero change. Only the provider and two consumers (`availability/route.ts`, `appointments/route.ts`) change, keeping slot/overlap/duration logic frozen.
3. **Testing parity:** Achieves required test matrix with real DB isolation (truncation + upsert) matching existing T-009 integrity pattern. B would force mocking the frozen singleton, breaking existing `Object.isFrozen` assertion.
4. **Future-proof:** Adding `GET /api/admin/schedule` or `PUT` full-week is a query reuse, whereas B locks into file permission workarounds.

Implementation slice:
- Migration `0006_workshop_schedule` (jsonb intervals, PK day_of_week).
- `src/db/repositories/workshopSchedules.ts` (getAll → WeeklySchedule, upsert).
- `src/app/api/admin/schedule/route.ts` PATCH (+ optional GET).
- Swap `availability/route.ts` and `appointments/route.ts` to `getWorkshopConfig(db)`.

## Risks

- **Validation bypass (solapados, start>=end):** If `PATCH` uses only Zod `.regex` without `validateIntervals` superRefine, overlapping `[{09:00-12:00},{11:30-14:00}]` or `12:00-09:00` would persist and break `generateSlotsForDate` (producing duplicate/negative slots). Mitigate: reuse `validateIntervals` in both Zod superRefine and pre-persist guard; unit-test the 3 rejected cases from `workshopSchedule.test.ts`.
- **Auth bypass (CLIENTE patch):** Forgetting `assertRole(ADMINISTRADOR)` before parse or relying solely on edge `middleware` would let CLIENTE mutate schedule (route would return 200 instead of 403 `FORBIDDEN`). Mitigate: copy `services/[id]/route.ts` guard order `requireAuth → assertRole` before `await req.json()`, add 403 test for CLIENTE token.
- **Stale view (GET /api/availability not reflecting):** If availability route caches `workshopConfig` at module load or via `next/cache`, patched schedule never appears. Current code has no cache (safe), but introducing global `let cachedConfig` would reintroduce it. Mitigate: always `await getWorkshopConfig(db)` per request; add post-PATCH `GET /api/availability` asserts new slots / missing old slots.
- **Slot generation break (duración + cierre):** Narrowing intervals after patch could make `finIntervaloOperativo` earlier, causing `createAppointment` previously valid slot to fail `calculateEndAndValidate` inclusive check (`11:00+60==12:00` was valid, new close 11:30 rejects it). Must ensure error surfaces as `400 VALIDATION_ERROR`, not `500`, and that slot list shrinking is tested per `T-021/T-022` table (`30→14,60→12,90→10,120→8` before, fewer after).
- **Hard-code regression (INV-05/06):** Reintroducing literal `09:00-12:00/14:00-18:00` in route fallback or `DEFAULT_OPERATING_INTERVALS` override logic would violate INV-05 parametrizable and cause divergent behavior across environments. Mitigate: defaults live in `workshopSchedule.ts` constant only; route/repository never re-defines them.
- **Timezone drift (INV-06):** Schedule intervals are BA wall-time; `baWallTimeToUtcDate` DST offset via `Intl` must be used when validating `fechaHoraFin <= finIntervaloOperativo`. Naive UTC comparison without BA conversion would reject/allow wrong slots near DST transitions. No new code should bypass `calculateEndAndValidate`.
- **Migration/journal drift:** Adding `workshop_schedules` without bumping `_journal.json` idx 6 or forgetting `CREATE EXTENSION` dependency would leave `drizzle:push` out of sync and fail T-009 journal linearized check. Mitigate: generate migration via `drizzle-kit generate` and assert idx uniqueness.
- **Atomicity not needed but audit needed:** Schedule update is non-capacity (no EXCLUDE), but audit `updated_at` helps debugging. No EXCLUDE constraint required.

## Ready for Proposal

Yes — scope is bounded to persistence + single PATCH route + two consumer swaps; no open product questions remain. `dayOfWeek 0-6 + openIntervals` contract is fully defined in Technical-spec §8.9 and `implementation-plan.md T-036b`; validation rules are implemented in `workshopSchedule.ts` and require no new design decisions. Proceed to `sdd-propose` to lock proposal, then `sdd-spec` delta for H-05 requirement, `sdd-design` for DB shape + route guard ordering.

Next: `sdd-propose` with change `t036b-admin-schedule` (hybrid, feature-branch-chain, review budget 400 lines).
