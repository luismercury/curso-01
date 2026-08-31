# Tasks: t036-admin-pending-query — Admin Pending Query (Informational Reuse)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~50 (2 test files + tasks.md, 0 prod LOC) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (no chain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Add pending view traceability tests + verify green | PR 1 (single, no chain) | `pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` | `pnpm vitest` + `pnpm tsc --noEmit` (mocked, no docker) | delete added `it()` blocks + revert tasks.md note |

## Phase 1: Test Naming (Traceability, H-19 Anchor)

- [x] 1.1 Add `ADMIN pending view — status=PENDIENTE 200` named test in `src/app/api/admin/appointments/route.test.ts` — asserts `listMock` receives `{status:"PENDIENTE"}` + role `ADMINISTRADOR` + `sort:"startAt:asc"` + returns `{data,pagination:{page,limit,total,totalPages}}`; H-19 cited inline (Trace 1 + pagination H-28 + INV-08 negative `not.toHaveProperty("estado")`).
- [x] 1.2 Add `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` named test in `src/app/api/admin/appointments/route.test.ts` — unauth →401 before 400; CLIENTE →403 before 400 even with `limit=101`; ADMIN with `limit=101` →400 `VALIDATION_ERROR` (Traces 3+4).
- [x] 1.3 Add `CLIENTE own pending 200 — status=PENDIENTE scopes customerId` named test in `src/app/api/appointments/route.test.ts` — asserts `listMock` receives `{status:"PENDIENTE"}` + role `CLIENTE` injects `customerId=authUser.id`; H-19 cited inline (Trace 2).

## Phase 2: Verification

- [x] 2.1 Run `pnpm vitest run src/app/api/admin/appointments/route.test.ts src/app/api/appointments/route.test.ts` — all green including new pending tests; no regression on T-033 62 tests + T-035 8 admin role tests.
- [x] 2.2 Run `pnpm tsc --noEmit` — clean, no prod type drift.
- [x] 2.3 Confirm 0 prod LOC via `git diff --stat` (only `route.test.ts` × 2 + this `tasks.md` + verify-report); confirm spec delta NONE archived without `MODIFIED` requirement per `openspec/changes/t036-admin-pending-query/spec.md`.

## Phase 3: Documentation

- [x] 3.1 Add one-line header comment in `src/app/api/admin/appointments/route.test.ts` anchoring H-19 + T-033 archive `2026-08-28` + delta NONE for future readers.
