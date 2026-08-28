# Exploration: t031-reject-appointment — Reject Appointment (RN-07) PATCH /api/appointments/{id}/reject

## Current State

**T-031 scope (implementation-plan.md:951-973):** Expose `PATCH /api/appointments/{id}/reject` that transitions `PENDIENTE → RECHAZADO` via `canTransition(PENDIENTE, RECHAZADO, ADMINISTRADOR)` (RN-07/INV-02). Only role `ADMINISTRADOR` may execute; invalid transition → `409 INVALID_APPOINTMENT_STATE`. Dependencies `T-027` (AppointmentService) and `T-035` (role guards) are DONE. T-031 is **route layer only** — service already owns the transition. Mirror of T-030 `confirm` but for `RECHAZADO`.

**What exists today (verified on disk 2026-08-28):**

- **Domain machine (INV-02/RN-07):** `src/domain/appointmentStateMachine.ts` owns `AppointmentStatus = PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` (`z.enum`, no `COMPLETADO`), `TRANSITIONS` map, `canTransition(from,to,role,opts)` and `isTerminal`. Relevant entry:
  ```ts
  PENDIENTE: { CONFIRMADO: ["ADMINISTRADOR"], RECHAZADO: ["ADMINISTRADOR"], CANCELADO: ["CLIENTE","ADMINISTRADOR"] }
  RECHAZADO: {} // terminal, no outgoing
  ```
  `canTransition("PENDIENTE","RECHAZADO","ADMINISTRADOR") === true`, `CLIENTE === false`. Pure, zero DB imports — covered by `src/domain/__tests__/appointmentStateMachine.test.ts` (6 valid cases include `PENDIENTE→RECHAZADO ADMINISTRADOR`, role-gated deny for `CLIENTE`, terminal blocks).

- **Service (thin orchestrator, T-027+T-028):** `src/services/appointmentService.ts` exports `rejectAppointment(deps,id,authUser)` alongside `confirmAppointment`, `cancelAppointment`, `createAppointment`, `getAppointmentById`, `listAppointments`. Implementation is production-ready and tested:
  ```ts
  export async function rejectAppointment(deps, id, authUser): Promise<TurnoDTO> {
    const turno = await loadOr404(deps, id);          // uuid check + 404
    const now = getNow(deps);                          // injected clock or new Date()
    ensureFuture(now, turno.startDateTime);            // now >= start → InvalidAppointmentStateError "El turno ya comenzó"
    if (!canTransition(turno.status, "RECHAZADO", authUser.role))
      throw new InvalidAppointmentStateError(`Cannot transition ${turno.status} -> RECHAZADO as ${authUser.role}`);
    return updateTurnoStatus(deps.db, id, "RECHAZADO"); // → toTurnoDTO camelCase
  }
  ```
  `loadOr404` validates UUID via `z.string().uuid()` and throws `AppointmentNotFoundError` (404). `ensureFuture` throws `InvalidAppointmentStateError` when `now >= startDateTime`. Covered by `src/services/__tests__/appointmentService.test.ts` — `describe("confirm/reject R1")` table includes `reject ADMIN allowed / CLIENTE denied → INVALID_APPOINTMENT_STATE`. No `assertOwnership` — intentional: admin can reject any cliente's pendiente (mirrors confirm).

- **HTTP surface (reusable pattern):** `src/app/api/appointments/[id]/confirm/route.ts` is the exact template to copy (82 LOC). Pattern:
  ```
  1. requireAuth(req) → UnauthorizedError 401 / assertRole(ADMINISTRADOR) → ForbiddenError 403  (auth before validation)
  2. uuidSchema.parse(params.id) → ZodError 400 VALIDATION_ERROR + issues
  3. DI config Pick<workshopConfig, timezone|operatingHours|capacityPerSlot> (INV-01/06 parametrizable)
  4. await confirmAppointment({db, config}, id, authUser) → mapped: AppointmentNotFoundError 404, InvalidAppointmentStateError 409
  5. return NextResponse.json(dto, {status: 200}) — TurnoDTO camelCase, no snake leak
  ```
  `route.test.ts` for confirm proves the test harness: `vi.mock("@/services/appointmentService")` with `confirmAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`, table for `401 before 400`, `403 CLIENTE`, `400 malformed UUID`, `404 unknown`, `409 wrong state / terminal / now>=start`, `200` DTO + INV-08 + DI config assertions. No `src/app/api/appointments/[id]/reject/route.ts` exists yet — confirmed `Test-Path False`.

