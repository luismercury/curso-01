# Exploration: t032-cancel-appointment — Cancel Appointment (RN-07) PATCH /api/appointments/{id}/cancel

## Current State

**T-032 scope (implementation-plan.md:976-995):** Expose `PATCH /api/appointments/{id}/cancel` validating `canTransition(estadoActual, CANCELADO, role)` per RN-07: `PENDIENTE->CANCELADO` and `CONFIRMADO->CANCELADO` allowed (owner CLIENTE or ADMINISTRADOR), `RECHAZADO/CANCELADO` terminal blocked, `now < fechaHoraInicio` UTC via `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` else `409 INVALID_APPOINTMENT_STATE "El turno ya comenzó"` (H-12 borders: `08:59` allow, `09:00:00` reject, `09:00:01` reject UTC). Ownership: `turno.clienteId == authUser.id` or `ADMINISTRADOR` bypass. Dependencies `T-027` (AppointmentService) and `T-051` (resource auth) DONE; T-032 is **route layer only** — service already owns transition.

**Verified on disk 2026-08-28:**

- **Domain machine (INV-02/RN-07):** `src/domain/appointmentStateMachine.ts` owns `AppointmentStatus = PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` (`z.enum`, no `COMPLETADO`), `TRANSITIONS` map:
  ```ts
  PENDIENTE: { CONFIRMADO: ["ADMINISTRADOR"], RECHAZADO: ["ADMINISTRADOR"], CANCELADO: ["CLIENTE","ADMINISTRADOR"] }
  CONFIRMADO: { CANCELADO: ["CLIENTE","ADMINISTRADOR"] }
  RECHAZADO: {} // terminal
  CANCELADO: {} // terminal
  ```
  `canTransition(from, to, role, opts?)` includes optional time guard for `CANCELADO`: when `opts.now && opts.startDateTime` provided, returns `now.getTime() < startDateTime.getTime()` (UTC, INV-06). Zero DB imports; covered by `src/domain/__tests__/appointmentStateMachine.test.ts` (6 valid cancel cases, time-guard `PENDIENTE->CANCELADO 09:00:00 reject` and `CONFIRMADO->CANCELADO 09:00:01 reject`, terminal/wrong-role denies).

- **Service (single owner, T-027):** `src/services/appointmentService.ts:215-243` exports `cancelAppointment(deps,id,authUser)` — production-ready, unit-tested:
  ```ts
  export async function cancelAppointment(deps, id, authUser) {
    const turno = await loadOr404(deps, id);              // uuid + 404 AppointmentNotFoundError
    assertOwnership(turno.customerId, authUser);           // 403 FORBIDDEN if CLIENTE non-owner; ADMIN bypass
    const now = getNow(deps);                              // injected clock or new Date() — deterministic
    ensureFuture(now, turno.startDateTime);                // now >= start → InvalidAppointmentStateError "El turno ya comenzó"
    const allowed = canTransition(turno.status, "CANCELADO", authUser.role, { now, startDateTime: turno.startDateTime });
    if (!allowed) { /* distinguishes time vs state/role */ throw InvalidAppointmentStateError }
    return updateTurnoStatus(deps.db, id, "CANCELADO");   // → toTurnoDTO camelCase
  }
  ```
  **Order is ownership-first → time guard → canTransition** (spec: "ownership before time guard"). `loadOr404` validates UUID, `getNow` supports `deps.now` injection, `ensureFuture` throws `"El turno ya comenzó"` on `now >= start` (H-12/RN-05). Covered by `src/services/__tests__/appointmentService.test.ts:224-249` — `describe("cancel R4 borders + ownership-first")`:
  - Borders: `08:59 allow / 09:00:00 reject / 09:00:01 reject` (uses `TURNO 12:00Z` and `now 11:59Z/12:00Z/12:00:01Z` UTC — maps to BA `09:00-03:00` via UTC)
  - `non-owner → FORBIDDEN before time guard` (proves ownership precedes time check; avoids timing oracle)
  - `owner and ADMIN allowed CONFIRMADO->CANCELADO future`
  - `terminal (RECHAZADO) → INVALID_APPOINTMENT_STATE`
  - Different from `confirmAppointment`/`rejectAppointment` which use `ensureFuture` then `canTransition` but **no** `assertOwnership` — they use route-level `assertRole(ADMINISTRADOR)` instead.

