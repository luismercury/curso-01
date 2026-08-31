# Apply Progress — t036b-admin-schedule — PR #1 Foundation COMPLETE

> Hybrid artifact — also persisted to Engram `sdd/t036b-admin-schedule/apply-progress` (auto-merged with prior progress, which was empty for this change).

## Change
`t036b-admin-schedule` — PATCH `/api/admin/schedule` (H-05). Chained PRs: PR #1 (foundation) → PR #2 (provider + PATCH route) → PR #3 (consumer swaps).

## Status
**PR #1 — DONE. Tracker branch `feature/t036b-admin-schedule` accumulating.** Awaiting PR #1 open (next slice).

## PR #1 Scope (this slice)
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
- Pre-existing failures (`clientes.schema`, `servicios.schema`, `servicios.integration`, `turnos.integration` suite) are NOT regressions — verified failing on master before this slice.

## Diff Budget
| File | Action | Lines |
|------|--------|-------|
| `drizzle/0006_workshop_schedules.sql` | new | +6 |
| `drizzle/meta/_journal.json` | modify | +7 |
| `drizzle/meta/0006_snapshot.json` | new | +555 (auto-gen snapshot) |
| `src/db/schema.ts` | modify | +36 |
| `src/db/repositories/workshopSchedules.ts` | new | +105 |
| `src/db/__tests__/workshopSchedules.integration.test.ts` | new | +157 |
| `src/db/__tests__/t009-integrity.integration.test.ts` | modify | +14 / -3 |
| **Total** | | **+880 / -3** |

Production code diff (excluding auto-gen snapshot) ≈ **154 lines**. Snapshot is auto-gen boilerplate for drizzle-kit migration tracking. PR #1 well under 400-line review budget.

## Tasks Marked [x]
Phase 1 (Foundation / PR #1): 1.1, 1.2, 1.3, 1.4, 1.5, 1.6.

## Constraints Honored
- INV-01/05: defaults live only in `workshopSchedule.ts` (`DEFAULT_OPERATING_INTERVALS`). Repo composes fallback — no literal `09:00-12:00/14:00-18:00` outside helpers.
- INV-06: `updated_at TIMESTAMPTZ` UTC; `day_of_week smallint` not date.
- No global cache — `getWorkshopConfig` reads DB per request (H-05 freshness).
- `validateIntervals` guard before upsert — overlap/start>=end never reaches DB.
- snake↔camel mapping via `rowToIntervals` — DB never leaks to API.
- `dynamic='force-dynamic'` not needed in PR #1 (no route added).

## Rollback Boundary
`git revert <commit>` + drop snapshot + drop repo + drop migration. No data loss (table empty by default). Routes unaffected (no consumer swap yet).

## Risks for PR #1
- None blocking. DB CHECK + JSONB NOT NULL + PK 0..6 verified via raw-SQL bypass.
- Snapshot must match schema.ts — verified by `pnpm db:migrate` apply success.

## Next Slice — PR #2 (Provider + PATCH Route)
- `src/config/workshopConfig.ts`: add `getWorkshopConfig(db)` async provider (currently in repo; either re-export or move to config layer — design calls for config layer).
- `src/app/api/admin/schedule/route.ts`: PATCH `requireAuth→assertRole(ADMINISTRADOR)` before parse; Zod strict + `superRefine(validateIntervals)`; 401/403/400; `dynamic='force-dynamic'`.
- Route tests: 401 no token, 403 CLIENTE no write, 400 overlap, 400 `start>=end`/unsorted, 200 ADMIN persists, idempotent repatch.
- Provider unit test (empty table → Mon-Fri defaults).

## Branch / Commit
- Branch: `feature/t036b-admin-schedule` (tracker).
- Commit: pending — see `git log -1` after commit.