- **Error catalog (§12):** `src/lib/http/errors.ts` has `ERROR_CODES.INVALID_APPOINTMENT_STATE → 409`, `APPOINTMENT_NOT_FOUND → 404`, `FORBIDDEN → 403`, `UNAUTHORIZED → 401`, `VALIDATION_ERROR → 400`, `APPOINTMENT_NOT_AVAILABLE → 409` (not used by reject) and helpers `toErrorBody`/`toValidationError` producing `{error:{code,message,issues?}}`. `src/services/errors.ts` has `InvalidAppointmentStateError`, `AppointmentNotFoundError`. No new error type needed.

- **Auth helpers:** `src/lib/auth/requireAuth.ts` exports `requireAuth`, `assertRole`, `assertOwnership` + `UnauthorizedError`/`ForbiddenError`. `src/lib/auth/roles.ts` exports `UserRole.ADMINISTRADOR`. `middleware.ts` 401-guards `/api/*` (public only `GET /api/services` + `POST /api/auth/*`). `PATCH /api/services/[id]` is precedent for `ADMINISTRADOR` guard order.

- **Invariants locked:** INV-02 (states), INV-03 (Auth.js httpOnly JWT, `assertRole`), INV-06 (`TIMESTAMPTZ` UTC, `WorkshopConfig.timezone = America/Argentina/Buenos_Aires`, UTC `getTime()` compare), INV-08 (`toTurnoDTO` camelCase — no `estado`/`fecha_hora_inicio` leak). INV-04/INV-01/INV-05 (capacity/FOR UPDATE/slotStep) are T-028 booking concerns and **not** touched by reject (single-row `UPDATE`).

### Affected Areas

- `src/app/api/appointments/[id]/reject/route.ts` — **NEW, sole code change.** Thin `PATCH` handler: `requireAuth` → `assertRole(ADMINISTRADOR)` → `uuidSchema.parse(params.id)` → `rejectAppointment({db, config}, id, authUser)` → `200 TurnoDTO`. Maps `AppointmentNotFoundError→404`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE`, `ForbiddenError→403`, `UnauthorizedError→401`, `ZodError→400 VALIDATION_ERROR`. No body (reject is idempotent, no payload). Must use `server-only` and `NextResponse.json`. Exact mirror of `confirm/route.ts` with `RECHAZADO` in place of `CONFIRMADO`.

- `src/services/appointmentService.ts#rejectAppointment` — **CONSUME, do not modify.** Already implements full business path (`loadOr404 → ensureFuture → canTransition → updateTurnoStatus`). T-031 reuses `deps: {db, config, now?}` (clock injection for tests). No new service logic.

- `src/domain/appointmentStateMachine.ts` — **CONSUME, do not modify.** Route indirectly consumes via service. No direct import needed in route.

- `src/db/repositories/turnos.ts#updateTurnoStatus` — **CONSUME.** Thin `UPDATE turnos SET estado, updatedAt RETURNING` → `toTurnoDTO`. No capacity logic, no `FOR UPDATE`.

- `src/lib/auth/requireAuth.ts` (`requireAuth`, `assertRole`) — **REUSE** for auth/role guard pattern. Must test `401 before 400` precedence.

- `src/lib/http/errors.ts` (`ERROR_CODES`, `toErrorBody`, `toValidationError`, `STATUS_BY_CODE`) — **REUSE** for envelope `{error:{code,message,issues?}}`.

