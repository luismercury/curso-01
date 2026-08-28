# Exploration: t030-confirm-appointment — Confirm Appointment (RN-07) PATCH /api/appointments/{id}/confirm

## Current State

**T-030 scope (implementation-plan.md:928-949):** Expose `PATCH /api/appointments/{id}/confirm` that transitions `PENDIENTE → CONFIRMADO` via `canTransition(PENDIENTE, CONFIRMADO, ADMINISTRADOR)` (RN-07/INV-02). Only role `ADMINISTRADOR` may execute; invalid transition → `409 INVALID_APPOINTMENT_STATE`. Dependencies `T-027` (AppointmentService thin) and `T-035` (role guards) are DONE; `T-028` atomic booking (`REPEATABLE READ` + `SELECT FOR UPDATE` count < capacityPerSlot + `EXCLUDE USING gist 23P01`) is DONE. T-030 is **route layer only** — service already owns the transition.

**What exists today (verified on disk 2026-08-28):**

- **Domain machine (INV-02/RN-07):** `src/domain/appointmentStateMachine.ts` owns `AppointmentStatus = PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` (`z.enum`, no `COMPLETADO`), `TRANSITIONS` map, `canTransition(from,to,role,opts)` and `isTerminal`. `PENDIENTE→CONFIRMADO` allows only `["ADMINISTRADOR"]`; `CONFIRMADO→CANCELADO` allows `["CLIENTE","ADMINISTRADOR"]` with `now < startDateTime` guard. Pure, zero DB imports.

