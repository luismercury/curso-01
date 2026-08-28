# Tasks: T-031 Implementar rechazo de turnos (matriz RN-07) PATCH /api/appointments/{id}/reject

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~190 (route ~70 + tests ~120) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Thin PATCH reject route + mocked route.test.ts covering 7 spec scenarios → 200 RECHAZADO INV-08 | PR 1 (single) | `npx vitest run src/app/api/appointments/[id]/reject/route.test.ts` | `curl -X PATCH /api/appointments/{uuid}/reject` with ADMIN JWT → 200 vs CLIENTE → 403 | Delete `src/app/api/appointments/[id]/reject/` → 404, zero migration |

## Phase 1: Route — Thin Reject Handler

- [x] 1.1 Create `src/app/api/appointments/[id]/reject/route.ts` — mirror `src/app/api/appointments/[id]/confirm/route.ts` swapping `confirmAppointment` → `rejectAppointment`, `server-only`, order `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema.parse(id) → rejectAppointment({db, config}, id, authUser)` → `NextResponse.json(dto,200)`, map `UnauthorizedError→401 UNAUTHORIZED`, `ForbiddenError→403 FORBIDDEN`, `ZodError→400 VALIDATION_ERROR+issues`, `AppointmentNotFoundError→404`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE`
- [x] 1.2 Wire DI `Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">` from `src/config/workshopConfig.ts` (INV-01/06 parametrizable) and add `// Mirror of confirm/route.ts — keep in sync` comment; no body, no `FOR UPDATE`/`EXCLUDE`/`capacity` logic

## Phase 2: Tests — Mocked Route Coverage (7 Spec Scenarios)

- [x] 2.1 In `src/app/api/appointments/[id]/reject/route.test.ts` mock `server-only`, `@/db`, `@/services/appointmentService` (`rejectAppointmentMock`), `@/lib/auth/requireAuth` (`requireAuthMock`); cover spec scenario Unauthenticated → `401 UNAUTHORIZED` with valid UUID and `401 before 400` with malformed UUID (auth before validation, service not called)
- [x] 2.2 Cover spec scenario Forbidden → `403 FORBIDDEN` when `CLIENTE` via `assertRole(ADMINISTRADOR)` (service not called) and spec scenario Invalid identifier → `400 VALIDATION_ERROR` with `issues` on malformed UUID and empty id
- [x] 2.3 Cover spec scenarios Not found → `404 APPOINTMENT_NOT_FOUND` via `AppointmentNotFoundError` and Wrong state → `409 INVALID_APPOINTMENT_STATE` for `CONFIRMADO|RECHAZADO|CANCELADO → RECHAZADO` and Already started → `409 "El turno ya comenzó"` when `now >= startDateTime` via `InvalidAppointmentStateError`
- [x] 2.4 Cover spec scenario Happy path → `200 TurnoDTO {status:"RECHAZADO"}` camelCase for `ADMIN+PENDIENTE` future, assert INV-08 no `estado`/`fecha_hora_inicio`/`fecha_hora_fin`/`cliente_id` leak and DI config `timezone`/`capacityPerSlot` passed correctly to `rejectAppointment`

## Phase 3: Verify — Type & Runtime Guards

- [x] 3.1 Run `npx tsc --noEmit` — reject route types clean, no DB snake leak into DTO
- [x] 3.2 Run `npx vitest run src/app/api/appointments/[id]/reject/route.test.ts` — all 7 scenarios green, no `FOR UPDATE`/`EXCLUDE`/`REPEATABLE READ` strings in diff (`grep -r` negative check)
- [x] 3.3 Manual smoke: unauth `PATCH /api/appointments/{uuid}/reject` → 401 before 400, ADMIN future PENDIENTE → 200 RECHAZADO, CLIENTE → 403, second reject same id → 409 terminal