- **HTTP templates (reusable pattern):** `src/app/api/appointments/[id]/confirm/route.ts` (82 LOC) and `reject/route.ts` (84 LOC) are exact templates to copy. Pattern:
  ```
  1. requireAuth(req) → UnauthorizedError 401 / assertRole(ADMIN) → ForbiddenError 403 (auth before validation)
  2. uuidSchema.parse(params.id) → ZodError 400 VALIDATION_ERROR + issues
  3. DI config Pick<workshopConfig, timezone|operatingHours|capacityPerSlot> (INV-01/06 parametrizable)
  4. await confirmAppointment({db, config}, id, authUser) → maps: AppointmentNotFoundError 404, InvalidAppointmentStateError 409
  5. return NextResponse.json(dto, {status:200}) — TurnoDTO camelCase, no snake leak
  ```
  `confirm/route.test.ts` proves harness: `vi.mock("@/services/appointmentService")` with `confirmAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`, cases `401 before 400`, `403 CLIENTE`, `400 malformed UUID`, `404 unknown`, `409 wrong state / terminal / now>=start "El turno ya comenzó"`, `200` DTO + INV-08 + DI config asserts. **No** `src/app/api/appointments/[id]/cancel/route.ts` exists — `Test-Path False` confirmed. `src/app/api/appointments/[id]/confirm` and `reject` directories exist; `cancel` does not.

- **Error catalog (§12):** `src/lib/http/errors.ts` has `ERROR_CODES.INVALID_APPOINTMENT_STATE→409`, `APPOINTMENT_NOT_FOUND→404`, `FORBIDDEN→403`, `UNAUTHORIZED→401`, `VALIDATION_ERROR→400` and helpers `toErrorBody`/`toValidationError` producing `{error:{code,message,issues?}}`. `src/services/errors.ts` has `InvalidAppointmentStateError`, `AppointmentNotFoundError`. `src/lib/auth/requireAuth.ts` has `requireAuth`, `assertOwnership` (ADMIN bypass), `assertRole`, `UnauthorizedError`/`ForbiddenError`.

- **Invariants locked:** INV-02 (4 states UPPER_SNAKE, no COMPLETADO), INV-06 (`TIMESTAMPTZ` UTC, `WorkshopConfig.timezone = America/Argentina/Buenos_Aires`, UTC `getTime()` compare), INV-08 (`toTurnoDTO` camelCase — no `estado`/`fecha_hora_inicio` leak), INV-03 (Auth.js httpOnly JWT). INV-01/04/05 (capacity/FOR UPDATE/slotStep) NOT touched by cancel (single-row `UPDATE`, no `tstzrange &&`).

### Affected Areas

- `src/app/api/appointments/[id]/cancel/route.ts` — **NEW, sole code change.** Thin `PATCH` handler: `requireAuth(req)` → `uuidSchema.parse(params.id)` → `cancelAppointment({db, config, now?}, id, authUser)` → `200 TurnoDTO`. Maps `UnauthorizedError→401 UNAUTHORIZED`, `ForbiddenError→403 FORBIDDEN` (ownership), `ZodError→400 VALIDATION_ERROR + issues`, `AppointmentNotFoundError→404`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE` (`"El turno ya comenzó"` when time guard fires or `Cannot transition X -> CANCELADO`). No body, no capacity/`FOR UPDATE` logic. Must use `server-only` and `NextResponse.json`. Differs from `confirm`/`reject` by **removing** `assertRole(ADMINISTRADOR)` — cancel allows owner CLIENTE.

- `src/services/appointmentService.ts#cancelAppointment` — **CONSUME, do not modify.** Already implements full path (`loadOr404 → assertOwnership → ensureFuture → canTransition with opts → updateTurnoStatus`). `deps: {db, config, now?}` clock-injected; route should NOT create `now` — pass through DI so tests control time. No new service logic.

- `src/domain/appointmentStateMachine.ts#canTransition` — **CONSUME.** Route indirectly via service. No direct import in route. `canTransition` time guard is dual-enforced (service `ensureFuture` + `canTransition` opts) — intentional defense-in-depth; both use UTC `getTime()`.

- `src/db/repositories/turnos.ts#updateTurnoStatus` — **CONSUME.** Thin `UPDATE turnos SET estado, updatedAt RETURNING` → `toTurnoDTO`. No capacity logic.

