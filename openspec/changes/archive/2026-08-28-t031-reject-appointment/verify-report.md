```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2d9f52ed10991633427000c03184faa8687022da803a1035e95656c43601503e
verdict: pass
blockers: 0
critical_findings: 0
requirements: 1/1
scenarios: 7/7
test_command: npx vitest run src/app/api/appointments/[id]/reject/route.test.ts --reporter=verbose
test_exit_code: 0
test_output_hash: sha256:a1e27df3b579d3824237c6f0b7326c72890f8cb35f5fa03e4a7023bd6b3beb59
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: t031-reject-appointment
**Version**: N/A (delta spec #311, 1 ADDED requirement, 7 scenarios)
**Mode**: Standard (strict_tdd: false)
**Branch**: master (HEAD 155e3ae)
**Evidence revision**: 155e3ae015bed6d530b7d9ed347cb3feb82ed239 + untracked t031-reject-appointment (sha256:2d9f52ed10991633427000c03184faa8687022da803a1035e95656c43601503e)
**Date**: 2026-08-28
**Review budget**: 400 lines — actual ~327 (route.ts 84 + route.test.ts 243) — within budget, single PR, no chain required
**Execution mode**: auto / artifact_store: both / delivery: auto-chain

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 9 |
| Tasks complete | 9 |
| Tasks incomplete | 0 |
| Branch status | master, untracked `src/app/api/appointments/[id]/reject/` + `openspec/changes/t031-reject-appointment/` (not yet committed) |
| Spec | `openspec/changes/t031-reject-appointment/specs/appointment/spec.md` — 1 ADDED requirement, 7 scenarios |
| Design | `openspec/changes/t031-reject-appointment/design.md` — thin PATCH, explicit assertRole, DI shape, error mapping |
| Tasks file | `openspec/changes/t031-reject-appointment/tasks.md` — 9/9 checked |
| Apply progress | `openspec/changes/t031-reject-appointment/apply-progress.md` — 9/9 Ready for verify |

All 9 tasks checked (Phase 1: 1.1-1.2 route + DI, Phase 2: 2.1-2.4 mocked tests 13 cases, Phase 3: 3.1-3.3 tsc + vitest + manual smoke). No pending tasks block verification. Full verification executed per hard rule.

### Build & Tests Execution

**Build**: Passed (exit 0)
```text
$ npx tsc --noEmit
(empty output, zero errors)
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_exit_code: 0
```

**Tests — focused suite**: 13 passed / 0 failed / 0 skipped (1 file)
```text
$ npx vitest run src/app/api/appointments/[id]/reject/route.test.ts --reporter=verbose

 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 401 UNAUTHORIZED when requireAuth rejects before UUID validation 8ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 401 takes precedence over 400 — unauthenticated with malformed UUID still 401 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 403 FORBIDDEN when CLIENTE role via assertRole and service not called 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 400 VALIDATION_ERROR on malformed UUID with issues 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 400 VALIDATION_ERROR on empty id 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 409 INVALID_APPOINTMENT_STATE when already CONFIRMADO (wrong state) 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 409 INVALID_APPOINTMENT_STATE when already RECHAZADO (wrong state) 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 409 INVALID_APPOINTMENT_STATE when already CANCELADO (wrong state) 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 409 INVALID_APPOINTMENT_STATE when now >= startDateTime with message 'El turno ya comenzó' 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > 200 returns TurnoDTO camelCase with status RECHAZADO on ADMIN + PENDIENTE future 2ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > INV-08 no snake_case leak in 200 DTO 1ms
 ✓ src/app/api/appointments/[id]/reject/route.test.ts > PATCH /api/appointments/[id]/reject — thin route > passes DI config containing timezone and capacityPerSlot (INV-01/06) 1ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  16:02:10
   Duration  1.51s (transform 257ms, setup 0ms, import 1.24s, tests 20ms, environment 0ms)