- `src/config/workshopConfig.ts` — **READ-ONLY DI** (`workshopConfig.timezone/operatingHours/capacityPerSlot` passed to service; reject does not need capacity but deps shape requires it — same as confirm).

- `src/app/api/appointments/[id]/reject/route.test.ts` — **NEW.** Mirrors `confirm/route.test.ts` pattern: mocked `requireAuth` + `rejectAppointment`, table for `401/403/404/409/200`, `400` on invalid UUID, DTO no snake leak, `ADMIN` vs `CLIENTE` role, `now>=start` → 409 `"El turno ya comenzó"`.

- `openspec/specs/appointment/spec.md` — **READ-ONLY.** Existing `State Transition Matrix` requirement and T-030 `Confirm Appointment` requirement already cover confirm; T-031 delta will add parallel `Reject Appointment` requirement (mirror with `RECHAZADO`).

- `middleware.ts` — **READ-ONLY.** Already 401-guards `/api/appointments/*`; no change but verify matcher covers `PATCH`.

### Approaches

1. **Copy-paste confirm route, s/confirm/reject — mirror pattern (recommended)**

   Create `src/app/api/appointments/[id]/reject/route.ts` by duplicating `confirm/route.ts` and replacing `confirmAppointment` import/call with `rejectAppointment` and DTO status `RECHAZADO`. Route does `requireAuth → assertRole(ADMINISTRADOR)` explicitly before delegating; service `canTransition` remains defense-in-depth for state/time checks.

   - Pros: Lowest risk — T-030 pattern is already archived and tested (exploration/design/verify 2026-08-28). Correct HTTP semantics: `CLIENTE → 403 FORBIDDEN` (via `assertRole`), `PENDIENTE→RECHAZADO` wrong state → `409 INVALID_APPOINTMENT_STATE`, `now>=start → 409 "El turno ya comenzó"`. Keeps route thin (no DB logic) and `AppointmentService` as single owner per `Technical-spec §4.5/H-19`. Future `cancel` stays independent. Under 400-line budget (route ~80 LOC + test ~240 LOC). Trivial review.
   - Cons: ~15 lines duplicated between `confirm` and `reject` routes (auth/uuid/config/error mapping identical). Minor DRY violation.
   - Effort: Low (route ~55-80 LOC + test; 1-2 hours).

2. **Shared helper extracted — `withAdminTransition(handler)`**

   Extract `src/app/api/appointments/[id]/_helpers/transitionRoute.ts` that factors `requireAuth → assertRole → uuid → toErrorBody` and takes a `serviceFn: (deps,id,authUser)=>Promise<TurnoDTO>` argument. Both `confirm/route.ts` and `reject/route.ts` delegate to `createTransitionRoute(confirmAppointment)` / `createTransitionRoute(rejectAppointment)`.

   - Pros: DRY — eliminates duplication of auth/uuid/error mapping. Single fix if envelope changes.
   - Cons: Premature abstraction for only 2 routes (3 with `cancel` which has different ownership/time semantics — `cancel` needs `assertOwnership` branching, so helper would need options/flags). Adds indirection for reviewers; `cancel` would not fit cleanly (owner vs admin). Hides `server-only` boundary per route. Increases blast radius: bug in helper breaks both routes. Current `confirm` route already shipped without helper — retrofitting would churn T-030 archive.
   - Effort: Medium (helper + refactor confirm + new reject + tests for helper edge cases).

3. **Direct repo route bypassing service (service not reused)**

   Route loads `findTurnoById`, checks `turno.estado`, does `updateTurnoStatus` directly with inline `if (role !== ADMINISTRADOR) throw ForbiddenError` and `if (turno.status !== "PENDIENTE") throw InvalidAppointmentStateError`.

   - Pros: Fewest imports; no service DI.
   - Cons: Duplicates RN-07 matrix and `now < start` logic outside `AppointmentService` — violates `Technical-spec §4.5` ownership ("AppointmentService is single owner of transitions; admin module delegates"). Diverges from `appointmentService.test.ts` coverage; future matrix change requires two fixes. Loses `server-only` service guarantees. High regression risk; rejected by T-027/T-030 explorations (Approach 3 negative value).
   - Effort: Low but **negative value** (creates tech debt).