- `src/lib/auth/requireAuth.ts` (`requireAuth`, `assertOwnership`) — **REUSE.** Cancel route uses `requireAuth` only; `assertOwnership` lives in service. Do NOT add `assertRole` — would block owner CLIENTE. Test `401 before 400` still applies; `403` comes from service ownership check, not route role gate.

- `src/lib/http/errors.ts` (`ERROR_CODES`, `toErrorBody`, `toValidationError`) — **REUSE** for envelope `{error:{code,message,issues?}}`.

- `src/config/workshopConfig.ts` — **READ-ONLY DI** (`workshopConfig.timezone/operatingHours/capacityPerSlot` passed to service; cancel does not need capacity but deps shape requires it — same as confirm/reject for consistency).

- `src/app/api/appointments/[id]/cancel/route.test.ts` — **NEW.** Mirrors `confirm/route.test.ts` pattern with cancel-specific ownership cases: mocked `requireAuth` + `cancelAppointmentMock`, table for `401` (before 400), `403` non-owner FORBIDDEN (before time), `400` malformed UUID + empty id + issues, `404` unknown, `409` terminal `RECHAZADO/CANCELADO` + `PENDIENTE past` + `CONFIRMADO past` + `now>=start "El turno ya comenzó"`, `200` DTO camelCase + no snake leak + DI config passing + owner vs ADMIN success.

- `openspec/specs/appointment/spec.md` — **READ-ONLY.** Existing `Cancel Time Guard` and `State Transition Matrix` requirements already cover cancel service; T-032 delta will add thin route requirement `PATCH /api/appointments/{id}/cancel` if not already present.

- `middleware.ts` — **READ-ONLY.** Already 401-guards `/api/appointments/*` (public only `GET /api/services` + `POST /api/auth/*`). Verify matcher covers `PATCH`.

### Approaches

1. **Thin cancel route delegating to cancelAppointment — mirror confirm/reject without assertRole (recommended)**

   Create `src/app/api/appointments/[id]/cancel/route.ts` by duplicating `confirm/route.ts` but **removing** `assertRole(ADMINISTRADOR)` and `UserRole` import, keeping only `requireAuth(req)` before UUID validation, then delegating to `cancelAppointment({db, config}, id, authUser)`. Service owns `assertOwnership` (CLIENTE owner or ADMIN bypass) + `now < start` + `canTransition`. Error mapping stays: `UnauthorizedError→401`, `ForbiddenError→403`, `ZodError→400`, `AppointmentNotFoundError→404`, `InvalidAppointmentStateError→409`.

   - Pros: Lowest risk — `confirm` (T-030) and `reject` (T-031) patterns shipped and verified 2026-08-28. Correct semantics: `CLIENTE owner PENDIENTE/CONFIRMADO future → 200 CANCELADO`, `CLIENTE non-owner → 403 FORBIDDEN` (ownership-first before time — prevents timing oracle), `ADMIN any future → 200` (bypass), `terminal RECHAZADO/CANCELADO → 409`, `now >= start → 409 "El turno ya comenzó"` with exact H-12 borders. Keeps route thin (zero business logic) and `AppointmentService` single owner per `Technical-spec §4.5/H-19`. Under 400-line budget (route ~70 LOC + test ~260 LOC). Future `cancel` ownership branch stays independent from ADMIN-only routes.
   - Cons: ~40 LOC duplicated between `confirm`/`reject`/`cancel` routes (auth/uuid/config/error mapping identical minus `assertRole`). Minor DRY violation; acceptable for 3 routes with divergent auth semantics.
   - Effort: Low (route ~70 LOC + test; 1-2 hours).

2. **Route-level ownership guard before delegation (duplicate assertOwnership in route)**

   Route does `requireAuth → uuid → findTurnoById → assertOwnership(resource)` inline, then calls `cancelAppointment` which re-checks ownership. Adds early 403 without hitting service time guard.

   - Pros: Fails fast; explicit ownership in HTTP layer visible to reviewer.
   - Cons: Duplicates `assertOwnership` + `findTurnoById` (two DB reads if service also does `loadOr404`) — wastes query, risks drift if service logic changes (e.g., ADMIN bypass rule). Violates single-owner `AppointmentService` (Technical-spec §4.5). No benefit over service's existing ownership-first order (already guarantees 403 before time). Adds unnecessary repo import to route.
   - Effort: Low but negative value.