test_command: npx vitest run src/app/api/appointments/[id]/reject/route.test.ts --reporter=verbose
test_output_hash: sha256:a1e27df3b579d3824237c6f0b7326c72890f8cb35f5fa03e4a7023bd6b3beb59
test_exit_code: 0
```

**Coverage**: Not requested for this change (unit mocked route, no threshold defined in design/tasks). Apply-progress notes no DB required for unit proof; harness is mocked JWT/auth.

### Spec Compliance Matrix

Source: `openspec/changes/t031-reject-appointment/specs/appointment/spec.md` — 1 ADDED requirement "Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07)" with 7 scenarios.

| Requirement | Scenario | Test (file > case) | Result |
|-------------|----------|---------------------|--------|
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Happy path — ADMIN rejects future PENDIENTE → 200 TurnoDTO camelCase, status:"RECHAZADO", no leak | `src/app/api/appointments/[id]/reject/route.test.ts > 200 returns TurnoDTO camelCase with status RECHAZADO on ADMIN + PENDIENTE future` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Forbidden — CLIENTE cannot reject → 403 FORBIDDEN via assertRole before service, service not called | `route.test.ts > 403 FORBIDDEN when CLIENTE role via assertRole and service not called` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Unauthenticated — missing/invalid JWT before validation → 401 UNAUTHORIZED before any validation | `route.test.ts > 401 UNAUTHORIZED when requireAuth rejects before UUID validation` + `401 takes precedence over 400 — unauthenticated with malformed UUID still 401` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Invalid identifier — malformed UUID → 400 VALIDATION_ERROR with issues via Zod | `route.test.ts > 400 VALIDATION_ERROR on malformed UUID with issues` + `400 VALIDATION_ERROR on empty id` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Not found — unknown appointment → 404 APPOINTMENT_NOT_FOUND | `route.test.ts > 404 APPOINTMENT_NOT_FOUND when service throws AppointmentNotFoundError` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Wrong state — non-PENDIENTE (CONFIRMADO/RECHAZADO/CANCELADO) → 409 INVALID_APPOINTMENT_STATE no mutation | `route.test.ts > 409 INVALID_APPOINTMENT_STATE when already CONFIRMADO/RECHAZADO/CANCELADO (wrong state) [it.each x3]` | COMPLIANT |
| Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07) | Already started — now >= startDateTime → 409 INVALID_APPOINTMENT_STATE "El turno ya comenzó" no mutation | `route.test.ts > 409 INVALID_APPOINTMENT_STATE when now >= startDateTime with message 'El turno ya comenzó'` | COMPLIANT |

**Compliance summary**: 7/7 scenarios compliant (all have passing covering tests, source-inspected + runtime-proved).

*Auth-order evidence*: `401 takes precedence over 400` test proves `requireAuth` → 401 fires before `uuidSchema.parse` → 400, matching design order `requireAuth → assertRole → uuid → service`.

*INV-08 leak evidence*: `200` case asserts absence of `estado`, `fecha_hora_inicio`, `fecha_hora_fin`, `cliente_id`, `vehiculo_id`, `servicio_id` and presence of `customerId/vehicleId/serviceId/startDateTime/endDateTime/status`. Dedicated `INV-08 no snake_case leak` test repeats this. DTO is produced by `toTurnoDTO` (service boundary) — no raw DB names leak.

*INV-01/06 DI evidence*: `passes DI config containing timezone and capacityPerSlot` spies `rejectAppointmentMock` args and asserts `config.timezone` (string) and `config.capacityPerSlot` (number) are passed from `workshopConfig`; route does not hardcode values.

*No capacity/FOR UPDATE evidence*: `grep` negative check — route contains only comment `no capacity/FOR UPDATE logic` (line 68), zero executable `SELECT FOR UPDATE`, `tstzrange`, `EXCLUDE USING gist`, `REPEATABLE READ`, `capacityPerSlot` logic beyond DI passthrough. Verified via `Select-String` negative on `FOR UPDATE`/`EXCLUDE`/`REPEATABLE READ`/`tstzrange` outside comments.

### Correctness (Static Evidence)

| Requirement / Invariant | Status | Notes |
|-------------------------|--------|-------|
| PATCH /api/appointments/[id]/reject implemented | Implemented | `src/app/api/appointments/[id]/reject/route.ts` (84 LOC) — `PATCH(req, {params:Promise<{id}>})` with `server-only`, `NextResponse`, `uuidSchema`, `db/workshopConfig/toErrorBody/requireAuth/assertRole/rejectAppointment` imports |
| Thin handler — no business logic in route | Implemented | Route only guards + validates + delegates; `canTransition` + `now < start` live in `appointmentService.rejectAppointment`; reuse verified via static import and test mock |
| Error envelope §12 `{error:{code,message,issues?}}` | Implemented | `toErrorBody`/`toValidationError` used for all 5 error paths: `UnauthorizedError→401 UNAUTHORIZED`, `ForbiddenError→403 FORBIDDEN`, `ZodError→400 VALIDATION_ERROR + issues`, `AppointmentNotFoundError→404 APPOINTMENT_NOT_FOUND`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE`. Status mapping via `STATUS_BY_CODE` verified. |
| No body / no capacity / no FOR UPDATE | Implemented | Grep route.ts for `capacity` finds only DI passthrough `timezone/operatingHours/capacityPerSlot` (harmless per design); zero `FOR UPDATE`, `tstzrange`, `EXCLUDE` executable strings. Service handles capacity only for booking, not reject — confirmed via design decision. Comment `no body, no capacity/FOR UPDATE` is documentation, not logic. |
| Handler order requireAuth→assertRole→uuid→service→200 | Implemented | Lines 30-44: auth+role try/catch (401/403) before `context.params` + `uuidSchema.parse` → 400, then DI config, then `rejectAppointment` → 200/404/409 |
| INV-02 States PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO, no COMPLETADO | Enforced | `src/domain/appointmentStateMachine.ts` frozen enum, `canTransition(PENDIENTE,RECHAZADO,ADMINISTRADOR)` check in service; route never invents states; tests cover all terminal + wrong-state 409 cases |
| INV-08 DB snake_case / API camelCase (DTO mapper) | Enforced | `src/db/mappers/turno.ts` `toTurnoDTO` maps `cliente_id→customerId` etc.; route returns DTO directly from service; tests assert no snake leak |
| INV-03 Auth httpOnly JWT + bcrypt, User {id,email,passwordHash,role}, middleware | Reused | `requireAuth` + `assertRole(ADMINISTRADOR)` gate before UUID/service; `UnauthorizedError`/`ForbiddenError` correctly mapped; `UserRole.ADMINISTRADOR` matches Auth.js role model |
| INV-06 Timezone UTC, WorkshopConfig.timezone America/Argentina/Buenos_Aires | Enforced | Route passes `workshopConfig.timezone` via DI; never calls `new Date()` except via service `deps.now` (injected UTC); `ensureFuture(now,startDateTime)` uses `getTime()` UTC comparison |
| Naming WorkshopConfig parametrizable not hardcoded | Enforced | Route reads `workshopConfig.timezone/operatingHours/capacityPerSlot` — no literal `09:00-12:00` in handler |

