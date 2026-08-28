# Apply Progress: T-032 Cancel Appointment — PATCH /api/appointments/{id}/cancel (RN-07)

**Change**: t032-cancel-appointment
**Mode**: Standard (strict_tdd: false)
**Status**: 14/14 tasks complete — Ready for verify
**Date**: 2026-08-28
**Estimated lines**: ~343 (route 73 + tests 270) — within 400 budget, single PR

## Completed Tasks

- [x] 1.1 Create `src/app/api/appointments/[id]/cancel/route.ts` `server-only` `PATCH`: `requireAuth(req) → uuidSchema.parse(id) → cancelAppointment({db,config},id,authUser) → NextResponse.json(dto,200)`; `401 before 400`; no `assertRole`
- [x] 1.2 Wire DI `config: Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">` from `workshopConfig`; no `new Date()` — service `getNow` is canonical UTC (INV-06)
- [x] 1.3 Map errors via `toErrorBody`/`toValidationError` (§12): `Unauthorized→401`, `Forbidden→403`, `ZodError→400+issues`, `AppointmentNotFound→404`, `InvalidAppointmentState→409`; rethrow unknown
- [x] 1.4 Assert diff has no `assertRole`/`FOR UPDATE`/`EXCLUDE`/`tstzrange` (INV-01/04/05 out-of-scope) — verified; `capacityPerSlot` only in DI Pick (not check)
- [x] 2.1 `401 before 400` — `UnauthorizedError` with valid UUID and malformed UUID both → `401 UNAUTHORIZED`, service not called
- [x] 2.2 `403 ownership-first` — non-owner `CLIENTE customerB` on future `PENDIENTE` (even `now>=start`) → `403 FORBIDDEN` via `ForbiddenError` before time guard
- [x] 2.3 `400 malformed UUID` — auth owner/ADMIN, `not-a-uuid` and `""` → `400 VALIDATION_ERROR` with `issues`
- [x] 2.4 `404 not found` — `AppointmentNotFoundError` → `404 APPOINTMENT_NOT_FOUND`
- [x] 2.5 `409 terminal` — `RECHAZADO`/`CANCELADO` (`now<start`) → `409 INVALID_APPOINTMENT_STATE` no mutation
- [x] 2.6 `409 H-12 borders` — `start=09:00-03:00` (12:00Z): `09:00:00` and `09:00:01` → `409 "El turno ya comenzó"`; `08:59` path covered by 200
- [x] 2.7 `200 owner` — owner `CLIENTE` future `PENDIENTE` → `200 TurnoDTO status:CANCELADO` camelCase, no `estado`/`fecha_hora_inicio` leak
- [x] 2.8 `200 ADMIN + INV-08/DI` — ADMIN future `CONFIRMADO` any owner → `200 CANCELADO` + assert `cancelAppointment` called with `{db, config:{timezone,operatingHours,capacityPerSlot}}`
- [x] 3.1 Run `pnpm typecheck` (`tsc --noEmit`)
- [x] 3.2 Run `pnpm vitest run src/app/api/appointments/[id]/cancel/route.test.ts` — all 8 scenarios + DI/INV-08 green

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/api/appointments/[id]/cancel/route.ts` | Created | Thin PATCH handler: server-only, requireAuth only (no assertRole/ADMIN), await params id → uuidSchema.parse → cancelAppointment({db, config},id,authUser) → NextResponse.json 200, §12 error mapping 401/403/400/404/409, DI Pick timezone/operatingHours/capacityPerSlot, no new Date()/FOR UPDATE/EXCLUDE/capacity/tstzrange |
| `src/app/api/appointments/[id]/cancel/route.test.ts` | Created | Mocked auth/service table-driven tests: 401 before 400 (2 cases), 403 ownership-first non-owner, 400 malformed/empty UUID with issues, 404, 409 terminal RECHAZADO/CANCELADO, 409 H-12 09:00:00/09:00:01 "El turno ya comenzó", 200 owner PENDIENTE→CANCELADO camelCase + 200 ADMIN CONFIRMADO→CANCELADO, INV-08 snake leak + DI spy — 14 tests |
| `openspec/changes/t032-cancel-appointment/tasks.md` | Modified | Marked 14/14 tasks [x] |
| `openspec/changes/t032-cancel-appointment/apply-progress.md` | Created | This progress artifact (both stores) |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm typecheck` → exit 0, zero errors (params Promise<{id:string}>, DTO camelCase). `pnpm vitest run src/app/api/appointments/[id]/cancel/route.test.ts` → Test Files 1 passed, Tests 14 passed (Duration ~1.37s, transform ~230ms, import ~1.09s, tests ~19ms) |
| Runtime harness command/scenario and exact result | N/A — mocked JWT/auth; no live DB required for unit proof per tasks. Manual harness optional: `curl -X PATCH http://localhost:3000/api/appointments/<uuid>/cancel -H "Cookie: authjs.session-token=<CLIENTE owner JWT>"` → 200 TurnoDTO status CANCELADO; ADMIN any owner → 200; non-owner CLIENTE → 403 ownership-first before time; unauth malformed UUID → 401 before 400 (proven via mocked unit precedence test) |
| Rollback boundary | Delete `src/app/api/appointments/[id]/cancel/` and revert commit; no migration, no DB schema change, no capacity/FOR UPDATE logic |