3. **Shared helper extracted — `withTransitionRoute(handler, { requireAdmin: boolean })`**

   Extract `src/app/api/appointments/[id]/_helpers/transitionRoute.ts` factoring `requireAuth → (optional) assertRole → uuid → DI config → serviceFn → error mapping` and parametrize `requireAdmin` flag. `confirm`/`reject` call `createTransitionRoute(confirmAppointment, {requireAdmin:true})`, `cancel` calls `createTransitionRoute(cancelAppointment, {requireAdmin:false})`.

   - Pros: DRY — single `toErrorBody` envelope fix propagates.
   - Cons: Premature abstraction for 3 routes where `cancel` auth semantics (owner-or-ADMIN) cannot be expressed as `requireAdmin` boolean alone — would need `requireOwner` predicate + `ForbiddenError` branching. Hides `server-only` boundary per route, adds indirection, increases blast radius (helper bug breaks all transitions). `confirm` already shipped without helper — retrofitting churns archives. `sdd-tasks` delivery guard prefers thin slices over helper churn.
   - Effort: Medium (helper + refactor confirm/reject + new cancel + helper unit tests).

### Recommendation

**Adopt Approach 1: Thin `PATCH /api/appointments/[id]/cancel/route.ts` with `requireAuth` only (no `assertRole`), delegating to `cancelAppointment` with `assertOwnership` + `ensureFuture` + `canTransition` inside service.**

Why:

- **Contract fidelity:** `Technical-spec §8.8 / Functional-spec FL-03/FL-03b / implementation-plan.md T-032` require "`turno.clienteId == authUser.id` or `ADMINISTRADOR`" + `now < fechaHoraInicio` + `canTransition(PENDIENTE|CONFIRMADO, CANCELADO)`. `confirm`/`reject` require `ADMINISTRADOR` via `assertRole`; `cancel` explicitly must NOT — adding `assertRole` would break owner CLIENTE cancel. Route does `requireAuth` → `uuid` → service; service's `assertOwnership` is single source of truth for 403.
- **Ownership-first ordering (H-12):** Service already implements `assertOwnership` before `ensureFuture`/`canTransition` opts. This guarantees `non-owner CLIENTE` gets `403 FORBIDDEN` even if turno is past (`now >= start` would otherwise leak existence via 409). Time guard second ensures `owner past` gets `409 "El turno ya comenzó"` with exact borders. Route must not reorder.
- **Error mapping table (T-032 must implement):**
  | Source | HTTP | Code |
  |---|---|---|
  | `requireAuth` missing/invalid | 401 | `UNAUTHORIZED` |
  | `assertOwnership` fails (CLIENTE non-owner) | 403 | `FORBIDDEN` |
  | `z.string().uuid().parse(id)` fails | 400 | `VALIDATION_ERROR` (+ `issues`) |
  | `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` |
  | `InvalidAppointmentStateError` wrong state (`RECHAZADO/CANCELADO` terminal) | 409 | `INVALID_APPOINTMENT_STATE` |
  | `InvalidAppointmentStateError` time (`now >= start`) | 409 | `INVALID_APPOINTMENT_STATE` `"El turno ya comenzó"` |
  | Success `PENDIENTE->CANCELADO` or `CONFIRMADO->CANCELADO` future | 200 | `TurnoDTO {status:"CANCELADO"}` camelCase, no `estado` leak |
  | (No `409 APPOINTMENT_NOT_AVAILABLE` — not a capacity endpoint) |
- **Clock injection:** Route passes `workshopConfig` DI but does NOT create `now`; `cancelAppointment` uses `deps.now ?? new Date()` internally. Tests inject `now` via deps to hit `08:59/09:00:00/09:00:01` borders deterministically (already proven in `appointmentService.test.ts`). Route test should mock service rejection for time case, not inject `now` itself.
- **File layout (delta for T-032):**
  ```
  src/app/api/appointments/[id]/cancel/route.ts      # NEW — thin PATCH, mirror of confirm/route.ts minus assertRole
  src/app/api/appointments/[id]/cancel/route.test.ts # NEW — mocked service/auth, table-driven ownership + borders
  --- reused unchanged ---
  src/services/appointmentService.ts#cancelAppointment  # existing, tested — DO NOT MODIFY
  src/domain/appointmentStateMachine.ts#canTransition   # existing
  src/db/repositories/turnos.ts#updateTurnoStatus       # existing
  ```
