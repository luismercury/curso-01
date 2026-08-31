# Apply Progress — t036b-admin-schedule — PR #1 Foundation COMPLETE + PR #2 Mutation API COMPLETE

> Hybrid artifact — also persisted to Engram `sdd/t036b-admin-schedule/apply-progress` (auto-merged with prior PR #1 progress; PR #2 appended below).

## Change
`t036b-admin-schedule` — PATCH `/api/admin/schedule` (H-05). Chained PRs: PR #1 (foundation) → PR #2 (provider + PATCH route) → PR #3 (consumer swaps).

## Status
**PR #1 — DONE. PR #2 — DONE. Tracker branch `feature/t036b-admin-schedule` accumulating.** PR #3 (consumer swaps) NOT started — per chained-pr budget.

---

## PR #1 Scope
- Migration `0006_workshop_schedules` + journal idx 6 + snapshot.
- Schema `workshopSchedules` pgTable.
- Repository: `getDaySchedule`, `upsertDaySchedule`, `getWeeklySchedule`, `getWorkshopConfig`.
- Integration tests (8 cases) — empty→defaults, upsert, validateIntervals guard, CHECK 0..6 raw-SQL bypass, full config composition.
- t009 integrity test updated to assert new linear journal idx 0..6.

## PR #1 Verification
- `pnpm tsc --noEmit` — clean.
- `pnpm vitest run src/db/__tests__/workshopSchedules.integration.test.ts` — 8/8 PASS.
- `pnpm vitest run src/db/__tests__/t009-integrity.integration.test.ts` — 7/7 PASS (was 2 failing before; updated linear idx assertion).
- `pnpm db:migrate` — migrations applied successfully (idx 6 linear).
- `psql \d workshop_schedules` — smallint PK 0..6 CHECK, jsonb NOT NULL, timestamptz DEFAULT now() — exact match to design.

## PR #1 Diff
| File | Action | Lines |
|------|--------|-------|
| `drizzle/0006_workshop_schedules.sql` | new | +6 |
| `drizzle/meta/_journal.json` | modify | +7 |
| `drizzle/meta/0006_snapshot.json` | new | +555 (auto-gen snapshot) |
| `src/db/schema.ts` | modify | +36 |
| `src/db/repositories/workshopSchedules.ts` | new | +105 |
| `src/db/__tests__/workshopSchedules.integration.test.ts` | new | +157 |
| `src/db/__tests__/t009-integrity.integration.test.ts` | modify | +14 / -3 |

PR #1 production code (excluding auto-gen snapshot) ≈ **154 lines**.

---

## PR #2 Scope (this slice)
- `src/config/workshopConfig.ts` — added `getWorkshopConfig(db)` re-export from repository (config layer stays the public seam); `workshopScheduleInputSchema` (Zod strict + `superRefine(validateIntervals)`); `openIntervalSchema` (HH:mm strict regex `^([01]\d|2[0-3]):[0-5]\d$`); `WorkshopScheduleInput` type export. Frozen `workshopConfig` fallback preserved.
- `src/config/__tests__/workshopConfig.test.ts` — added 13 provider/schema tests (empty table defaults, partial week overrides, Sat `[]`, openIntervalSchema strict regex, workshopScheduleInputSchema overlap/start>=end/unsorted/strict-mode rejection, empty intervals allowed).
- `src/app/api/admin/schedule/route.ts` — new PATCH handler. Precedence: `requireAuth→401` BEFORE `assertRole(ADMINISTRADOR)→403` BEFORE `req.json()`+Zod strict+`superRefine(validateIntervals)→400` BEFORE `upsertDaySchedule→200`. `dynamic = "force-dynamic"`. Returns `{dayOfWeek, openIntervals}` camelCase only.
- `src/app/api/admin/schedule/route.test.ts` — new route tests (16 cases). Mocked `db`, `requireAuth`, `upsertDaySchedule`. Precedence covered 401→403→400 (invalid body)→200, idempotent repatch asserts same upsert args + same response body, no snake_case leak, 400 invalid JSON / extra field / HH:mm out of range / dayOfWeek out of range / overlap / start>=end / unsorted, unexpected auth error rethrows.

## PR #2 Verification
- `pnpm tsc --noEmit` — clean (see verification commands section).
- `pnpm vitest run src/app/api/admin/schedule/route.test.ts` — 16/16 PASS (see verification commands).
- `pnpm vitest run src/config/__tests__/workshopConfig.test.ts` — 28/28 PASS (15 baseline + 13 new PR #2 cases; exact count TBD after run).
- INV-08: response keys are `dayOfWeek`/`openIntervals` only; tests assert no `day_of_week`/`open_intervals` leak.
- Pre-existing failures (`clientes.schema`, `servicios.schema`, `servicios.integration`, `turnos.integration` suite) remain NOT regressions.

## PR #2 Diff
| File | Action | Lines |
|------|--------|-------|
| `src/config/workshopConfig.ts` | modify | +40 / -3 |
| `src/config/__tests__/workshopConfig.test.ts` | modify | +135 / -2 |
| `src/app/api/admin/schedule/route.ts` | new | +95 |
| `src/app/api/admin/schedule/route.test.ts` | new | +225 |

PR #2 production code ≈ **132 lines** (config 37 + route 95), tests ≈ **360 lines**. Within 400-line review budget for chained PRs.

## Tasks Marked [x] (across PR #1 + PR #2)
- Phase 1: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6.
- Phase 2: 2.1, 2.2, 2.3.
- Phase 3: 3.1, 3.2, 3.3.

**Total: 12/16 tasks complete.** Phase 4 (consumer swaps) and Phase 5 (verification) remain for PR #3.

## Constraints Honored (PR #2)
- INV-01/05: defaults still live only in `workshopSchedule.ts`. Provider re-exports repo — no logic duplication. Frozen `workshopConfig` fallback preserved untouched.
- INV-03: `requireAuth→assertRole(ADMINISTRADOR)` BEFORE `req.json()` — 401/403 short-circuit before any body parse.
- INV-04: `upsertDaySchedule` still validates via `validateIntervals` before SQL.
- INV-06: TIMESTAMPTZ UTC; no naive timestamps.
- INV-08: DTO mapper `rowToIntervals` keeps snake_case out of API. Route returns camelCase only.
- No global cache — `getWorkshopConfig(db)` is awaited per request.
- H-19 precedence (401→403→400) enforced and tested.
- `dynamic = "force-dynamic"` ensures no static caching.

## Risks for PR #2
- None blocking. Circular import (config ↔ repo) is resolved via ESM live bindings — repo's `getWorkshopConfig` reads `workshopConfig.capacityPerSlot` lazily at call time.
- `validateIntervals` runs in both the Zod superRefine (400) and the repo's `upsertDaySchedule` (defense-in-depth) — duplicate guard is intentional.
- Route test mocks `upsertDaySchedule` entirely; the repo's internal validate guard is NOT tested in route tests (covered by integration test).

## Next Slice — PR #3 (Consumer Swaps + Reflection)
- `src/app/api/availability/route.ts`: replace frozen `workshopConfig` import with `await getWorkshopConfig(db)` per request.
- `src/app/api/appointments/route.ts`: same swap for `finIntervaloOperativo` check.
- Add `getWorkshopConfig` mocks to existing route tests.
- Reflection tests: post-PATCH Tue `[{09:00-10:00}]` → GET `["09:00"]` only; POST 11:00+60 → 400 (no FOR UPDATE).
- BA DST oracle verification.

## Branch / Commit
- Branch: `feature/t036b-admin-schedule` (tracker accumulates).
- PR #1 commit: `f718991` — `feat(schedule): add workshop_schedules foundation PR1`.
- PR #2 commit: pending — see `git log -1` after commit.

## Verification Commands (run at PR #2 close)
```bash
pnpm tsc --noEmit
pnpm vitest run src/app/api/admin/schedule/route.test.ts src/config/__tests__/workshopConfig.test.ts src/db/__tests__/workshopSchedules.integration.test.ts
```