- **Service (thin orchestrator, T-027+T-028):** `src/services/appointmentService.ts` exports `confirmAppointment(deps,id,authUser)`, `rejectAppointment`, `cancelAppointment`, `createAppointment` (atomic TX), `getAppointmentById`, `listAppointments`. `confirmAppointment` already implements the full T-030 business path:
  ```ts
  loadOr404(id) → ensureFuture(now, turno.startDateTime) → canTransition(PENDIENTE, CONFIRMADO, role) → updateTurnoStatus(db,id,"CONFIRMADO")
  ```
  `loadOr404` validates UUID (`z.string().uuid()`) and throws `AppointmentNotFoundError` (404). `ensureFuture` throws `InvalidAppointmentStateError("El turno ya comenzó")` when `now >= startDateTime`. `updateTurnoStatus` is thin repo (`UPDATE ... RETURNING`, `toTurnoDTO`, maps 23P01 → `AppointmentNotAvailableError`). `cancelAppointment` additionally does `assertOwnership` first (spec order). `confirm/reject` do **not** need ownership — only role matrix (admin can confirm any cliente's turno).

- **HTTP surface:** `src/app/api/appointments/route.ts` (`POST /api/appointments`) is the reference thin-route pattern: `requireAuth` → JSON parse → `zod` strict body → DI `workshopConfig` → `createAppointment` → mapped errors (`APPOINTMENT_NOT_AVAILABLE 409`, `INVALID_SERVICE 400`, `VALIDATION_ERROR 400`, `FORBIDDEN 403`, `APPOINTMENT_NOT_FOUND 404`). `route.test.ts` mocks `requireAuth` + `createAppointment`, asserts `201` DTO camelCase, no `estado`/`fecha_hora_inicio` leak (INV-08), ISO-with-timezone regex, timezone `Z` and `-03:00`, `400` on naive date, `409` mapping, and DI `capacityPerSlot`/`timezone`. No `src/app/api/appointments/[id]/confirm/route.ts` exists yet (confirmed `Glob` empty for `[id]`). `middleware.ts` already protects `/api/*` (JWT `authjs.session-token` via `jose`, 401 on missing/invalid, public bypass only for `GET /api/services` and `POST /api/auth/*`). `PATCH /api/services/[id]` is the reference `ADMINISTRADOR` guard: `requireAuth` → `assertRole(user, ADMINISTRADOR)` → `uuidSchema.parse` → `zod` body → service.

- **Error catalog (§12):** `src/lib/http/errors.ts` has `ERROR_CODES.INVALID_APPOINTMENT_STATE → 409`, `APPOINTMENT_NOT_FOUND → 404`, `FORBIDDEN → 403`, `UNAUTHORIZED → 401`, `VALIDATION_ERROR → 400` and `toErrorBody`/`toValidationError` helpers. `src/services/errors.ts` has `InvalidAppointmentStateError (INVALID_APPOINTMENT_STATE)`, `AppointmentNotFoundError`, `AppointmentNotAvailableError`. Service tests in `src/services/__tests__/appointmentService.test.ts` already cover `confirm/reject R1` (ADMIN allowed, CLIENTE denied → `INVALID_APPOINTMENT_STATE`), `confirm fails when now>=start → "El turno ya comenzó"`, `unknown id → 404`.

- **Invariants locked:** INV-02 (states), INV-03 (Auth.js httpOnly JWT, `assertOwnership`/`assertRole`), INV-06 (`TIMESTAMPTZ` UTC, `WorkshopConfig.timezone`), INV-08 (`toTurnoDTO` camelCase, no snake leak). INV-04/INV-01/INV-05 belong to T-028 atomic booking and are **not** touched by T-030 (confirm is single-row `UPDATE`, no capacity count).

### Affected Areas

- `src/app/api/appointments/[id]/confirm/route.ts` — **NEW, sole code change.** Thin `PATCH` handler: `requireAuth` → `assertRole(ADMINISTRADOR)` (or delegate to service's `canTransition` — see Approaches) → `uuidSchema.parse(params.id)` → `confirmAppointment({db, config}, id, authUser)` → `200 TurnoDTO`. Maps `AppointmentNotFoundError→404`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE`, `ForbiddenError→403`, `UnauthorizedError→401`, `ZodError→400 VALIDATION_ERROR`. No body (idempotent confirm). Must use `server-only` and `NextResponse.json`.
- `src/services/appointmentService.ts` — **CONSUME, do not modify** (already implements `confirmAppointment`). T-030 reuses `deps: {db, config, now?}` (clock injection for tests). No new service logic; verify `ensureFuture` + `canTransition` ordering.
- `src/domain/appointmentStateMachine.ts` — **CONSUME, do not modify.** Route indirectly consumes via service. No direct import needed in route.
- `src/db/repositories/turnos.ts#updateTurnoStatus` — **CONSUME.** Thin `UPDATE turnos SET estado, updatedAt RETURNING` → `toTurnoDTO`. No capacity logic.
- `src/lib/auth/requireAuth.ts` (`requireAuth`, `assertRole`, `assertOwnership`) — **REUSE** for auth/role guard pattern.
- `src/lib/http/errors.ts` (`ERROR_CODES`, `toErrorBody`, `toValidationError`, `STATUS_BY_CODE`) — **REUSE** for envelope `{error:{code,message,issues?}}`.
- `src/config/workshopConfig.ts` — **READ-ONLY DI** (`workshopConfig.timezone/operatingHours/capacityPerSlot` passed to service; confirm does not need capacity but deps shape requires it).
- `src/app/api/appointments/[id]/confirm/route.test.ts` — **NEW.** Mirrors `route.test.ts` pattern: mocked `requireAuth`, `confirmAppointment`, table for `401/403/404/409/200`, `400` on invalid UUID, DTO no snake leak, `ADMIN` vs `CLIENTE` role.
- `openspec/specs/appointment/spec.md` — **READ-ONLY.** Existing `State Transition Matrix` requirement already covers confirm; T-030 delta will be route-level, not domain.
- `middleware.ts` — **READ-ONLY.** Already 401-guards `/api/appointments/*`; no change but verify matcher covers `PATCH`.

### Approaches

1. **Thin route delegating to service; role enforced in service via canTransition only**
   - Route does `requireAuth(req)` and immediately calls `confirmAppointment({db, config}, id, authUser)` with no explicit `assertRole`. Service's `canTransition(PENDIENTE, CONFIRMADO, role)` rejects `CLIENTE` → `InvalidAppointmentStateError` → route maps to `409 INVALID_APPOINTMENT_STATE`.
   - Pros: Minimal route code; single source of truth (machine) not duplicated; matches current service contract where `confirm` already gates role; easier to keep DRY when `reject`/`cancel` share same pattern.
   - Cons: `CLIENTE` attempting confirm gets `409` not `403 FORBIDDEN` — semantically wrong per §12 (role mismatch is authorization, not state). Tests in `appointmentService.test.ts` currently expect `409` for confirm CLIENTE, but HTTP spec for admin-only endpoints should be `403`. Conflates "wrong role" vs "wrong state" (e.g., `CONFIRMADO→CONFIRMADO` should be `409`, `CLIENTE` attempting any confirm should be `403`). Hides authz layer from HTTP audit/logs; `T-053` security tests expect `403` for non-admin confirm.
   - Effort: Low (route ~45 LOC + test).

2. **Thin route with explicit `assertRole(ADMINISTRADOR)` before service, then service canTransition as safety net (recommended)**
   - Route does `authUser = await requireAuth(req); assertRole(authUser, ADMINISTRADOR);` then validates UUID, then calls `confirmAppointment`. Service still runs `canTransition` as defense-in-depth (covers `PENDIENTE→CONFIRMADO` state check + `now < start`).
   - Pros: Correct HTTP semantics: `CLIENTE` → `403 FORBIDDEN` (not `409`), `PENDIENTE→CONFIRMADO` with wrong state → `409 INVALID_APPOINTMENT_STATE`, `now >= start` → `409` with `"El turno ya comenzó"`, missing id → `404`. Matches `PATCH /api/services/[id]` precedent; aligns with `T-053/T-038` permission tests ("cliente cannot confirm"); makes `x-correlation-id` audit clear which layer rejected. Idempotency friendly: second `CONFIRMADO→CONFIRMADO` hits service `canTransition` → `409` (not `200`), no double write. Keeps route thin (no DB logic) and service thin.
   - Cons: One extra line (`assertRole`) — trivial duplication but intentional defense-in-depth; need to ensure both layers agree on `ADMINISTRADOR` literal (use `UserRole.ADMINISTRADOR` enum, not string).
   - Effort: Low (route ~55 LOC + test; well under 400-line budget).

3. **Direct repo route bypassing service (service not reused)**
   - Route loads `findTurnoById`, checks `turno.estado`, does `updateTurnoStatus` directly with inline `if (role !== ADMINISTRADOR) throw ForbiddenError`.
   - Pros: Fewest imports; no service DI.
   - Cons: Duplicates RN-07 matrix and `now < start` logic outside `AppointmentService` — violates `Technical-spec §4.5` ownership ("AppointmentService is single owner of transitions; admin module delegates"). Diverges from `appointmentService.test.ts` coverage; future `reject`/`cancel` would each reimplement matrix. Loses `server-only` service guarantees (validation, DTO mapping). High regression risk; rejected by T-027 exploration (Approach 1 vs 2 analysis).
   - Effort: Low but **negative value** (creates tech debt).

### Recommendation

**Adopt Approach 2: Thin `PATCH /api/appointments/[id]/confirm/route.ts` delegating to `confirmAppointment` with explicit `assertRole(ADMINISTRADOR)` before delegation.**

Why:

- **Contract fidelity:** `Technical-spec §8.6 / Functional-spec FL-02 / implementation-plan.md T-030` require "solo ADMINISTRADOR". HTTP must return `403 FORBIDDEN` for role violation (not `409`). Service's `canTransition` alone would return `409`; explicit `assertRole` fixes semantics while service remains safety net for state/time checks.
- **Single-owner preservation:** `AppointmentService` stays sole owner of `canTransition` + `now < start` + `404`/`409` mapping per `Technical-spec §4.5/H-19`. Route does zero business logic beyond auth, UUID validation, and error mapping — same shape as `POST /api/appointments` and `PATCH /api/services/[id]`.
- **Error mapping table (T-030 must implement):**
  | Source | HTTP | Code |
  |---|---|---|
  | `requireAuth` missing/invalid | 401 | `UNAUTHORIZED` |
  | `assertRole` fails (CLIENTE) | 403 | `FORBIDDEN` |
  | `z.string().uuid().parse(id)` fails | 400 | `VALIDATION_ERROR` (+ `issues`) |
  | `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` |
  | `InvalidAppointmentStateError` (wrong state, `now>=start`, `RECHAZADO/CANCELADO` terminal) | 409 | `INVALID_APPOINTMENT_STATE` |
  | Success | 200 | `TurnoDTO` camelCase (`status`, `startDateTime`, no `estado`) |
  | (no `409 APPOINTMENT_NOT_AVAILABLE` — not a capacity endpoint) |
- **Idempotency:** `PATCH` is idempotent-safe by returning `409` on second confirm (`CONFIRMADO→CONFIRMADO` not allowed). No retry loop needed. If strict idempotency `200` on already-`CONFIRMADO` were desired, it would violate RN-07; keep `409`.
- **File layout (delta for T-030):**
  ```
  src/app/api/appointments/[id]/confirm/route.ts      # NEW — thin PATCH
  src/app/api/appointments/[id]/confirm/route.test.ts # NEW — mocked service/auth
  --- reused unchanged ---
  src/services/appointmentService.ts#confirmAppointment
  src/domain/appointmentStateMachine.ts#canTransition
  src/db/repositories/turnos.ts#updateTurnoStatus
  ```
- **Test parity:** Route test mirrors `src/app/api/appointments/route.test.ts` structure: `vi.mock("@/services/appointmentService")` with `confirmAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`, table for `401` (UnauthorizedError), `403` (CLIENTE role), `400` (invalid UUID / invalid JSON if body ever sent), `404` (missing turno), `409` (terminal/existing-CONFIRMADO/`now>=start`), `200` DTO camelCase + no snake leak + DI `config.timezone` passing.

### Risks

- **Conflating `403` vs `409` if role check is only in service** — Mitigated by explicit `assertRole` in route; audit that route returns `403` before service is called. Security tests (`T-053/T-038`) must assert `PATCH /confirm` as `CLIENTE → 403`, not `409`.
- **UUID validation before auth (order matters)** — Must be `requireAuth` → `assertRole` → `uuidSchema.parse(params.id)` → service, per `PATCH /api/services/[id]` precedent and `POST /api/appointments` (`401` before `400`). Reversing leaks info to unauthenticated callers; test `401` without valid UUID still returns `401`.
- **`now < startDateTime` timezone pitfall** — Service compares UTC `getTime()` only (INV-06). Route does **not** inject `now`; service injects `deps.now ?? new Date()`. Tests must use fake timers or `deps.now` injection; do not call `new Date()` in route. Covers `08:59 allow / 09:00:00 reject / 09:00:01 reject` via service tests already passing.
- **`[id]` dynamic segment naming** — Next.js App Router requires `src/app/api/appointments/[id]/confirm/route.ts` with `context: { params: Promise<{ id: string }> }`. Using `[...id]` or `[appointmentId]` mismatches `Technical-spec §8.6` (`{appointmentId}`) but route param name is internal; tests must match folder. Keep `[id]` for consistency with `src/app/api/services/[id]` and `src/app/api/customers/[id]`.
- **Leaking `snake_case`/Spanish DB names** — Route returns `TurnoDTO` via service → `toTurnoDTO` already enforces INV-08. Test must assert response has `customerId/vehicleId/serviceId/startDateTime/endDateTime/status/createdAt/updatedAt` and no `cliente_id/vehiculo_id/servicio_id/fecha_hora_inicio/estado`.
- **Middleware 401 body shape mismatch** — `middleware.ts` returns `{code:"UNAUTHORIZED", message}` (no `error` wrapper) while `toErrorBody` returns `{error:{code,message}}` (§12). T-030 must use `toErrorBody` shape; middleware is defense-in-depth only. Do not special-case middleware error in route tests; mock `requireAuth` to throw `UnauthorizedError` → route maps via `toErrorBody`.
- **Scope creep into capacity/concurrency** — Confirm is single-row `UPDATE`, no `SELECT FOR UPDATE` or `EXCLUDE` handling. Do not add `capacityPerSlot` or `tstzrange` logic; that belongs to T-028 booking only. Review must reject any `FOR UPDATE`/`REPEATABLE READ` strings in T-030 diff.
- **Duplicate state machine in route** — Route must not reimplement `if (turno.status !== "PENDIENTE")` — delegate to `canTransition`. Enforce via code review + `grep canTransition` appears only in `appointmentStateMachine.ts` + `appointmentService.ts`.

### Ready for Proposal

Yes — **Ready.** Scope is bounded to a single thin route + test, service domain already proven, invariants understood, and HTTP semantics clarified (`403` vs `409`). No open questions.

Next phase is `sdd-propose` to lock route contract (`PATCH /api/appointments/{id}/confirm`, auth `ADMINISTRADOR`, params `id: uuid`, request no body, responses `200 TurnoDTO | 400 | 401 | 403 | 404 | 409`, envelope `{error:{code,message}}`), then `sdd-spec` delta for `appointment` domain (confirm requirement GWT), then `sdd-design` (sequence `middleware → requireAuth → assertRole → uuid → confirmAppointment → toTurnoDTO`), then `sdd-tasks`.

No clarification needed. `WorkshopConfig` frozen, `Auth` guards ready, `AppointmentStateMachine` is single source of truth. T-030 must not touch atomic booking or `COMPLETADO`.