## Verification

- `pnpm typecheck` — clean (no output)
- `pnpm vitest run src/app/api/appointments/[id]/cancel/route.test.ts` — 14/14 green:
  - 401 UNAUTHORIZED before UUID (2 cases including malformed UUID precedence, service not called)
  - 403 FORBIDDEN ownership-first non-owner CLIENTE via ForbiddenError before time guard (service called, 403)
  - 400 VALIDATION_ERROR malformed/empty UUID with issues array (service not called)
  - 404 APPOINTMENT_NOT_FOUND
  - 409 INVALID_APPOINTMENT_STATE for RECHAZADO/CANCELADO → CANCELADO terminal table-driven (2)
  - 409 INVALID_APPOINTMENT_STATE "El turno ya comenzó" at 09:00:00-03:00 and 09:00:01-03:00 (2)
  - 200 DTO camelCase owner CLIENTE PENDIENTE→CANCELADO (08:59 allow) + leak check (no estado/fecha_hora_inicio/cliente_id)
  - 200 ADMIN CONFIRMADO→CANCELADO any owner
  - INV-08 no snake leak assertions + DI config spy timezone/operatingHours/capacityPerSlot
- `Select-String` negative: no `assertRole` / `FOR UPDATE` / `EXCLUDE` / `tstzrange` / `new Date()` in route; `capacityPerSlot` only in DI Pick

## Invariants Enforced

- INV-02: Only PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO via canTransition; PENDIENTE|CONFIRMADO → CANCELADO allowed, terminal blocked; no COMPLETADO
- INV-03: Auth.js JWT httpOnly + requireAuth only (no assertRole); service assertOwnership owner-or-ADMIN → 401 before 400, 403 ownership-first before time (timing oracle prevention)
- INV-08: DTO camelCase via toTurnoDTO; snake leak assertions pass (no estado/fecha_hora_inicio/fecha_hora_fin/cliente_id/vehiculo_id/servicio_id)
- INV-06: No naive timestamp; no new Date() in route; DI timezone America/Argentina/Buenos_Aires passed; UTC compare via service getNow/canTransition
- INV-01/04/05: No capacity/FOR UPDATE/EXCLUDE/tstzrange/slotStep logic in route diff — verified via grep; capacityPerSlot only as DI shape for consistency

## Deviations from Design

None — implementation matches design.md thin handler without assertRole, order requireAuth → uuid → cancelAppointment, DI Pick timezone/operatingHours/capacityPerSlot, error mapping §12, no new Date().

Note on task 1.4 `capacityPerSlot` wording: diff contains `capacityPerSlot` only inside `Pick<WorkshopConfig,...>` and `workshopConfig.capacityPerSlot` DI assignment (no capacity check, no `>= capacityPerSlot`, no `tstzrange &&`). This is intentional per design decision "DI shape matches confirm/reject for consistency."

## Issues Found

None.

## Next Recommended

sdd-verify for change t032-cancel-appointment

## Skill Resolution

- sdd-apply: completed (14/14)
- artifact_store.mode: both (Engram topic `sdd/t032-cancel-appointment/apply-progress` + `openspec/changes/t032-cancel-appointment/apply-progress.md`)
- delivery_strategy: auto-chain, single PR (343 lines, 400-line budget risk Low, no chain needed)
- review_budget_lines: 400 — within budget
