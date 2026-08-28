# Delta for Appointment

## ADDED Requirements

### Requirement: Cancel Appointment PENDIENTE|CONFIRMADO → CANCELADO (T-032, RN-07)

The system MUST expose `PATCH /api/appointments/{id}/cancel` that transitions `PENDIENTE → CANCELADO` and `CONFIRMADO → CANCELADO` via `canTransition(from, CANCELADO, role, {now, startDateTime})` only when `now < startDateTime` UTC (`WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, INV-06) and requester is owner `CLIENTE` (`turno.customerId == authUser.id`) or `ADMINISTRADOR` bypass. The route MUST be thin (`server-only`, no body) delegating to `cancelAppointment({db, config}, id, authUser)` which owns `assertOwnership → ensureFuture → canTransition → updateTurnoStatus → toTurnoDTO` (INV-08, §4.5 single owner). Order MUST be `requireAuth → uuidSchema.parse(id) → service`; no `assertRole`, no capacity/`FOR UPDATE`/`EXCLUDE` logic. Success MUST return `200` `TurnoDTO` camelCase `status:CANCELADO`; errors MUST use §12 envelope `{error:{code,message,issues?}}`.

#### Scenario: Happy path — owner CLIENTE cancels future PENDIENTE

- GIVEN authenticated owner `CLIENTE` and appointment `status=PENDIENTE` with `now < startDateTime` UTC
- WHEN `PATCH /api/appointments/{id}/cancel` with valid UUID and no body
- THEN response is `200` with `TurnoDTO {id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status:"CANCELADO"}` and no `estado`/`fecha_hora_inicio` leak

#### Scenario: Happy path — ADMIN cancels future CONFIRMADO (any owner)

- GIVEN authenticated `ADMINISTRADOR` and appointment `status=CONFIRMADO` with `now < startDateTime` UTC
- WHEN `PATCH /api/appointments/{id}/cancel` with valid UUID
- THEN response is `200` with `TurnoDTO status:"CANCELADO"` via `toTurnoDTO`; no snake leak

#### Scenario: Ownership-first — non-owner CLIENTE blocked before time guard

- GIVEN `PENDIENTE` future owned by `customerA` and authenticated non-owner `CLIENTE customerB`
- WHEN `PATCH /api/appointments/{id}/cancel` (even if `now >= startDateTime`)
- THEN response is `403` `{error:{code:"FORBIDDEN",message}}` from `assertOwnership` before `ensureFuture`; no timing oracle

#### Scenario: Unauthenticated — 401 before 400

- GIVEN no valid `authjs.session-token` JWT and any `id` (even malformed UUID)
- WHEN `PATCH /api/appointments/{id}/cancel`
- THEN response is `401` `{error:{code:"UNAUTHORIZED",message}}` before UUID or service checks

#### Scenario: Invalid identifier — malformed UUID

- GIVEN authenticated owner `CLIENTE` or `ADMINISTRADOR`
- WHEN `PATCH /api/appointments/{id}/cancel` with `id` not matching UUID v4
- THEN response is `400` `{error:{code:"VALIDATION_ERROR",message,issues}}` via Zod

#### Scenario: Not found — unknown appointment

- GIVEN authenticated user and UUID not in `turnos` table
- WHEN `PATCH /api/appointments/{id}/cancel`
- THEN response is `404` `{error:{code:"NOT_FOUND",message}}`

#### Scenario: Wrong state — terminal or non-cancelable rejected as 409

- GIVEN authenticated owner/ADMIN and appointment `status` in `RECHAZADO|CANCELADO`
- WHEN `PATCH /api/appointments/{id}/cancel` with valid UUID and `now < startDateTime`
- THEN response is `409` `{error:{code:"INVALID_APPOINTMENT_STATE",message}}` and no mutation

#### Scenario: Already started — H-12 borders now >= startDateTime

- GIVEN appointment `startDateTime=09:00:00-03:00` (UTC `12:00:00Z`) and injected `now` UTC
- WHEN `cancel` with `now=08:59-03:00` vs `09:00:00-03:00` vs `09:00:01-03:00`
- THEN `08:59` → `200 CANCELADO`; `09:00:00` → `409 INVALID_APPOINTMENT_STATE "El turno ya comenzó"`; `09:00:01` → `409` same message, no mutation

