# Delta for appointment

## ADDED Requirements

### Requirement: Confirm Appointment PENDIENTE -> CONFIRMADO (T-030, RN-07)

The system MUST expose `PATCH /api/appointments/{id}/confirm` that transitions `PENDIENTE -> CONFIRMADO` via `canTransition(PENDIENTE, CONFIRMADO, ADMINISTRADOR)` only. The system MUST enforce injected `now < startDateTime` UTC comparison (`WorkshopConfig.timezone = America/Argentina/Buenos_Aires`) and MUST return `TurnoDTO` camelCase via `toTurnoDTO` (INV-08) on success. Errors MUST use §12 envelope `{error:{code,message}}`.

#### Scenario: Happy path — ADMIN confirms future PENDIENTE

- GIVEN authenticated `ADMINISTRADOR` and appointment `estado=PENDIENTE` with `now < startDateTime` UTC
- WHEN `PATCH /api/appointments/{id}/confirm` with valid UUID and no body
- THEN response is `200` with `TurnoDTO {id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status:"CONFIRMADO"}` and no `estado`/`fecha_hora_inicio` leak

#### Scenario: Wrong state — non-PENDIENTE rejected as 409

- GIVEN authenticated `ADMINISTRADOR` and appointment `estado` in `CONFIRMADO|RECHAZADO|CANCELADO`
- WHEN `PATCH /api/appointments/{id}/confirm` with valid UUID
- THEN response is `409` `{error:{code:"INVALID_APPOINTMENT_STATE",message}}` and no state mutation

#### Scenario: Forbidden — CLIENTE cannot confirm

- GIVEN authenticated `CLIENTE` and appointment `estado=PENDIENTE` future
- WHEN `PATCH /api/appointments/{id}/confirm` with valid UUID
- THEN response is `403` `{error:{code:"FORBIDDEN",message}}` via `assertRole` before service; service `canTransition` remains safety net

#### Scenario: Unauthenticated — missing/invalid JWT

- GIVEN no valid `authjs.session-token` JWT
- WHEN `PATCH /api/appointments/{id}/confirm`
- THEN response is `401` `{error:{code:"UNAUTHORIZED",message}}` before any validation

#### Scenario: Invalid identifier — malformed UUID

- GIVEN authenticated `ADMINISTRADOR`
- WHEN `PATCH /api/appointments/{id}/confirm` with `id` not matching UUID v4
- THEN response is `400` `{error:{code:"VALIDATION_ERROR",message}}` with `issues` via Zod

#### Scenario: Not found — unknown appointment

- GIVEN authenticated `ADMINISTRADOR` and UUID not in `turnos` table
- WHEN `PATCH /api/appointments/{id}/confirm`
- THEN response is `404` `{error:{code:"NOT_FOUND",message}}`

#### Scenario: Already started — now >= startDateTime

- GIVEN authenticated `ADMINISTRADOR`, appointment `PENDIENTE` with `startDateTime` UTC, injected `now >= startDateTime`
- WHEN `PATCH /api/appointments/{id}/confirm`
- THEN response is `409` `{error:{code:"INVALID_APPOINTMENT_STATE",message:"El turno ya comenzó"}}` and no mutation
