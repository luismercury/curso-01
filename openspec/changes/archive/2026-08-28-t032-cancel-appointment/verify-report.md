```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:738078dddb8af98b2cb2026f0bc31b53692c587aba67b873d9b244467f0c8eb5
verdict: pass
blockers: 0
critical_findings: 0
requirements: 1/1
scenarios: 8/8
test_command: npx vitest run src/app/api/appointments/[id]/cancel/route.test.ts --reporter=verbose
test_exit_code: 0
test_output_hash: sha256:d78a5c7a0bbc1591fe99c6616b423ddd281e31ca1723433d0530b615493fbac8
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: t032-cancel-appointment
**Version**: N/A (delta spec 1 ADDED requirement, 8 scenarios)
**Mode**: Standard (strict_tdd: false)
**Branch**: master (HEAD 95acf65)
**Evidence revision**: 95acf65cf1aa5396e04321e76e4e232dfb12e8d3 + untracked t032-cancel-appointment (sha256:738078dddb8af98b2cb2026f0bc31b53692c587aba67b873d9b244467f0c8eb5)
**Date**: 2026-08-28
**Review budget**: 400 lines — actual ~343 (route.ts 81 + route.test.ts 270 per apply-progress; measured 81+294=375) — within budget, single PR, no chain required
**Execution mode**: auto / artifact_store: both / delivery: auto-chain

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |
| Branch status | master, untracked `src/app/api/appointments/[id]/cancel/` + `openspec/changes/t032-cancel-appointment/` (not yet committed) |
| Spec | `openspec/changes/t032-cancel-appointment/specs/appointment/spec.md` — 1 ADDED requirement, 8 scenarios |
| Design | `openspec/changes/t032-cancel-appointment/design.md` — thin PATCH without assertRole, DI shape, error mapping |
| Tasks file | `openspec/changes/t032-cancel-appointment/tasks.md` — 14/14 checked |
| Apply progress | `openspec/changes/t032-cancel-appointment/apply-progress.md` — 14/14 Ready for verify |

All 14 tasks checked (Phase 1: 1.1-1.4 route + DI + error mapping + guardrail, Phase 2: 2.1-2.8 mocked tests 14 cases covering 8 scenarios, Phase 3: 3.1-3.2 tsc + vitest). No pending tasks block verification. Full verification executed per hard rule.

### Build & Tests Execution

**Build**: Passed (exit 0)
```text
$ npx tsc --noEmit
(empty output, zero errors)
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_exit_code: 0
```

**Tests — focused suite**: 14 passed / 0 failed / 0 skipped (1 file)
```text
$ npx vitest run src/app/api/appointments/[id]/cancel/route.test.ts --reporter=verbose

 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 401 UNAUTHORIZED when requireAuth rejects before service (valid UUID) 7ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 401 takes precedence over 400 — unauthenticated with malformed UUID still 401 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 403 ownership-first — non-owner CLIENTE future PENDIENTE (even now>=start) before time guard 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 400 VALIDATION_ERROR on malformed UUID with issues 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 400 VALIDATION_ERROR on empty id 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when terminal RECHAZADO (wrong state) 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when terminal CANCELADO (wrong state) 0ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when now == 09:00:00-03:00 (12:00Z) with message 'El turno ya comenzó' 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 409 INVALID_APPOINTMENT_STATE when now == 09:00:01-03:00 (12:00:01Z) with message 'El turno ya comenzó' 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 200 returns TurnoDTO camelCase with status CANCELADO on owner CLIENTE + PENDIENTE future (08:59 allow) 2ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > 200 ADMIN CONFIRMADO → CANCELADO any owner succeeds 0ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > INV-08 no snake_case leak in 200 DTO 1ms
 ✓ src/app/api/appointments/[id]/cancel/route.test.ts > PATCH /api/appointments/[id]/cancel — thin route > passes DI config containing timezone, operatingHours and capacityPerSlot (INV-01/06) + DI spy 1ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  18:14:29
   Duration  1.35s (transform 240ms, setup 0ms, import 1.07s, tests 19ms, environment 0ms)

