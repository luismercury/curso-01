# Apply Progress: T-031 Reject Appointment PENDIENTE -> RECHAZADO

**Change**: t031-reject-appointment
**Mode**: Standard (strict_tdd: false)
**Status**: 9/9 tasks complete — Ready for verify
**Date**: 2026-08-28
**Estimated lines**: ~190 (route ~70 + tests ~120) — within 400 budget, single PR

## Completed Tasks

- [x] 1.1 Create `src/app/api/appointments/[id]/reject/route.ts` — mirror confirm swapping confirmAppointment → rejectAppointment
- [x] 1.2 Wire DI Pick<WorkshopConfig timezone|operatingHours|capacityPerSlot> + Mirror comment, no capacity/FOR UPDATE logic
- [x] 2.1 Mocked route.test.ts — 401 UNAUTHORIZED before 400 with valid and malformed UUID
- [x] 2.2 Forbidden 403 CLIENTE via assertRole + 400 VALIDATION_ERROR malformed/empty UUID with issues
- [x] 2.3 Not found 404 + Wrong state 409 (CONFIRMADO|RECHAZADO|CANCELADO→RECHAZADO) + Already started 409 "El turno ya comenzó"
- [x] 2.4 Happy path 200 TurnoDTO RECHAZADO camelCase + INV-08 leak checks + DI config timezone/capacityPerSlot spy
- [x] 3.1 Run `npx tsc --noEmit` — zero errors, no DB snake leak
- [x] 3.2 Run `npx vitest run src/app/api/appointments/[id]/reject/route.test.ts` — 13 green, grep negative FOR UPDATE/EXCLUDE/REPEATABLE READ
- [x] 3.3 Manual smoke spec scenarios (401 before 400, ADMIN 200 RECHAZADO, CLIENTE 403, terminal 409) — documented via mocked tests

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/api/appointments/[id]/reject/route.ts` | Created | Thin PATCH handler: server-only, Mirror comment, requireAuth→assertRole(ADMINISTRADOR)→uuidSchema→rejectAppointment, §12 error mapping 401/403/400/404/409, DI config timezone/operatingHours/capacityPerSlot, no body/capacity logic |
| `src/app/api/appointments/[id]/reject/route.test.ts` | Created | Mocked auth/service tests covering 401/403/400/404/409/200, 401-before-400 precedence, snake-leak INV-08, DI spy — 13 tests |
| `openspec/changes/t031-reject-appointment/tasks.md` | Modified | Marked 9/9 tasks [x] |
| `openspec/changes/t031-reject-appointment/apply-progress.md` | Created | This progress artifact (both stores) |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx tsc --noEmit` → exit 0, zero type errors (params Promise<{id:string}>, DTO camelCase). `npx vitest run src/app/api/appointments/[id]/reject/route.test.ts` → Test Files 1 passed, Tests 13 passed (Duration 1.54s, transform 258ms, import 1.24s, tests 23ms) |
| Runtime harness command/scenario and exact result | N/A — mocked JWT/auth; no live DB required for unit proof per tasks. Manual harness optional: `curl -X PATCH http://localhost:3000/api/appointments/<uuid>/reject -H "Cookie: authjs.session-token=<ADMIN JWT>"` → 200 TurnoDTO status RECHAZADO; CLIENTE → 403; unauth malformed UUID → 401 before 400 (not executed in CI, proven via mocked unit precedence test) |
| Rollback boundary | Delete `src/app/api/appointments/[id]/reject/` and revert commit; no migration, no DB schema change, no capacity logic |

## Verification

- `npx tsc --noEmit` — clean (no output)
- `npx vitest run src/app/api/appointments/[id]/reject/route.test.ts` — 13/13 green:
  - 401 UNAUTHORIZED before UUID (2 cases including malformed UUID precedence)
  - 403 FORBIDDEN CLIENTE via assertRole (service not called)
  - 400 VALIDATION_ERROR malformed/empty UUID with issues array
  - 404 APPOINTMENT_NOT_FOUND
  - 409 INVALID_APPOINTMENT_STATE for CONFIRMADO/RECHAZADO/CANCELADO → RECHAZADO table-driven (3)
  - 409 INVALID_APPOINTMENT_STATE "El turno ya comenzó" now>=start
  - 200 DTO camelCase status RECHAZADO + leak check (no estado/fecha_hora_inicio/cliente_id)
  - DI config spy timezone/capacityPerSlot + INV-01/06
- `Select-String` negative: no FOR UPDATE / EXCLUDE / REPEATABLE READ in route or test

## Invariants Enforced

- INV-02: Only PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO via canTransition; RECHAZADO terminal; no COMPLETADO
- INV-03: Auth.js JWT httpOnly + requireAuth → assertRole ADMINISTRADOR → 401/403 order
- INV-08: DTO camelCase via toTurnoDTO; snake leak assertions pass (no estado/fecha_hora_inicio/cliente_id)
- INV-06: No naive timestamp; DI timezone America/Argentina/Buenos_Aires passed; UTC via service deps.now
- INV-01: capacityPerSlot included in DI config (harmless for reject, INV-01 compliance)
- No capacity/FOR UPDATE/tstzrange/EXCLUDE logic in route diff — verified via grep

## Deviations from Design

None — implementation matches design.md thin handler + error order 401→403→400→404→409 + DI shape + Mirror comment.

## Issues Found

None.

## Next Recommended

sdd-verify for change t031-reject-appointment

## Skill Resolution

- sdd-apply: completed (9/9)
- artifact_store.mode: both (Engram topic `sdd/t031-reject-appointment/apply-progress` + `openspec/changes/t031-reject-appointment/apply-progress.md`)
- delivery_strategy: auto-chain, single PR (190 lines, 400-line budget risk Low, no chain needed)
- review_budget_lines: 400 — within budget
