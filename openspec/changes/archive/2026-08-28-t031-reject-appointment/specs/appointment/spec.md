# Delta for Appointment

## ADDED Requirements

### Requirement: Reject Appointment PENDIENTE → RECHAZADO (T-031, RN-07)

The system MUST expose `PATCH /api/appointments/{id}/reject` that transitions `PENDIENTE → RECHAZADO` via `canTransition(PENDIENTE, RECHAZADO, ADMINISTRADOR)` only (INV-02/RN-07). The route MUST be thin (`server-only`, no body) delegating to `rejectAppointment` which owns `now < startDateTime` (INV-06, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, UTC comparison) and MUST return `TurnoDTO` camelCase via `toTurnoDTO` (INV-08) with no `estado`/`fecha_hora_inicio` leak. Errors MUST use §12 envelope `{error:{code,message}}` with `issues` for Zod failures. Order MUST be `requireAuth → assertRole(ADMINISTRADOR) → uuid → service`; no capacity/`FOR UPDATE`/`EXCLUDE` logic.

#### Scenario: Happy path — ADMIN rejects future PENDIENTE

- GIVEN authenticated `ADMINISTRADOR` and appointment `status=PENDIENTE` with `now < startDateTime` UTC
- WHEN `PATCH /api/appointments/{id}/reject` with valid UUID and no body
- THEN response is `200` with `TurnoDTO {id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status:"RECHAZADO"}` and no `estado`/`fecha_hora_inicio` leak

#### Scenario: Forbidden — CLIENTE cannot reject

- GIVEN authenticated `CLIENTE` and appointment `status=PENDIENTE` future
- WHEN `PATCH /api/appointments/{id}/reject` with valid UUID
- THEN response is `403` `{error:{code:"FORBIDDEN",message}}` via `assertRole` before service; `canTransition` remains defense-in-depth

#### Scenario: Unauthenticated — missing/invalid JWT before validation

- GIVEN no valid `authjs.session-token` JWT and any `id` (even malformed UUID)
- WHEN `PATCH /api/appointments/{id}/reject`
- THEN response is `401` `{error:{code:"UNAUTHORIZED",message}}` before UUID or service checks

#### Scenario: Invalid identifier — malformed UUID

- GIVEN authenticated `ADMINISTRADOR`
- WHEN `PATCH /api/appointments/{id}/reject` with `id` not matching UUID v4
- THEN response is `400` `{error:{code:"VALIDATION_ERROR",message,issues}}` via Zod

#### Scenario: Not found — unknown appointment

- GIVEN authenticated `ADMINISTRADOR` and UUID not in `turnos` table
- WHEN `PATCH /api/appointments/{id}/reject`
- THEN response is `404` `{error:{code:"NOT_FOUND",message}}`

#### Scenario: Wrong state — non-PENDIENTE or terminal rejected

- GIVEN authenticated `ADMINISTRADOR` and appointment `status` in `CONFIRMADO|RECHAZADO|CANCELADO`
- WHEN `PATCH /api/appointments/{id}/reject` with valid UUID
- THEN response is `409` `{error:{code:"INVALID_APPOINTMENT_STATE",message}}` and no state mutation

#### Scenario: Already started — now >= startDateTime

- GIVEN authenticated `ADMINISTRADOR`, appointment `PENDIENTE` with `startDateTime` UTC, injected `now >= startDateTime`
- WHEN `PATCH /api/appointments/{id}/reject`
- THEN response is `409` `{error:{code:"INVALID_APPOINTMENT_STATE",message:"El turno ya comenzó"}}` and no mutation