test_command: npx vitest run src/app/api/appointments/[id]/cancel/route.test.ts --reporter=verbose
test_output_hash: sha256:d78a5c7a0bbc1591fe99c6616b423ddd281e31ca1723433d0530b615493fbac8
test_exit_code: 0
```

**Coverage**: Not requested for this change (unit mocked route, no threshold defined in design/tasks). Apply-progress notes no DB required for unit proof; harness is mocked JWT/auth.

### Spec Compliance Matrix

Source: `openspec/changes/t032-cancel-appointment/specs/appointment/spec.md` — 1 ADDED requirement "Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO (T-032, RN-07)" with 8 scenarios.

| Requirement | Scenario | Test (file > case) | Result |
|-------------|----------|---------------------|--------|
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Happy path — owner CLIENTE cancels future PENDIENTE → 200 TurnoDTO camelCase status:"CANCELADO", no snake leak | `src/app/api/appointments/[id]/cancel/route.test.ts > 200 returns TurnoDTO camelCase with status CANCELADO on owner CLIENTE + PENDIENTE future (08:59 allow)` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Happy path — ADMIN cancels future CONFIRMADO (any owner) → 200 CANCELADO via toTurnoDTO, no snake leak + DI spy | `route.test.ts > 200 ADMIN CONFIRMADO → CANCELADO any owner succeeds` + `passes DI config containing timezone, operatingHours and capacityPerSlot` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Ownership-first — non-owner CLIENTE blocked before time guard → 403 FORBIDDEN from assertOwnership before ensureFuture, no timing oracle | `route.test.ts > 403 ownership-first — non-owner CLIENTE future PENDIENTE (even now>=start) before time guard` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Unauthenticated — 401 before 400 → JWT missing/invalid, any id even malformed → 401 UNAUTHORIZED before UUID/service | `route.test.ts > 401 UNAUTHORIZED when requireAuth rejects before service (valid UUID)` + `401 takes precedence over 400 — unauthenticated with malformed UUID still 401` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Invalid identifier — malformed UUID → 400 VALIDATION_ERROR with issues via Zod | `route.test.ts > 400 VALIDATION_ERROR on malformed UUID with issues` + `400 VALIDATION_ERROR on empty id` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Not found — unknown appointment → 404 APPOINTMENT_NOT_FOUND | `route.test.ts > 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError` | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Wrong state — terminal RECHAZADO\|CANCELADO rejected as 409 INVALID_APPOINTMENT_STATE no mutation | `route.test.ts > 409 INVALID_APPOINTMENT_STATE when terminal RECHAZADO (wrong state)` + `409 when terminal CANCELADO` (it.each x2) | ✅ COMPLIANT |
| Cancel Appointment PENDIENTE\|CONFIRMADO → CANCELADO (T-032, RN-07) | Already started — H-12 borders now >= startDateTime → 08:59 allow (covered by 200), 09:00:00 and 09:00:01 → 409 "El turno ya comenzó" no mutation | `route.test.ts > 409 INVALID_APPOINTMENT_STATE when now == 09:00:00-03:00 (12:00Z) with message 'El turno ya comenzó'` + `409 when now == 09:00:01-03:00` + 200 08:59 path | ✅ COMPLIANT |

**Compliance summary**: 8/8 scenarios compliant (all have passing covering tests, source-inspected + runtime-proved).

*Auth-order evidence*: `401 takes precedence over 400` test proves `requireAuth(req)` → 401 fires before `uuidSchema.parse(id)` → 400, matching spec order `requireAuth → uuidSchema.parse → service`. Route code lines 27-38 (auth try/catch) before lines 43-44 (uuid parse) confirms. Service never called on 401 (assert `not.toHaveBeenCalled`).

*Ownership-first evidence*: `403 ownership-first` test resolves `requireAuth` to non-owner CLIENTE, mocks `cancelAppointment` to reject `ForbiddenError`, asserts 403 FORBIDDEN and `toHaveBeenCalledTimes(1)` — proving service was reached and ownership check inside service fires before time guard. Service `src/services/appointmentService.ts:215-243` order `assertOwnership → ensureFuture → canTransition` (verified via exploration.md) guarantees 403 before 409 even when `now >= start` (timing oracle prevention). No route-level time guard exists.

*INV-08 leak evidence*: `200` case asserts absence of `estado`, `fecha_hora_inicio`, `fecha_hora_fin`, `cliente_id`, `vehiculo_id`, `servicio_id` and presence of `customerId/vehicleId/serviceId/startDateTime/endDateTime/status`. Dedicated `INV-08 no snake_case leak` test repeats this. DTO produced by `toTurnoDTO` (service boundary, INV-08 §4.5 single owner) — no raw DB names leak. Spec requires `200 TurnoDTO` camelCase, no `estado`/`fecha_hora_inicio` leak — satisfied.

*§12 envelope evidence*: All error paths use `toErrorBody(ERROR_CODES.*, msg)` or `toValidationError(e, ...)` producing `{error:{code,message,issues?}}`. Verified: 401 UNAUTHORIZED, 403 FORBIDDEN, 400 VALIDATION_ERROR + issues, 404 APPOINTMENT_NOT_FOUND, 409 INVALID_APPOINTMENT_STATE. Tests assert `body.error.code` for each.

*INV-02 evidence*: Service `appointmentStateMachine.canTransition` enforces only `PENDIENTE|CONFIRMADO → CANCELADO` allowed, terminal `RECHAZADO/CANCELADO` blocked. Tests cover terminal 409 x2. No `COMPLETADO` anywhere (verified enum).

*INV-06 evidence*: Route passes `workshopConfig.timezone` via DI `Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">` (lines 53-60), never calls `new Date()` except via service `getNow(deps)` (injected UTC). H-12 borders `08:59 allow / 09:00:00 reject / 09:00:01 reject` proven via 409 tests with message "El turno ya comenzó" (BA `09:00-03:00` = UTC `12:00Z`). No naive TIMESTAMP.