### Recommendation

**Adopt Approach 1: Copy-paste thin `PATCH /api/appointments/[id]/reject/route.ts` delegating to `rejectAppointment` with explicit `assertRole(ADMINISTRADOR)` before delegation.**

Why:

- **Contract fidelity:** `Technical-spec §8.7 / Functional-spec FL-02b / implementation-plan.md T-031` require "solo ADMINISTRADOR". HTTP must return `403 FORBIDDEN` for role violation (not `409`). Service's `canTransition(PENDIENTE, RECHAZADO, CLIENTE) → false → InvalidAppointmentStateError → 409` would be semantically wrong from HTTP layer; explicit `assertRole` fixes semantics while service remains safety net for state/time checks (defense-in-depth).
- **Single-owner preservation:** `AppointmentService` stays sole owner of `canTransition` + `now < start` + `404`/`409` mapping per `Technical-spec §4.5/H-19`. Route does zero business logic beyond auth, UUID validation, and error mapping — identical shape to `POST /api/appointments` and `PATCH /api/services/[id]` and to shipped `confirm` route.
- **Error mapping table (T-031 must implement):**
  | Source | HTTP | Code |
  |---|---|---|
  | `requireAuth` missing/invalid | 401 | `UNAUTHORIZED` |
  | `assertRole` fails (CLIENTE) | 403 | `FORBIDDEN` |
  | `z.string().uuid().parse(id)` fails | 400 | `VALIDATION_ERROR` (+ `issues`) |
  | `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` |
  | `InvalidAppointmentStateError` (wrong state `CONFIRMADO/RECHAZADO/CANCELADO`, `now>=start`, terminal) | 409 | `INVALID_APPOINTMENT_STATE` (`"El turno ya comenzó"` when time guard fires) |
  | Success | 200 | `TurnoDTO` camelCase (`status: "RECHAZADO"`, no `estado`) |
  | (no `409 APPOINTMENT_NOT_AVAILABLE` — not a capacity endpoint) |
- **Idempotency:** `PATCH` is idempotent-safe by returning `409` on second reject (`RECHAZADO→RECHAZADO` not allowed via `isTerminal`). No retry loop needed. If strict idempotency `200` on already-`RECHAZADO` were desired, it would violate RN-07; keep `409`.
- **File layout (delta for T-031):**
  ```
  src/app/api/appointments/[id]/reject/route.ts      # NEW — thin PATCH, mirror of confirm/route.ts
  src/app/api/appointments/[id]/reject/route.test.ts # NEW — mocked service/auth, table-driven
  --- reused unchanged ---
  src/services/appointmentService.ts#rejectAppointment  # existing, tested
  src/domain/appointmentStateMachine.ts#canTransition   # existing
  src/db/repositories/turnos.ts#updateTurnoStatus       # existing
  ```
- **Test parity:** Route test mirrors `confirm/route.test.ts` exactly with `RECHAZADO` strings: `vi.mock("@/services/appointmentService")` with `rejectAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`, cases `401` (UnauthorizedError), `403` (CLIENTE role), `400` (invalid UUID / empty id with `issues`), `404` (missing turno), `409` (terminal `RECHAZADO/CANCELADO`/`CONFIRMADO→RECHAZADO` / `now>=start`), `200` DTO camelCase + no snake leak + DI `config.timezone/capacityPerSlot` passing. Also `401 takes precedence over 400` case.
- **Future DRY:** If `cancel` (T-032) diverges further (ownership branch), revisit shared helper in T-032 explore; do not prematurely abstract now.

### Risks

