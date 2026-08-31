# Tasks: t036b-admin-schedule — PATCH /api/admin/schedule (H-05)

## Review Workload Forecast

Estimated changed lines: ~520 (migration 12 + schema 15 + repo 80 + provider 25 + route 75 + swaps 30 + tests 285)
400-line budget risk: High
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
Decision needed before apply: No
Delivery strategy: auto-chain
Suggested split: PR #1 foundation → PR #2 mutation API → PR #3 reflection

### Work Units

- **PR #1 → `feature/t036b-admin-schedule`**: migration + schema + repo + journal. Test: `pnpm vitest run src/db/repositories/__tests__/workshopSchedules.integration.test.ts`. Harness: `docker compose up db && pnpm db:migrate && psql \d workshop_schedules`. Rollback: revert `drizzle/0006*` + journal + schema; rm repo.
- **PR #2 → `feature/t036b-pr1-foundation`**: provider `getWorkshopConfig(db)` + PATCH route + tests. Test: `pnpm vitest run src/app/api/admin/schedule/route.test.ts src/config/__tests__/workshopConfig.test.ts`. Harness: mocked. Rollback: rm route dir.
- **PR #3 → `feature/t036b-pr2-mutation`**: consumer swaps + reflection tests. Test: `pnpm vitest run src/app/api/availability src/app/api/appointments`. Harness: DB seed PATCH Tue then GET. Rollback: revert routes to frozen import.

## Phase 1: Foundation (PR #1)

- [x] 1.1 Generate `drizzle/0006_workshop_schedules.sql` — `day_of_week smallint PK CHECK (0..6)`, `open_intervals jsonb NOT NULL`, `updated_at timestamptz DEFAULT now()`; idx 6 in `_journal.json`.
- [x] 1.2 Add `workshopSchedules` `pgTable` to `src/db/schema.ts` — `dayOfWeek`, `openIntervals`, `updatedAt` (`$onUpdate`); export row/insert types.
- [x] 1.3 Append idx 6 to `drizzle/meta/_journal.json` (T-009 linearized).
- [x] 1.4 Create `src/db/repositories/workshopSchedules.ts` — `getWorkshopConfig(db)` merges rows + defaults Mon-Fri/Sat-Sun `[]`; `getDaySchedule`; `upsertDaySchedule`; snake↔camel; `validateIntervals` guard.
- [x] 1.5 Integration test (`skipIf(!DATABASE_URL)`) — empty→defaults, Sat/Sun `[]`; upsert jsonb round-trip; row overrides only that dow.
- [x] 1.6 Migration integrity — file asserts CHECK + PK + jsonb NOT NULL; `\d workshop_schedules` pg_constraint; idempotent.

## Phase 2: Provider (PR #2)

- [ ] 2.1 Add `getWorkshopConfig(db: DbOrTx): Promise<WorkshopConfig>` to `src/config/workshopConfig.ts` — no global cache; keep frozen fallback.
- [ ] 2.2 Reuse `validateIntervals` guard before upsert; export `WorkshopScheduleInput` type.
- [ ] 2.3 Provider unit — empty table → Mon-Fri defaults; partial week overrides that dow; Sat `[]`.

## Phase 3: PATCH Route (PR #2)

- [ ] 3.1 Create `src/app/api/admin/schedule/route.ts` — `requireAuth→assertRole(ADMINISTRADOR)` before parse; Zod strict + `superRefine(validateIntervals)`; 401/403/400/200; `dynamic='force-dynamic'`.
- [ ] 3.2 Route tests — 401 no token, 403 CLIENTE no write, 400 overlap, 400 `start>=end`/unsorted, 200 ADMIN persists, idempotent repatch.
- [ ] 3.3 No snake_case leak — `dayOfWeek`/`openIntervals` only; `error.code` envelope preserved.

## Phase 4: Consumer Swaps (PR #3)

- [ ] 4.1 Modify `availability/route.ts` — `await getWorkshopConfig(db)` for `operatingHours`; keep frozen `timezone`/`slotStepMinutes`/`capacityPerSlot`.
- [ ] 4.2 Modify `appointments/route.ts` POST + GET — same swap; `finIntervaloOperativo` honors patched.
- [ ] 4.3 Add `getWorkshopConfigMock` to both route tests; called per request.
- [ ] 4.4 Reflection — post-PATCH Tue `[{09:00-10:00}]` → GET `["09:00"]` only; POST 11:00+60 → 400 (no FOR UPDATE).
- [ ] 4.5 BA DST half-open — patched schedule near DST matches `getBaDayUtcRange` oracle.

## Phase 5: Verification (PR #3)

- [ ] 5.1 `pnpm vitest run` — all green; T-026/T-033/T-034/T-036/T-037 unchanged.
- [ ] 5.2 `pnpm tsc --noEmit` clean; `pnpm db:migrate` + `psql \d workshop_schedules` — idx 6 + CHECK + PK.
- [ ] 5.3 `git diff --stat` ±10% of forecast; one commit per work unit.