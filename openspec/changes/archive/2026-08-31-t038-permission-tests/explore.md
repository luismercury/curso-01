# Exploration: t038-permission-tests (FASE 7 T-038 — Crear tests de permisos H-19)

## Current State

### Routes — auth guards already enforce 403/401 correctly (thin, single-owner)
- `src/app/api/appointments/[id]/confirm/route.ts` (82L): `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema → confirmAppointment({db,config}, id, authUser) → 200 TurnoDTO`. Precedence `401 UnauthorizedError before 400`, `403 ForbiddenError` before service. DI `workshopConfig` (timezone, operatingHours, capacityPerSlot) per INV-01/06. Maps `AppointmentNotFound→404`, `InvalidAppointmentState→409`.
- `src/app/api/appointments/[id]/reject/route.ts` (84L): Mirror of confirm, same guard order `requireAuth→assertRole(ADMIN)→uuid→rejectAppointment`. No body, no capacity/FOR UPDATE.
- `src/app/api/admin/appointments/route.ts` (81L): `requireAuth → assertRole("ADMINISTRADOR") → parseAppointmentQuery(raw) → listAppointments({db,config,now}, parsed, authUser) → 200 {data,pagination}`. Order `401→403→400` — `CLIENTE` on admin returns `403` before `400` even with `limit=101` (proven by existing test `CLIENTE with invalid limit still 403`). Query `date=YYYY-MM-DD` BA half-open via `getBaDayUtcRange`, `includeCancelled/includeRejected` default false (H-11).
- `src/app/api/appointments/route.ts` (167L): Client query `GET /api/appointments` — `requireAuth → parseAppointmentQuery → listAppointments({db,config,now}, parsed, authUser)` with `customerId=authUser.id` injection for `CLIENTE` inside service (so route test only verifies `authUser` passthrough, not the injection itself). `POST` also `requireAuth` before parse.

### Auth layer — T-035 DONE, precedent verified
- `src/lib/auth/requireAuth.ts` (91L): `requireAuth(req)` verifies JWT via `jose.jwtVerify` (reads `authjs.session-token` / `__Secure-authjs.session-token` from `req.cookies.get` or `cookie` header), throws `UnauthorizedError(401)` for missing/invalid, `ForbiddenError(403)` for `assertRole`/`assertOwnership`. `assertRole(user, ADMINISTRADOR)` throws `403` if role mismatch; `assertOwnership` bypasses for `ADMINISTRADOR`. Edge `middleware.ts` does 401 early; route re-verifies defense-in-depth (documented in file header).
- `src/lib/auth/roles.ts`: `UserRole = {CLIENTE, ADMINISTRADOR}`, `userRoleSchema = z.enum([...])`.
- `src/lib/auth/__tests__/requireAuth.test.ts` (114L): 401 no cookie, 401 invalid token, valid token returns `authUser`, `__Secure-` fallback, `assertOwnership` 403 non-owner / ADMIN bypass, `assertRole` 403 vs pass.
- `src/domain/appointmentStateMachine.ts` (79L): Pure `TRANSITIONS` map, `canTransition(from,to,role,opts?)` with `isTerminal` guard and optional `to==CANCELADO && opts.now && opts.startDateTime` strict `<` via `getTime()` (INV-06). Matrix: `PENDIENTE→CONFIRMADO|RECHAZADO` only `ADMINISTRADOR`; `PENDIENTE|CONFIRMADO→CANCELADO` `CLIENTE|ADMINISTRADOR` if `now<start`.