- **Conflating `403` vs `409` if role check is only in service** — Mitigated by explicit `assertRole(ADMINISTRADOR)` in route; audit that route returns `403` before service is called. Security tests (`T-053/T-038`) must assert `PATCH /reject` as `CLIENTE → 403`, not `409`. Service's `canTransition` remains safety net but must not be sole gate for HTTP 403.
- **UUID validation before auth (order matters)** — Must be `requireAuth` → `assertRole` → `uuidSchema.parse(params.id)` → service, per `confirm/route.ts` precedent and `POST /api/appointments` (`401` before `400`). Reversing leaks info to unauthenticated callers; test `401` with malformed UUID still returns `401`, not `400`.
- **`now < startDateTime` timezone pitfall** — Service compares UTC `getTime()` only (INV-06). Route does **not** inject `now`; service injects `deps.now ?? new Date()`. Do not call `new Date()` in route. `rejectAppointment` reuses same `ensureFuture` as `confirm`; already tested for `08:59 allow / 09:00:00 reject / 09:00:01 reject` equivalence — but confirm tests cover it; add reject `now>=start → "El turno ya comenzó"` case in route test via mocked service rejection.
- **`[id]` dynamic segment naming** — Next.js App Router requires `src/app/api/appointments/[id]/reject/route.ts` with `context: { params: Promise<{ id: string }> }`. Using `[...id]` or `[appointmentId]` mismatches file system but `Technical-spec §8.7` param name is internal; keep `[id]` for consistency with `confirm` and `services/[id]` and `customers/[id]`.
- **Leaking `snake_case`/Spanish DB names** — Route returns `TurnoDTO` via service → `toTurnoDTO` already enforces INV-08. Test must assert response has `customerId/vehicleId/serviceId/startDateTime/endDateTime/status/createdAt/updatedAt` and no `cliente_id/vehiculo_id/servicio_id/fecha_hora_inicio/estado`.
- **Middleware 401 body shape mismatch** — `middleware.ts` returns `{code:"UNAUTHORIZED", message}` (no `error` wrapper) while `toErrorBody` returns `{error:{code,message}}` (§12). T-031 must use `toErrorBody` shape; middleware is defense-in-depth only. Mock `requireAuth` to throw `UnauthorizedError` → route maps via `toErrorBody` (as confirm does).
- **Scope creep into capacity/concurrency** — Reject is single-row `UPDATE`, no `SELECT FOR UPDATE` or `EXCLUDE` handling. Do not add `capacityPerSlot` or `tstzrange` logic; that belongs to T-028 booking only. Review must reject any `FOR UPDATE`/`REPEATABLE READ` strings in T-031 diff.
- **Duplicate state machine in route** — Route must not reimplement `if (turno.status !== "PENDIENTE")` — delegate to `canTransition` via service. Enforce via code review + grep `canTransition` appears only in `appointmentStateMachine.ts` + `appointmentService.ts`.
- **Copy-paste drift** — Future change to error envelope (e.g., adding `correlationId`) would need two edits. Acceptable for 2 routes; add a `// Mirror of confirm/route.ts — keep in sync` comment and, if T-032 adds a third transition route, reconsider shared helper.

### Ready for Proposal

Yes — **Ready.** Scope is bounded to a single thin route + test reusing proven service domain, invariants understood, and HTTP semantics clarified (`403` vs `409`). Service `rejectAppointment` is implemented and unit-tested; route is pure delegation mirror of T-030 `confirm` (shipped 2026-08-28). No open questions.

Next phase is `sdd-propose` to lock route contract (`PATCH /api/appointments/{id}/reject`, auth `ADMINISTRADOR`, params `id: uuid`, request no body, responses `200 TurnoDTO RECHAZADO | 400 | 401 | 403 | 404 | 409`, envelope `{error:{code,message}}`), then `sdd-spec` delta for `appointment` domain (reject requirement GWT), then `sdd-design` (sequence `middleware → requireAuth → assertRole → uuid → rejectAppointment → toTurnoDTO`), then `sdd-tasks`.

No clarification needed. `WorkshopConfig` frozen, `Auth` guards ready, `AppointmentStateMachine` is single source of truth. T-031 must not touch atomic booking or `COMPLETADO`.