### Coherence (Design)

| Decision (from design.md) | Followed? | Notes |
|---------------------------|-----------|-------|
| Thin Next.js App Router PATCH delegating to existing `rejectAppointment` service | Yes | Route is 84 LOC, imports service, no duplicated matrix |
| Explicit `assertRole` before service delegation | Yes | `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema → rejectAppointment`; Alternatives (service-only 403→409 conflation, direct repo duplicates matrix) correctly rejected; 403 before 409 separation proven by tests |
| AppointmentServiceDeps shape `{db, config:{timezone,operatingHours,capacityPerSlot}}` | Yes | Exact Pick shape used; capacityPerSlot harmless for reject, preserved for DI uniformity |
| No capacity / FOR UPDATE / tstzrange in route | Yes | Zero concurrency primitives; service calls `updateTurnoStatus` plain UPDATE |
| Data flow middleware→requireAuth(401)→assertRole(403)→uuid(400)→rejectAppointment(loadOr404→404→ensureFuture→409→canTransition→409→update→200) | Yes | Matches design flow chart; error mapping table (401/403/400/404/409) implemented verbatim |
| DI config via `workshopConfig` import, deps.now not injected in route | Yes | Config DI present, `now` defaults to `new Date()` inside service; test can inject via mock |
| Error mapping: AppointmentNotFound→404, InvalidAppointmentState→409, Zod→400, Unauthorized→401, Forbidden→403 | Yes | All 5 mapped; `APPOINTMENT_NOT_AVAILABLE` (409 capacity) correctly not applicable |
| Testing strategy table-driven 7 scenarios + snake leak + DI spy + auth-order | Yes | 13 tests cover 7 scenarios (expanded: 401x2, 400x2, 409x4 incl. it.each, 200, leak, DI) |
| No migration, rollback delete directory | Yes | No schema change; apply-progress rollback boundary matches design |

**Deviation from design**: None — implementation matches design.md thin handler + error mapping table + DI shape (apply-progress "Deviations: None" confirmed).

### Issues Found

**CRITICAL**: None

**WARNING**: None

**SUGGESTION**:
- **Delta spec 404 code wording**: Delta spec scenario text says `404 {error:{code:"NOT_FOUND"}}` (generic), while design / Error Mapping, route, `src/lib/http/errors.ts:ERROR_CODES.APPOINTMENT_NOT_FOUND`, and tests all use specific `APPOINTMENT_NOT_FOUND` (→ 404 via `STATUS_BY_CODE`). This is intentional domain specificity and matches precedent (`services/[id]`, `confirm` T-030). No fix required; optional spec editorial to align generic wording to `APPOINTMENT_NOT_FOUND` for consistency. Not a compliance failure — HTTP status 404 is correct and code is valid within envelope.

### Verdict

**PASS** — 9/9 tasks complete, `tsc --noEmit` zero errors, 13/13 vitest green, 7/7 spec scenarios have passing covering tests, §12 envelope correct, INV-02/08 upheld, no FOR UPDATE/capacity leakage, 327/400 lines within budget, design coherent with zero deviations.

**Next recommended**: `sdd-archive` for `t031-reject-appointment` (single PR, no chain — auto-chain resolved to 1 PR).

### Artifacts

- Route: `src/app/api/appointments/[id]/reject/route.ts` (84 lines)
- Tests: `src/app/api/appointments/[id]/reject/route.test.ts` (243 lines, 13 tests)
- Spec: `openspec/changes/t031-reject-appointment/specs/appointment/spec.md`
- Design: `openspec/changes/t031-reject-appointment/design.md`
- Tasks: `openspec/changes/t031-reject-appointment/tasks.md` (9/9)
- Apply progress: `openspec/changes/t031-reject-appointment/apply-progress.md`

### Skill Resolution

- sdd-verify: completed (Standard mode, strict_tdd: false)
- artifact_store.mode: both — Engram `sdd/t031-reject-appointment/verify-report` + `openspec/changes/t031-reject-appointment/verify-report.md`
- delivery_strategy: auto-chain — single PR (190 est / 327 actual, Low risk, no split)
- review_budget_lines: 400 — actual 327 — within budget, no chained PRs required
- capture_prompt: false (as instructed)