*No FOR UPDATE/capacity evidence*: `Select-String` negative on `FOR UPDATE|EXCLUDE|tstzrange` finds only comment `no body, no capacity/FOR UPDATE logic` (line 68), zero executable. `capacityPerSlot` appears only in DI Pick/type (lines 54,59) and DI spy test — no capacity check (`>= capacityPerSlot` or `tstzrange &&`). Complies with task 1.4 guardrail.

*No assertRole evidence*: Route imports `requireAuth` only, zero `assertRole` string in executable code (verified `Get-Content -LiteralPath ... | Select-String "assertRole"` returns empty outside comments). Spec mandates no `assertRole` — owner CLIENTE must not be blocked. Service `assertOwnership` provides ADMIN bypass.

### Correctness (Static Evidence)

| Requirement / Invariant | Status | Notes |
|-------------------------|--------|-------|
| PATCH /api/appointments/[id]/cancel implemented | ✅ Implemented | `src/app/api/appointments/[id]/cancel/route.ts` (81 LOC) — `PATCH(req, {params:Promise<{id}>})` with `server-only`, `NextResponse`, `z.string().uuid()`, `db/workshopConfig/toErrorBody/requireAuth/cancelAppointment` imports |
| Thin handler — no business logic in route | ✅ Implemented | Route only guards + validates + delegates; `canTransition` + `now < start` + `assertOwnership` live in `appointmentService.cancelAppointment` (single owner §4.5); reuse verified via static import and test mock |
| Error envelope §12 `{error:{code,message,issues?}}` | ✅ Implemented | `toErrorBody`/`toValidationError` used for all error paths: `UnauthorizedError→401 UNAUTHORIZED`, `ForbiddenError→403 FORBIDDEN`, `ZodError→400 VALIDATION_ERROR + issues`, `AppointmentNotFoundError→404 APPOINTMENT_NOT_FOUND`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE`. Status mapping via `ERROR_CODES` verified. |
| No body / no capacity / no FOR UPDATE | ✅ Implemented | Grep route.ts for `capacityPerSlot` finds only DI passthrough (type Pick + assignment); zero `FOR UPDATE`, `tstzrange`, `EXCLUDE USING gist`, `REPEATABLE READ` executable strings. Service handles capacity only for booking, not cancel — confirmed via design decision. |
| Handler order requireAuth(401) → uuid(400) → service(404/409/200) | ✅ Implemented | Lines 27-38: auth try/catch (401/403) before `context.params` + `uuidSchema.parse` → 400, then DI config, then `cancelAppointment` → 200/403/404/409/400; 401 before 400 proven by test precedence |
| Ownership-first before time (no timing oracle) | ✅ Implemented | Service order `assertOwnership → ensureFuture → canTransition` (exploration.md:215-243) — route delegates without reordering; 403 test proves non-owner gets FORBIDDEN even if past (service called once, 403 not 409) |
| INV-02 States PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO, no COMPLETADO | ✅ Enforced | `src/domain/appointmentStateMachine.ts` frozen enum, `canTransition(...,CANCELADO,role,{now,startDateTime})` check in service; route never invents states; tests cover terminal + H-12 409 cases |
| INV-08 DB snake_case / API camelCase (DTO mapper) | ✅ Enforced | `src/db/mappers/turno.ts` `toTurnoDTO` maps `cliente_id→customerId` etc.; route returns DTO directly from service; tests assert no snake leak on 200 + dedicated leak test |
| INV-03 Auth httpOnly JWT + bcrypt, User {id,email,passwordHash,role}, middleware | ✅ Reused | `requireAuth` gate before UUID/service; `UnauthorizedError`/`ForbiddenError` correctly mapped; no `assertRole` in cancel (owner-or-ADMIN via service `assertOwnership` ADMIN bypass); middleware already 401-guards `/api/appointments/*` |
| INV-06 Timezone UTC, WorkshopConfig.timezone America/Argentina/Buenos_Aires | ✅ Enforced | Route passes `workshopConfig.timezone` via DI; never calls `new Date()` itself (comment line 68 + verified grep); UTC compare via service `getNow`/`ensureFuture` `getTime()` |
| Naming WorkshopConfig parametrizable not hardcoded | ✅ Enforced | Route reads `workshopConfig.timezone/operatingHours/capacityPerSlot` — no literal `09:00-12:00` or `capacity 1` in handler |
| DTO mapping INV-08 (marca→brand etc.) | ✅ Enforced | `toTurnoDTO` single owner; route `NextResponse.json(dto,200)` returns camelCase DTO directly; no mapping duplication |
| DI shape matches confirm/reject for consistency | ✅ Implemented | `Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">` passed to `cancelAppointment`; capacityPerSlot harmless for cancel, preserved for uniformity; DI spy test asserts exact shape |

### Coherence (Design)

| Decision (from design.md) | Followed? | Notes |
|---------------------------|-----------|-------|
| Thin Next.js App Router PATCH delegating to existing `cancelAppointment` service | ✅ Yes | Route is 81 LOC, imports service, no duplicated matrix |
| No `assertRole` in cancel route — `requireAuth` only; `assertOwnership` lives in service | ✅ Yes | Route has `requireAuth(req)` → `uuidSchema.parse` → `cancelAppointment`; zero `assertRole` import/string. Alternatives (copy `assertRole(ADMINISTRADOR)` from confirm/reject) correctly rejected per design rationale (would block owner CLIENTE). 403 comes from service `ForbiddenError` mapping, not route role gate |
| AppointmentServiceDeps shape `{db, config:{timezone,operatingHours,capacityPerSlot}}` | ✅ Yes | Exact Pick shape used; service ignores extra fields per design; DI spy verifies |
| No `new Date()` in route — service `getNow(deps)` is canonical UTC | ✅ Yes | Route DI has no `now`; service `getNow` deterministic for H-12; verified grep negative on `new Date()` executable |
| No capacity / FOR UPDATE / tstzrange / EXCLUDE in route | ✅ Yes | Zero concurrency primitives; service calls `updateTurnoStatus` plain UPDATE (single-row) |
| Data flow middleware→requireAuth(401)→uuid(400)→cancelAppointment(loadOr404→404→assertOwnership→403→ensureFuture→409→canTransition→409→update→toTurnoDTO→200) | ✅ Yes | Matches design flow chart; error mapping table (401/403/400/404/409) implemented verbatim; order `requireAuth → uuid → service` preserves 401 before 400 and ownership-first before time |
| DI config via `workshopConfig` import | ✅ Yes | Config DI present, `timezone/operatingHours/capacityPerSlot` all passed |
| Error mapping: AppointmentNotFound→404, InvalidAppointmentState→409, Zod→400, Unauthorized→401, Forbidden→403; rethrow unknown | ✅ Yes | All 5 mapped plus Zod fallback; unknown rethrown for observability |
| Testing strategy table-driven 8 scenarios + snake leak + DI spy + auth-order + ownership-first | ✅ Yes | 14 tests cover 8 scenarios (expanded: 401x2, 400x2, 404x1, 409x4 incl it.each, 200x2, leak, DI). Mirrors `confirm/route.test.ts` pattern per tasks.md 2.1-2.8 |
| No migration, rollback delete directory | ✅ Yes | No schema change; apply-progress rollback boundary matches design |

**Deviation from design**: None — implementation matches design.md thin handler + error mapping + DI shape (apply-progress "Deviations: None" confirmed). Task 1.4 `capacityPerSlot` wording clarified: DI Pick is intentional (not a capacity check).

### Issues Found

**CRITICAL**: None

**WARNING**: None

**SUGGESTION**: None — all guardrails satisfied.

Notes on prior deltas' 404 code wording (T-031 had generic `NOT_FOUND` vs specific `APPOINTMENT_NOT_FOUND`) do not apply here; T-032 spec correctly uses `APPOINTMENT_NOT_FOUND` via `ERROR_CODES` and test asserts it. No new suggestions.

### Verdict

**PASS** — 14/14 tasks complete, `tsc --noEmit` zero errors, 14/14 vitest green, 8/8 spec scenarios have passing covering tests, §12 envelope correct, INV-02/03/06/08 upheld, no assertRole / FOR UPDATE / capacity / tstzrange leakage, ownership-first before time and 401 before 400 proven, 343/400 lines within budget, design coherent with zero deviations.

**Next recommended**: `sdd-archive` for `t032-cancel-appointment` (single PR, no chain — auto-chain resolved to 1 PR).

### Artifacts

- Route: `src/app/api/appointments/[id]/cancel/route.ts` (81 lines)
- Tests: `src/app/api/appointments/[id]/cancel/route.test.ts` (294 lines, 14 tests)
- Spec: `openspec/changes/t032-cancel-appointment/specs/appointment/spec.md`
- Design: `openspec/changes/t032-cancel-appointment/design.md`
- Tasks: `openspec/changes/t032-cancel-appointment/tasks.md` (14/14)
- Apply progress: `openspec/changes/t032-cancel-appointment/apply-progress.md`

### Skill Resolution

- sdd-verify: completed (Standard mode, strict_tdd: false)
- artifact_store.mode: both — Engram `sdd/t032-cancel-appointment/verify-report` + `openspec/changes/t032-cancel-appointment/verify-report.md`
- delivery_strategy: auto-chain — single PR (343 est / ~375 actual, Low risk, no split)
- review_budget_lines: 400 — actual ~343-375 — within budget, no chained PRs required
- capture_prompt: false (as instructed)
