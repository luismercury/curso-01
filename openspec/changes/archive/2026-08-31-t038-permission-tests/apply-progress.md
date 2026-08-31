# Apply Progress — t038-permission-tests

## Status: done — ready for commit

## Phase 1: Test File Scaffold + 4 GWT (H-19 + INV-03 + RN-07 + INV-08) — DONE

- [x] 1.1 Created `src/app/api/__tests__/t038-permission.test.ts` (1 new dir + 1 file). Harness copied from t030 (`confirm/route.test.ts`) and t036 (`admin/appointments/route.test.ts`): `vi.mock("server-only")`, `vi.mock("@/db")`, `vi.mock("@/services/appointmentService")` with `confirmAppointmentMock`/`listAppointmentsMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`. Imports `PATCH` from confirm route + `GET` from admin route + **real** `canTransition` from `@/domain/appointmentStateMachine` (NOT mocked, used by T6).
- [x] 1.2 T1 — `CLIENTE PATCH .../confirm → 403 FORBIDDEN + confirmAppointmentMock.not.toHaveBeenCalled()`
- [x] 1.3 T2 — `CLIENTE GET /api/admin/appointments?limit=101 → 403 FORBIDDEN + listAppointmentsMock.not.toHaveBeenCalled()` (proves 403 before 400)
- [x] 1.4 T3 — `ADMIN PATCH .../confirm → 200 + INV-08 (status/customerId/vehicleId/serviceId/startDateTime/endDateTime; not estado/fecha_hora_*) + confirmAppointmentMock called with VALID_UUID + ADMIN`
- [x] 1.5 T4 — `ADMIN agenda ?date=2026-09-10 → 200 + pagination + listAppointmentsMock called with role:ADMINISTRADOR + date:2026-09-10 + sort:startAt:asc + INV-08 no snake leak`

## Phase 2: Precedence T5 + Defense-in-Depth T6 — DONE

- [x] 2.1 T5a — `precedence: unauth + malformed UUID → 401 UNAUTHORIZED` (auth before validation)
- [x] 2.2 T5b — `precedence: CLIENTE + limit=101 on admin → 403 FORBIDDEN` (role before validation)
- [x] 2.3 T5c — `precedence: ADMIN + limit=101 → 400 VALIDATION_ERROR with issues` (validation runs last)
- [x] 2.4 T6 — `defense-in-depth: canTransition(PENDIENTE,CONFIRMADO,CLIENTE)===false` proves route 403 vs service 409 distinction (RN-07 matrix, terminal states always false)

## Phase 3: Verification (pure, no DB) — DONE

- [x] 3.1 `pnpm vitest run src/app/api/__tests__/t038-permission.test.ts` — **8/8 PASS** in 2.16s
- [x] 3.2 Full suite regression: `pnpm vitest run` → **893 passed | 3 failed | 2 skipped** (was 885, +8 new). 4 pre-existing DB/env failures (`db/__tests__/clientes.schema.test.ts`, `db/__tests__/servicios.integration.test.ts`, `db/__tests__/servicios.schema.test.ts`) unchanged — unrelated to T-038.
- [x] 3.3 `pnpm tsc --noEmit` — 0 errors
- [x] 3.4 `pnpm lint src/app/api/__tests__/t038-permission.test.ts` — 0 warnings, 0 errors on new file. Full repo lint has 1 pre-existing `prefer-const` error in `src/lib/http/appointmentQuery.ts:55` (not introduced here; 0 prod LOC invariant preserved).
- [x] 3.5 `git diff --stat` — only `src/app/api/__tests__/t038-permission.test.ts` (new) + this `tasks.md`. Zero prod files touched.
- [x] 3.6 Header anchor in test file cites delta NONE + T-030/T-036 harness source

## Constraints Verified

- **0 prod LOC**: route.ts/service.ts/auth.ts unchanged — verified via `git status` showing only untracked new files.
- **H-19 single-owner**: T1/T2/T5a/T5b assert `service not called` on 403/401, proving route `assertRole` runs before service.
- **INV-03 auth (401→403→400)**: T5a (401 wins over 400), T5b (403 wins over 400), T5c (validation last → 400).
- **RN-07 canTransition**: T6 imports real `canTransition` (not mocked) and asserts matrix returns `false` for `CLIENTE → CONFIRMADO` and `true` for `ADMINISTRADOR → CONFIRMADO`. Cross-checks terminal states (`RECHAZADO/CANCELADO → CONFIRMADO → false`).
- **INV-08 DTO camelCase**: T3 + T4 negative-assert `estado`/`fecha_hora_inicio`/`fecha_hora_fin`/`cliente_id`/`vehiculo_id`/`servicio_id` are NOT present.
- **No DB / no JWT / no docker**: pure vitest, harness mocks all boundaries.

## Workload Forecast (updated)

| Field | Original | Actual |
|-------|----------|--------|
| Estimated changed lines | ~120 (1 test file, 0 prod) | **289 lines** (test file) + 4 task ticks (delta +1 diff stat) |
| 400-line budget risk | Low | Low (289 << 400) |
| Chained PRs recommended | No | No (single PR) |

Forecast deviation note: original ~120 was optimistic; actual 289 reflects 8 tests with full DTO+INV-08 assertions per GWT, plus 3-line harness preamble and `void ForbiddenError` suppress for parity with t030/t036. Still single PR, well under budget.

## Files Modified

- `src/app/api/__tests__/t038-permission.test.ts` — **+289 lines (new)** — single file with 8 tests
- `openspec/changes/t038-permission-tests/tasks.md` — all checkboxes ticked + verification deltas
- `openspec/changes/t038-permission-tests/apply-progress.md` — this file (hybrid)

## New Tests (8 total)

1. `T1 — CLIENTE PATCH .../confirm → 403 FORBIDDEN + service not called`
2. `T2 — CLIENTE GET /api/admin/appointments?limit=101 → 403 + service not called`
3. `T3 — ADMIN PATCH .../confirm → 200 TurnoDTO camelCase + service called with id+ADMIN`
4. `T4 — ADMIN agenda ?date=YYYY-MM-DD → 200 ordered asc + BA half-open passthrough`
5. `T5a — precedence: unauth + malformed UUID → 401 UNAUTHORIZED (auth before validation)`
6. `T5b — precedence: CLIENTE + limit=101 on admin → 403 (role before validation)`
7. `T5c — precedence: ADMIN + limit=101 → 400 VALIDATION_ERROR (validation runs last)`
8. `T6 — defense-in-depth: canTransition(PENDIENTE,CONFIRMADO,CLIENTE) === false (RN-07 matrix)`