- **Test parity:** Route test mirrors `confirm/route.test.ts` with cancel-specific delta: `vi.mock("@/services/appointmentService")` with `cancelAppointmentMock`, `vi.mock("@/lib/auth/requireAuth")` with `requireAuthMock`, cases `401` (UnauthorizedError before 400), `403` non-owner FORBIDDEN (before time), `400` invalid UUID/empty with `issues`, `404` unknown, `409` terminal + already-CANCELADO + `now>=start`, `200` DTO camelCase + no snake leak + DI `config.timezone/capacityPerSlot` passing. Ownership table: owner CLIENTE success, ADMIN success (any clienteId), non-owner CLIENTE 403.

### Risks

- **Mixing `assertRole` into cancel route (copy-paste from confirm/reject)** — Would block owner CLIENTE with 403 incorrectly. Mitigated by explicitly removing `assertRole`/`UserRole` in cancel route; review checklist must assert `assertRole` absent and `assertOwnership` lives only in service. Service already bypasses ADMIN.
- **Ownership vs time order leak** — If route or future refactor checks `now >= start` before ownership, unauthenticated timing of past turnos leaks via 409 vs 403. Keep service order `assertOwnership → ensureFuture → canTransition(opts)`; route must not add its own `ensureFuture`.
- **Clock injection drift** — Route must not `new Date()` itself; service `getNow(deps)` is canonical (INV-06 UTC). If route injects `now` inconsistently, H-12 borders `08:59/09:00:00/09:00:01` diverge. Keep `deps = {db, config}` only; tests that need border coverage test service directly (already done), route test covers mapping via mocked rejection.
- **`[id]` dynamic segment naming** — Must be `src/app/api/appointments/[id]/cancel/route.ts` with `context: { params: Promise<{ id: string }> }` to match Next.js App Router and `confirm`/`reject`/`services/[id]` precedent. Using `[appointmentId]` mismatches filesystem.
- **Leaking `snake_case`/Spanish DB names** — Route returns `TurnoDTO` via service → `toTurnoDTO` enforces INV-08. Test must assert `customerId/vehicleId/serviceId/startDateTime/endDateTime/status` present and `cliente_id/estado/fecha_hora_inicio` absent.
- **Scope creep into capacity/concurrency** — Cancel is single-row `UPDATE`, no `SELECT FOR UPDATE`/`REPEATABLE READ`/`EXCLUDE`. Do not add `capacityPerSlot` or `tstzrange &&` logic; that belongs to `POST /api/appointments` only. Review must reject `FOR UPDATE` strings in T-032 diff.
- **400 vs 401 precedence** — Must be `requireAuth` before `uuidSchema.parse` per `POST /api/appointments` and `confirm/route.ts` (info leak to unauthenticated callers). Test `401 takes precedence over 400` (unauth + malformed UUID → 401) already in harness.
- **400 vs 409 confusion on past turno** — Past cancel is `409 INVALID_APPOINTMENT_STATE` with message `"El turno ya comenzó"`, not `400 VALIDATION_ERROR`. Do not map time guard to 400.
- **Duplicate state machine in route** — Route must not reimplement `if (turno.status !== "PENDIENTE" && turno.status !== "CONFIRMADO")` — delegate to `canTransition` via service. Enforce via grep: `canTransition` appears only in `appointmentStateMachine.ts` + `appointmentService.ts`.

### Ready for Proposal

Yes — **Ready.** Scope is bounded to a single thin route + test reusing proven `cancelAppointment` service (ownership-first, clock-injected, H-12 borders already unit-tested in T-027) and domain machine (`canTransition` for `CANCELADO`). Correct HTTP semantics clarified: `403` ownership vs `409` terminal/time, `ADMIN` bypass preserved, no `assertRole`. Service is implemented and tested; route is pure delegation mirror of T-030 `confirm` minus role gate. No open questions.

Next phase is `sdd-propose` to lock route contract (`PATCH /api/appointments/{id}/cancel`, auth any authenticated, params `id: uuid`, no body, responses `200 TurnoDTO CANCELADO | 400 | 401 | 403 | 404 | 409`, envelope `{error:{code,message}}` with `issues` for Zod), then `sdd-spec` delta for `appointment` domain (cancel requirement GWT already largely exists; add route-level GWT), then `sdd-design` (sequence `middleware → requireAuth → uuid → cancelAppointment → toTurnoDTO`), then `sdd-tasks`.

No clarification needed. `WorkshopConfig` frozen, auth guards ready, `AppointmentStateMachine` is single source of truth. T-032 must not touch atomic booking or `COMPLETADO`.
