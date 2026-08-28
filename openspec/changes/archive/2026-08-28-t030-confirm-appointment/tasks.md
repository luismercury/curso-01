# Tasks: T-030 Confirm Appointment PENDIENTE -> CONFIRMADO PATCH /api/appointments/[id]/confirm

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 190 (route ~70 + tests ~120) |
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
| 1 | Thin PATCH confirm route + full mocked route.test covering 401/403/400/404/409/200 and verification | PR 1 (single) | `npx tsc --noEmit && npx vitest run src/app/api/appointments/[id]/confirm/route.test.ts` | N/A — mocked JWT/auth; no live DB required for unit proof. Manual curl `PATCH /api/appointments/<uuid>/confirm` with ADMIN JWT → 200 (optional) | Delete `src/app/api/appointments/[id]/confirm/` and revert commit |

Threat matrix: N/A per design (pure HTTP handler, no shell/subprocess/VCS boundary). No RED threat tests required.

Spec scenarios mapped: Happy 200 | Wrong state 409 | Forbidden CLIENTE 403 | Unauthenticated 401 | Invalid UUID 400 | Not found 404 | Already started now>=start 409.

## Phase 1: Route PATCH /api/appointments/[id]/confirm (thin handler)

- [x] 1.1 Create `src/app/api/appointments/[id]/confirm/route.ts` with `server-only`, imports `NextResponse`, `z/ZodError`, `db`, `workshopConfig`, `toErrorBody/toValidationError/ERROR_CODES`, `requireAuth/assertRole`, `confirmAppointment`, service errors
- [x] 1.2 Implement `export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> })` ordered `requireAuth(req) → assertRole(ADMINISTRADOR) → uuidSchema.parse(id) → confirmAppointment({ db, config:{ timezone, operatingHours, capacityPerSlot } }, id, authUser) → NextResponse.json(dto, {status:200})` with `ForbiddenError/UnauthorizedError` catch before UUID
- [x] 1.3 Map errors to §12 envelope: `UnauthorizedError→401 UNAUTHORIZED`, `ForbiddenError→403 FORBIDDEN`, `ZodError→400 VALIDATION_ERROR (+issues)`, `AppointmentNotFoundError→404 APPOINTMENT_NOT_FOUND`, `InvalidAppointmentStateError→409 INVALID_APPOINTMENT_STATE` via `toErrorBody`/`toValidationError`; no body, no capacity/FOR UPDATE logic

## Phase 2: Tests route.test for all codes + INV-08 snake leak

- [x] 2.1 Scaffold `src/app/api/appointments/[id]/confirm/route.test.ts` mocking `server-only`, `@/db` (`{db:{}}`), `@/services/appointmentService` (`confirmAppointmentMock`), `@/lib/auth/requireAuth` (`requireAuthMock`); fixtures `ADMIN`, `CLIENTE`, UUIDs, `TurnoDTO` with `status:"CONFIRMADO"` camelCase
- [x] 2.2 Add error-code tests: unauthenticated `requireAuthMock` rejects `UnauthorizedError` → `401 UNAUTHORIZED` before UUID; `CLIENTE` role → `403 FORBIDDEN` via `assertRole` (also assert service not called); malformed UUID → `400 VALIDATION_ERROR` with `issues`
- [x] 2.3 Add not-found/state tests: unknown UUID → `404 APPOINTMENT_NOT_FOUND`; `CONFIRMADO/RECHAZADO/CANCELADO` → `409 INVALID_APPOINTMENT_STATE`; `now>=startDateTime` (mock `InvalidAppointmentStateError("El turno ya comenzó")`) → `409 INVALID_APPOINTMENT_STATE` with message; verify no mutation
- [x] 2.4 Add happy + leak tests: `ADMIN + PENDIENTE future` → `200` DTO has `customerId/vehicleId/serviceId/startDateTime/endDateTime/status:"CONFIRMADO"` and `not.toHaveProperty("estado"||"fecha_hora_inicio"||"cliente_id")`; spy `confirmAppointmentMock` called with `config` containing `timezone`/`capacityPerSlot` (INV-01/06)

## Phase 3: Verification (pure, no DB)

- [x] 3.1 Run `npx tsc --noEmit` — zero type errors (route `params: Promise<{id:string}>`, DTO camelCase, error helpers)
- [x] 3.2 Run `npx vitest run src/app/api/appointments/[id]/confirm/route.test.ts` — all 8+ cases green; verify auth-order (401 before 400) and snake-leak assertions pass
