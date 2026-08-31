# Tasks: t038-permission-tests — Permission Traceability Suite (FASE 7 T-038)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 (1 test file, 0 prod) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | One auditable permission suite: 4 GWT + 2 precedence + 1 defense | PR 1 (single) | `pnpm vitest run src/app/api/__tests__/t038-permission.test.ts` | N/A — mocked `server-only`/`@/db`/`@/services/appointmentService`/`@/lib/auth/requireAuth`; no docker/DB/JWT | `rm src/app/api/__tests__/t038-permission.test.ts`; 0 prod to undo |

Threat matrix: N/A (pure vitest, no shell/subprocess/VCS boundary). No RED threat tests required.

Spec traces mapped: T1 CLIENTE 403 confirm notCalled | T2 CLIENTE 403 admin limit=101 | T3 ADMIN 200 confirm CONFIRMADO INV-08 | T4 ADMIN 200 agenda ?date pagination | T5 401→403→400 | T6 defense direct service CLIENTE→409.

## Phase 1: Test File Scaffold + 4 GWT (H-19 + INV-03 + RN-07 + INV-08)

- [x] 1.1 Create `src/app/api/__tests__/t038-permission.test.ts` with mocks: `vi.mock("server-only")`, `vi.mock("@/db", () => ({ db: {} }))`, `vi.mock("@/services/appointmentService")` with `vi.importActual` spread + `confirmAppointmentMock`/`listAppointmentsMock`, `vi.mock("@/lib/auth/requireAuth")` spread + `requireAuthMock`; import `ForbiddenError`/`UnauthorizedError`, `PATCH` from confirm route, `GET` from admin route; fixtures `ADMIN`/`CLIENTE`, `VALID_UUID`, `MALFORMED_UUID`
- [x] 1.2 T1 `CLIENTE cannot confirm` — `requireAuthMock→CLIENTE`+`VALID_UUID`; assert `403 FORBIDDEN`, `confirmAppointmentMock` `not.toHaveBeenCalled()`
- [x] 1.3 T2 `CLIENTE cannot list admin agenda` — `?limit=101`; `requireAuthMock→CLIENTE`; assert `403 FORBIDDEN`, `listAppointmentsMock` `not.toHaveBeenCalled()` (proves 403 not 400)
- [x] 1.4 T3 `ADMIN can confirm` — `ADMIN`+`VALID_UUID`; `confirmAppointmentMock` resolves `TurnoDTO status:"CONFIRMADO"`; assert `200`, DTO has `customerId/vehicleId/serviceId/startDateTime/endDateTime/status:"CONFIRMADO"`; negative `not.toHaveProperty("estado"||"fecha_hora_inicio"||"cliente_id")` (INV-08)
- [x] 1.5 T4 `ADMIN agenda ?date` — `?date=2026-09-10`; `listAppointmentsMock` resolves `{data:[dto],pagination:{page:1,limit:20,total:1,totalPages:1}}`; assert `200`, `listMock` called with `role:"ADMINISTRADOR"`+`date:"2026-09-10"`+`sort:"asc"`, INV-08 no snake leak

## Phase 2: Precedence T5 + Defense-in-Depth T6

- [x] 2.1 T5a `precedence unauth + malformed UUID → 401` — `requireAuthMock` rejects `UnauthorizedError`; `MALFORMED_UUID`; assert `401 UNAUTHORIZED`, both service mocks not called
- [x] 2.2 T5b `precedence CLIENTE + limit=101 → 403` — `requireAuthMock→CLIENTE`; `?limit=101`; assert `403 FORBIDDEN` (role before validation), `listMock` not called.
- [x] 2.3 T5c `precedence ADMIN + limit=101 → 400` — `requireAuthMock→ADMIN`; `?limit=101`; assert `400 VALIDATION_ERROR` with `issues`; `listMock` not called
- [x] 2.4 T6 `defense-in-depth direct service CLIENTE → 409` — import real `canTransition` from `@/domain/appointmentStateMachine` (NOT mocked); `canTransition("PENDIENTE","CONFIRMADO","CLIENTE")===false`; assert route-only `403` vs service-layer `409 INVALID_APPOINTMENT_STATE` distinction (RN-07)

## Phase 3: Verification (pure, no DB)

- [x] 3.1 `pnpm vitest run src/app/api/__tests__/t038-permission.test.ts` — **8/8 PASS** (T1..T6 + T5a/b/c); zero regression on T-030/T-033/T-036 suites (885→893 in full suite, +8)
- [x] 3.2 `pnpm typecheck` (`tsc --noEmit`) — clean; DTO camelCase + `Promise<{id:string}>` params typecheck
- [x] 3.3 `pnpm lint` (eslint) — clean on new test file; 1 pre-existing `prefer-const` error in `src/lib/http/appointmentQuery.ts:55` unrelated to this change (0 prod LOC invariant)
- [x] 3.4 `git diff --stat` — only `src/app/api/__tests__/t038-permission.test.ts` + this `tasks.md`; **0 prod LOC** (confirm `src/app/api/appointments/[id]/confirm/route.ts`, `src/app/api/admin/appointments/route.ts`, `src/services/appointmentService.ts`, `src/lib/auth/requireAuth.ts` untouched)
- [x] 3.5 Header anchor comment citing delta NONE + T-030/T-036 harness source (H-19 trace)