### Service — single owner (H-19)
- `src/services/appointmentService.ts` (276L): `confirmAppointment`/`rejectAppointment` call `loadOr404` → `ensureFuture(now, startDateTime)` → `canTransition(status, CONFIRMADO|RECHAZADO, role)` → `updateTurnoStatus`. `confirm`/`reject` have **no** `assertOwnership` (admin can act on any cliente's `PENDIENTE`); `cancelAppointment` owns `assertOwnership → ensureFuture → canTransition(...,CANCELADO,{now,start}) → updateTurnoStatus`. `listAppointments` injects `customerId=authUser.id` if `CLIENTE`, injects `now` if missing, delegates to `findTurnosPaginated`. `createAppointment` enforces `assertOwnership → servicio.active → calculateEndAndValidate inclusive <= → FOR UPDATE count < capacity` (H-13 order, not relevant to T-038 but proves `ADMIN` bypass via `assertOwnership`).

### Existing tests — 4 T-038 scenarios SCATTERED, not consolidated
- `src/app/api/appointments/[id]/confirm/route.test.ts` (243L, 13 tests):
  - `401 UNAUTHORIZED when requireAuth rejects before UUID validation` ✅
  - `401 takes precedence over 400 — unauthenticated with malformed UUID still 401` ✅ (401→400)
  - `403 FORBIDDEN when CLIENTE role via assertRole and service not called` ✅ — **covers T-038 scenario 1** (`PATCH .../confirm → 403` for CLIENTE). Asserts `confirmAppointmentMock.not.toHaveBeenCalled()`.
  - `200 returns TurnoDTO camelCase with status CONFIRMADO on ADMIN + PENDIENTE future` ✅ — **covers T-038 scenario 3** (`PATCH .../confirm → 200 CONFIRMADO` for ADMIN).
  - Also `400 malformed UUID`, `404 not found`, `409 wrong state` ×3, `409 now>=start "El turno ya comenzó"`, `INV-08 no snake leak`, `DI config timezone/capacity`.

- `src/app/api/admin/appointments/route.test.ts` (165L, 13 tests):
  - `ADMIN 200 sees all` ✅ — **covers T-038 scenario 4** (`GET /api/admin/appointments?date=... → 200` for ADMIN, with `listMock` called and `role=ADMINISTRADOR`).
  - `CLIENTE =>403` ✅ — **covers T-038 scenario 2** (`GET /api/admin/appointments → 403` for CLIENTE, `listMock.not.toHaveBeenCalled()`).
  - `unauth 401`, `401 before 400`, `400 on bad query`, `CLIENTE with invalid limit still 403` (403→400 precedence), `pending precedence — 401→403→400 with status=PENDIENTE&limit=101` (all three), `agenda ?date=` variants, `INV-08` etc. All via `vi.mock("@/services/appointmentService")` + `vi.mock("@/lib/auth/requireAuth")`.

- `src/app/api/appointments/route.test.ts` (575L): `GET /api/appointments` CLIENTE `200 envelope + customerId injection` (verifies route passes `CLIENTE` authUser to service, which injects `customerId`), `401 before 400`, `agenda ?date=` scoped etc. Proves CLIENTE cannot see admin agenda except via own route (implicit, not `403`).

- `src/services/__tests__/appointmentService.test.ts` (304L): `describe("confirm/reject R1")` table — `confirm ADMIN allowed`, `confirm CLIENTE denied → INVALID_APPOINTMENT_STATE 409`, `reject ADMIN allowed`, `reject CLIENTE denied → 409`. **Direct service bypass** — shows `canTransition` is defense-in-depth, but route's `assertRole → 403` is the correct HTTP semantic. If T-038 only tested service, it would assert `409` not `403` — conflation risk documented in `t030/t031 explore.md`.

- `src/domain/__tests__/appointmentStateMachine.test.ts` (207L) + `src/domain/__tests__/t034.lifecycle.matrix.test.ts` (200L): Exhaustive 32-cell matrix `canTransition` (6 true / 26 false), time guard strict `<`, `isTerminal`, `COMPLETADO` rejection. Ownership `ADMIN bypass` in `requireAuth.test.ts`.

- `src/lib/http/appointmentQuery.test.ts` (61L): Validates `status=CANCELADO requires includeCancelled`, `limit 101 → 400`, `date vs from/to` etc. Used by both client and admin query routes.

### Audit grep — scattered coverage, no dedicated file
- Grep for `CLIENTE.*403.*confirm`, `ADMIN.*200.*confirm`, `CLIENTE.*403.*admin.*appointments`, `ADMIN.*200.*agenda` finds hits in `confirm/route.test.ts:106` (`403 FORBIDDEN when CLIENTE role via assertRole`) and `admin/appointments/route.test.ts:29` (`CLIENTE =>403`) and `admin/appointments/route.test.ts:23` (`ADMIN 200 sees all`), but **no single file** containing all four assertions together. `openspec/changes/archive/2026-08-28-t030-confirm-appointment/verify-report.md:91` and `openspec/specs/appointment/spec.md:178-182,218-222,409` define the required GWT, but `t038` change folder does not yet exist (`openspec/changes` only has `archive/*`). Conclusion: **gap is partial — behavior exists, traceability does not**. `implementation-plan.md:1140` Depends on `T-035`; `t036`/`t037` archives prove `requireAuth→assertRole` pattern but `t038` has no dedicated evidence file.

### What is already safe to reuse
- Mock harness pattern proven: `vi.mock("server-only")`, `vi.mock("@/db")`, `vi.mock("@/services/appointmentService")` with `listMock`/`confirmAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `authMock/requireAuthMock`. `makePatchRequest(id)` helper and `ADMIN`/`CLIENTE` fixtures with UUID `550e8400-...` are copy-pasteable.
- Error envelope `src/lib/http/errors.ts` (`toErrorBody`, `toValidationError`, `ERROR_CODES.FORBIDDEN→403`, `UNAUTHORIZED→401`, `VALIDATION_ERROR→400`, `INVALID_APPOINTMENT_STATE→409`) already used consistently.
- `canTransition` pure unit already at `≥80%` critical rules (`npm run test:coverage` would show `appointmentStateMachine` covered), but **route permission coverage is integration, not unit** — needs `401→403→400` precedence tests.

## Affected Areas

- `src/lib/auth/requireAuth.ts` — guards `requireAuth`, `assertRole`, `assertOwnership`; `ADMINISTRADOR` bypass; 401/403 error classes. No change needed, but permission suite must assert its contract (no JWT →401, CLIENTE on admin →403 before 400).
- `src/domain/appointmentStateMachine.ts` — RN-07 matrix `canTransition(..., ADMINISTRADOR)` for `PENDIENTE→CONFIRMADO` and `PENDIENTE→RECHAZADO`; `CONFIRMADO→CANCELADO` etc. Service-level defense-in-depth; suite should optionally prove direct service call still denies CLIENTE via `canTransition` (409) to avoid mock-hiding-matrix risk.
- `src/services/appointmentService.ts` — `confirmAppointment(id,ADMIN)` → `200 CONFIRMADO`, `rejectAppointment`, `listAppointments` with `ADMIN sees all` vs `CLIENTE injects customerId`. Single owner H-19; no duplication.
- `src/app/api/appointments/[id]/confirm/route.ts` — thin route `PATCH .../confirm` requiring `ADMINISTRADOR`; primary subject for scenario 1 + 3 (CLIENTE 403, ADMIN 200).
- `src/app/api/appointments/[id]/reject/route.ts` — same pattern (not in T-038 scope but parallel; suite may optionally extend but not required).
- `src/app/api/admin/appointments/route.ts` — thin route `GET /api/admin/appointments?date=...` requiring `ADMINISTRADOR`; subject for scenario 2 + 4 (CLIENTE 403, ADMIN 200 with `date` filter). Also `src/app/api/appointments/route.ts` `GET` as client counterpart (CLIENTE 200 own, not admin).
- `src/lib/http/appointmentQuery.ts` — shared `querySchema` (`status`, `includeCancelled`, `date`, `page/limit/offset`, `sort`); `400 VALIDATION_ERROR` for `limit=101` must be tested **after** auth (401→403→400 precedence).
- Test files needing additions:
  - **Existing scattered**: `src/app/api/appointments/[id]/confirm/route.test.ts` (already has 1 & 3), `src/app/api/admin/appointments/route.test.ts` (already has 2 & 4) — no prod change, but retain as evidence.
  - **New dedicated**: `src/app/api/__tests__/t038-permission.test.ts` **or** `tests/permissions/t038-permission.test.ts` **or** `src/app/api/appointments/[id]/confirm/route.test.ts` augmentation + `src/app/api/admin/appointments/route.test.ts` augmentation — preferred is **one dedicated file** `src/app/api/__tests__/t038-permission.test.ts` that imports both handlers (confirm + admin) and asserts all four in one place for traceability, plus `401→403` precedence and `service not called` on 403.
  - Alternative co-located: `src/app/api/appointments/[id]/confirm/t038-permission.test.ts` is less ergonomic (needs admin import). Dedicated top-level `__tests__` keeps blast radius low.
- `openspec/specs/appointment/spec.md` — already has `Requirement: Confirm Appointment` + `Reject` + `Query — Role Gating` with GWT `Forbidden — CLIENTE cannot confirm → 403` and `ADMIN 200`. T-038 does not add prod requirements; it consolidates evidence. If new dedicated suite is chosen, delta spec is `MODIFIED` (add `Requirement: Permission — T-038` with 4 GWT) or `ADDED` minimal, otherwise `NONE` if reusing existing scattered evidence.
- `openspec/changes/t038-permission-tests/*` — new change folder (proposal, spec, tasks, design) to be created; `explore.md` is this file.

## Approaches

1. **Approach A — Dedicated permission test suite `t038-permission-tests` covering 4 scenarios with mocked auth/service (RECOMMENDED)**

   Centralize traceability: one file `src/app/api/__tests__/t038-permission.test.ts` (or `tests/permissions/t038-permission.test.ts`) that:
   - Mocks `server-only`, `@/db`, `@/services/appointmentService` (`confirmAppointmentMock`, `listMock`), `@/lib/auth/requireAuth` (`requireAuthMock`).
   - Fixtures `ADMIN` (`aaaaaaaa-...`) and `CLIENTE` (`bbbbbbbb-...`) with `role` literals, `VALID_UUID`, `MALFORMED_UUID`.
   - Asserts exactly the four `implementation-plan.md:1140` GWT:
     1. `CLIENTE PATCH /api/appointments/{id}/confirm → 403 {error:{code:FORBIDDEN}}` and `confirmAppointmentMock.not.toHaveBeenCalled()` (route `assertRole` before service).
     2. `CLIENTE GET /api/admin/appointments → 403` and `listMock.not.toHaveBeenCalled()` (route `assertRole` before parse).
     3. `ADMIN PATCH .../confirm → 200 {status:"CONFIRMADO"}` with `toTurnoDTO` camelCase, `confirmAppointmentMock` called with `id` and `ADMIN`.
     4. `ADMIN GET /api/admin/appointments?date=2026-09-10 → 200 {data:[...], pagination}` with `listMock` called and `role=ADMINISTRADOR`, `date` passthrough, `INV-08` no snake leak.
   - Additionally proves `401→403→400` precedence: unauthenticated with `limit=101` → `401` not `400`; `CLIENTE` on admin with `limit=101` → `403` not `400`; `ADMIN` with `limit=101` → `400`.
   - Optionally (one extra `describe`) proves service-level `canTransition` defense-in-depth: direct `confirmAppointment({db:mock,config,now}, id, CLIENTE)` → `409 INVALID_APPOINTMENT_STATE` (not `403`) to document that route 403 is not mocked away.
   - Pros: Single traceable evidence file for `T-038` H-19 single-owner; satisfies `Done` criteria `coverage ≥80% critical rules` and `integration green` without DB; reuses proven mock harness (copy from `confirm/route.test.ts` + `admin/appointments/route.test.ts`); low blast radius (one new test file, zero prod LOC); `grep for "T-038"` or `grep for "CLIENTE.*403.*confirm"` hits one place; audit-friendly.
   - Cons: Duplicates a few lines already present in scattered files (intentional for traceability — not production duplication); adds ~120-180 LOC of test code to maintain; if `confirm` route changes signature, two files need update (mitigated by shared helper, but acceptable for audit).
   - Effort: Low (1 test file, 4-6 `it` blocks + 2 precedence blocks, ~2h including proposal/spec/tasks).
   - Aligns with `implementation-plan.md` Depends `T-035` (authorization por roles `CLIENTE|ADMINISTRADOR`, middleware `requireAuth/assertRole`) and `Technical-spec §8.6 / §11` (admin confirm, `GET /api/admin/appointments` ¿Tiene RGPD? no, pero `ADMINISTRADOR` bypass).

2. **Approach B — Rely solely on existing scattered tests (no dedicated file, but traceability weak)**

   Declare `T-038` done by pointing to `confirm/route.test.ts:106` (CLIENTE 403) + `confirm/route.test.ts:186` (ADMIN 200) + `admin/appointments/route.test.ts:29` (CLIENTE 403) + `admin/appointments/route.test.ts:23` (ADMIN 200) as evidence. Add no new file; just reference in `verify-report.md`.
   - Pros: Zero new LOC; fastest to `archive`; no duplication.
   - Cons: Fails audit grep for consolidated permission evidence — `grep` for all four in one file yields empty; weak traceability for H-19 single-owner; future `T-053` security tests would need to rediscover scattered locations; `Done` checklist `integration green` not explicitly tied to permission matrix; `sdd-verify` would flag `missing dedicated evidence`; contradicts `implementation-plan.md` intent that `T-038` is a distinct verification task.
   - Effort: Low (0 LOC, but high audit risk).
   - Verdict: Reject — preserves behavior but not the `Done` evidence contract.

3. **Approach C — E2E only (reject — not recommended)**

   Cover the four scenarios via Playwright/Cypress or `tests/integration/appointmentConcurrency.test.ts`-style with real DB, real JWT, real `POST /api/appointments` + `PATCH .../confirm` + `GET /api/admin/appointments`.
   - Pros: Exercises real `requireAuth` via `jose` and real `EXCLUDE`/`FOR UPDATE` path, not mocked.
   - Cons: Needs DB, `AUTH_SECRET` (≥32 chars), seeded `ADMIN` vs `CLIENTE`, `pg` container; flaky in CI; slow; does not isolate `403` vs `409` semantics (both would be HTTP, but harder to assert `service not called`); overkill for permission matrix that is pure authz; duplicates `T-060` concurrency E2E scope; `coverage ≥80%` would still need unit mocks anyway.
   - Effort: High (DB setup, seed, JWT sign, cleanup, ~6-8h).
   - Verdict: Reject for T-038; defer E2E to `T-053`/`T-060`.

## Recommendation

**Approach A — Dedicated permission test suite** is the correct choice for `T-038`.

Why:
- `Current State` proves the four behaviors already work (route `assertRole` before service, `401→403→400` precedence, `ADMIN 200` with `toTurnoDTO` camelCase, `CLIENTE 403` with `service not called`), but they are **scattered** across two files and invisible to a `t038` grep. `T-038`'s purpose is not to implement new prod code — it's to make H-19 single-owner auditable.
- A single file `src/app/api/__tests__/t038-permission.test.ts` (or `tests/permissions/t038-permission.test.ts` if repo prefers `tests/` isolation) gives the `Done` criteria a direct pointer: `coverage ≥80% critical rules` (role matrix) and `integration green` (mocked route tests). It reuses the exact harness already proven in `t030`/`t036` archives, so implementation risk is near zero.
- It avoids prod duplication (zero prod LOC) and preserves `AppointmentService` as sole owner — routes stay thin. It also documents the `403` vs `409` invariant: route `assertRole` → `403 FORBIDDEN`, service `canTransition` → `409 INVALID_APPOINTMENT_STATE` as safety net. This distinction is what `T-053` security tests will extend.
- It directly satisfies the four `T-038` GWT from `implementation-plan.md §10` and the audit grep the task defines (`"CLIENTE.*403.*confirm"`, `"ADMIN.*200.*confirm"`, `"CLIENTE.*403.*admin.*appointments"`, `"ADMIN.*200.*agenda"`).

Next step for `sdd-propose`:
- Minimal `openspec/changes/t038-permission-tests/proposal.md` with `change: t038-permission-tests`, `why: consolidate H-19 permission evidence`, `scope: 1 test file, 0 prod LOC, delta spec MODIFIED (add Requirement: Permission — T-038 with 4 GWT) or NONE if reusing existing spec GWT`.
- `spec.md` delta: either `ADDED Requirement: Permission — T-038` with 4 Scenarios (Given authenticated CLIENTE/ADMIN, When `PATCH .../confirm` / `GET /api/admin/appointments`, Then `403`/`200` + `401→403→400` precedence + `service not called` on 403) referencing `src/app/api/__tests__/t038-permission.test.ts`, or `MODIFIED` to annotate existing `Confirm`/`Query — Role Gating` requirements with `t038` trace.
- `tasks.md`: 1.1 create dedicated test file (4 GWT + 2 precedence), 1.2 vitest run 30+ tests, 1.3 `pnpm tsc --noEmit` clean, 1.4 `openspec validate` + archive.

## Risks

- **401→403 precedence (no JWT 401 before 403):** If suite forgets to test unauthenticated with malformed UUID / `limit=101`, it could hide a regression where `uuidSchema` or `parseAppointmentQuery` runs before `requireAuth`. Mitigate: include `401 takes precedence over 400 — unauthenticated with malformed UUID still 401` and `401→403→400 with status=PENDIENTE&limit=101` blocks (already proven in `admin/appointments/route.test.ts:39,82` — copy them).
- **Direct service call bypassing route guard:** A test that only mocks `requireAuth` could still pass if `assertRole` is removed but `canTransition` still throws `409`. The HTTP code would be wrong (`409` not `403`). Mitigate: assert `confirmAppointmentMock.not.toHaveBeenCalled()` on `403` cases and separately prove service-level `CLIENTE → 409` in a `describe("service defense-in-depth")` block that calls `confirmAppointment` directly (not via route) — documents the two layers.
- **canTransition mock hiding real matrix:** If test mocks `appointmentService` entirely, the real `canTransition(PENDIENTE, CONFIRMADO, CLIENTE) → false` is not exercised. Mitigate: either import real `canTransition` in the defense-in-depth block, or keep one `it("ADMIN 200")` that calls through to real service with `findTurnoById` mock (as `appointmentService.test.ts` does). For the dedicated suite, the primary `403` cases should **not** reach service (so mock is correct); the `409` safety-net case should use real `canTransition`.
- **DTO leak not related but easy to regress:** If suite only checks status code, a future `toTurnoDTO` regression (snake_case `estado`) would not be caught. Mitigate: include `expect(json).toHaveProperty("status")` + `expect(json).not.toHaveProperty("estado")` in the `ADMIN 200` blocks (already in `confirm/route.test.ts:204-223` — copy).
- **Zero prod LOC drift:** `T-038` is `0 prod LOC` by design (H-19 single-owner). A future change that adds prod logic to meet coverage would violate H-19. Mitigate: `sdd-verify` must assert `0 prod LOC` (check `git diff --stat` for `src/app/api` only test file added).
- **File placement churn:** Placing the suite under `tests/` vs `src/app/api/__tests__/` changes `vitest` include globs. Mitigate: check `vitest.config.ts` `include: ["src/**/*.test.ts","tests/**/*.test.ts"]` before choosing path; both are valid per current config (see `vitest.config.ts` — needs verification).
- **OpenAPI drift:** `GET /api/admin/appointments?date=` is already in `openspec/specs/appointment/spec.md` and `docs/openapi.md`; adding a permission suite does not change contract, but `sdd-verify` should still run `npm run openapi:lint`.

## Ready for Proposal

Yes — **Ready.** Scope is bounded to one dedicated test file (zero prod LOC) plus `openspec` delta. Dependencies verified DONE on disk and in archives: `T-035` (`requireAuth`/`assertRole` with `ADMIN 200`/`CLIENTE 403` proven in `confirm/route.test.ts` and `admin/appointments/route.test.ts`), `T-030/T-031/T-033` (thin routes + `AppointmentStateMachine`), `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`. No open questions blocking proposal; open decisions have recommended resolutions (file at `src/app/api/__tests__/t038-permission.test.ts`, 4 GWT + 2 precedence + 1 defense-in-depth block, mock harness copied from existing route tests, `401→403→400` + `service not called` + `INV-08` assertions). Invariants `INV-02/03/06/08` and auth guards confirmed on current code.

*Generated: 2026-08-31 — sdd-explore for `t038-permission-tests` — hybrid artifact (Engram topic_key `sdd/t038-permission-tests/explore` + `openspec/changes/t038-permission-tests/explore.md`).*
