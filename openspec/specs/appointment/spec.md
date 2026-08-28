# Spec: Appointment — T-027 lifecycle + T-028 Atomic Booking (T-028+T-029)

> T-027 skeleton (RN-07/INV-02/03/05/06/08, 6 ADDED) + T-028 atomic promotion (INV-04/INV-01, 4 ADDED + 2 MODIFIED). Preserves T-027 state machine, query filters, time guard, DTO mapping; promotes create skeleton and error catalog to atomic transaction with REPEATABLE READ + SELECT FOR UPDATE count < capacityPerSlot + EXCLUDE USING gist 23P01 fallback + 2-worker guarantee + timezone UTC handling.

## Requirements

### Requirement: State Transition Matrix via canTransition (RN-07, INV-02)

The system MUST gate every change via `canTransition(from,to,role)` per RN-07. `AppointmentStatus` MUST be `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` (no `COMPLETADO`). Terminals `RECHAZADO`/`CANCELADO` deny all. Invalid → `INVALID_APPOINTMENT_STATE`.

| from | to | role | ok |
|------|----|------|----|
| PENDIENTE | CONFIRMADO | ADMINISTRADOR | yes |
| PENDIENTE | RECHAZADO | ADMINISTRADOR | yes |
| PENDIENTE | CANCELADO | owner CLIENTE/ADMIN | if `now < startDateTime` UTC |
| CONFIRMADO | CANCELADO | owner CLIENTE/ADMIN | if `now < startDateTime` UTC |
| RECHAZADO/CANCELADO | * | * | no |
| * | COMPLETADO | * | no |

#### Scenario: PENDIENTE→CONFIRMADO/RECHAZADO role-gated
- GIVEN `PENDIENTE` future `startDateTime` TIMESTAMPTZ UTC, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`
- WHEN `canTransition(PENDIENTE,CONFIRMADO,ADMIN)` vs `CLIENTE`
- THEN true for ADMIN, false → `INVALID_APPOINTMENT_STATE` for CLIENTE

#### Scenario: Cancel allow owner/admin, terminals blocked, COMPLETADO rejected
- GIVEN `PENDIENTE`/`CONFIRMADO` future vs `RECHAZADO`/`CANCELADO` vs `COMPLETADO`
- WHEN owner/admin `cancel` with `now < start` vs terminal `canTransition` vs `z.enum` parse
- THEN allow → `updateTurnoStatus`; terminals false → `INVALID_APPOINTMENT_STATE`; `COMPLETADO` fails Zod

### Requirement: Create Skeleton (validation only, defers atomicity)

The system MUST validate and create POST /api/appointments {vehicleId,serviceId,startDateTime} inside TX above, preserving H-13 order before FOR UPDATE: assertOwnership -> servicio.activo==true -> calculateEndAndValidate inclusive fechaHoraFin <= finIntervaloOperativo (INV-05) -> FOR UPDATE count -> INSERT PENDIENTE or 409. DI Pick<WorkshopConfig,'timezone'|'operatingHours'|'capacityPerSlot'>. Store TIMESTAMPTZ UTC.
(Previously: skeleton validated without atomics; deferred concurrency to TODO T-028.)

#### Scenario: Inclusive close passes
- GIVEN 09:00-12:00/14:00-18:00, 60min, start=2026-09-10T11:00:00-03:00 BA->UTC
- WHEN validates activo/ownership, fechaHoraFin=12:00
- THEN <= passes, proceeds to FOR UPDATE, persists UTC

#### Scenario: H-13 guards distinct from 409
- GIVEN customerId!=authUser vs activo=false vs 11:30+90>12:00
- WHEN createAppointment called
- THEN 403 FORBIDDEN vs 400 INVALID_SERVICE "Servicio no disponible" vs 400 VALIDATION_ERROR; none hits FOR UPDATE

### Requirement: Query Filters RN-04 with Pagination

The system MUST implement `list/findTurnos` per RN-04: default próximos=`PENDIENTE|CONFIRMADO` with `startDateTime > now` (UTC). `includeCancelled`/`includeRejected` default `false`. Pagination `limit<=100` default `20`, `page>=1`/`offset`, `sort=startAt:asc|desc` default `asc`. CLIENTE→own, ADMIN→all.

#### Scenario: Default hides CANCELADO/RECHAZADO, flags opt-in
- GIVEN mixed future turnos, `now` injected UTC
- WHEN `list({})` vs `list({includeCancelled:true})` vs `includeRejected:true`
- THEN default only `PENDIENTE|CONFIRMADO` with `start>now`; flags add each

#### Scenario: Pagination and sort
- GIVEN 25 future turnos ordered `fechaHoraInicio` UTC
- WHEN `list({page:2,limit:20,sort:"startAt:asc"})`
- THEN `{data:[5],pagination:{page:2,limit:20,total:25,totalPages:2}}`; `limit:101` → `VALIDATION_ERROR`

### Requirement: Cancel Time Guard now < startDateTime (RN-05, INV-06)

The system MUST enforce `now < startDateTime` via UTC `getTime()` with injected `now`. `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` for conversion only. Fail → `INVALID_APPOINTMENT_STATE` "El turno ya comenzó". Borders `08:59` allow, `09:00:00`/`09:00:01` reject.

#### Scenario: Borders 08:59/09:00:00/09:00:01
- GIVEN turno `09:00:00-03:00` UTC, clock injected
- WHEN `cancel` with `now=08:59` vs `09:00:00` vs `09:00:01` UTC
- THEN allow, then `INVALID_APPOINTMENT_STATE`, then `INVALID_APPOINTMENT_STATE`

#### Scenario: Ownership before time guard
- GIVEN `PENDIENTE` future owned by `customerA`
- WHEN non-owner CLIENTE vs owner vs ADMIN calls `cancel`
- THEN non-owner → `FORBIDDEN`; others proceed to time guard

### Requirement: DTO Mapping INV-08 (snake → camelCase English)

The system MUST return `TurnoDTO` camelCase via `toTurnoDTO`; DB snake MUST NOT leak. Write: `CreateTurnoInput` → DB remap + `turnoInputSchema`.

| DB | DTO |
|----|-----|
| `cliente_id` | `customerId` |
| `vehiculo_id` | `vehicleId` |
| `servicio_id` | `serviceId` |
| `fecha_hora_inicio` | `startDateTime` |
| `fecha_hora_fin` | `endDateTime` |
| `estado` | `status` |

#### Scenario: No snake leak
- GIVEN row `fecha_hora_inicio` UTC, `estado=PENDIENTE`
- WHEN `getById`/`list`/`confirm`/`cancel` returns
- THEN has `startDateTime`/`endDateTime`/`status`, no `fecha_hora_inicio`/`estado`

### Requirement: Error Catalog §12

The system MUST return {error:{code,message}} with VALIDATION_ERROR 400 (bad input, fechaHoraFin>finIntervalo, INVALID_SERVICE->400), FORBIDDEN 403, APPOINTMENT_NOT_AVAILABLE 409 (count>=capacity or 23P01), INVALID_APPOINTMENT_STATE 409, NOT_FOUND 404. 400 distinct from 409.
(Previously: APPOINTMENT_NOT_AVAILABLE/23P01 deferred to T-028.)

#### Scenario: Shapes per code
- GIVEN bad input vs foreign vehicle vs overlap vs unknown id
- WHEN create vs non-owner create vs concurrent second vs getById missing
- THEN 400 vs 403 vs 409 APPOINTMENT_NOT_AVAILABLE vs 404 each {error:{code,message}}

#### Scenario: 400 vs 409
- GIVEN 11:30 90min close 12:00 vs 09:30 overlapping 09:00-10:00
- WHEN each fails
- THEN 400 VALIDATION_ERROR vs 409 APPOINTMENT_NOT_AVAILABLE

### Requirement: Atomic Transaction Boundary with SELECT FOR UPDATE Capacity Gate

The system MUST create appointments in one REPEATABLE READ TX that validates H-13 order then SELECT count(*) WHERE tstzrange(fecha_hora_inicio,fecha_hora_fin) && tstzrange($1,$2) AND estado IN ('PENDIENTE','CONFIRMADO') FOR UPDATE and SHALL INSERT PENDIENTE only if count < capacityPerSlot (DI WorkshopConfig capacityPerSlot=1, slotStepMinutes=30, timezone BA), else ROLLBACK 409.

#### Scenario: Happy path atomic insert
- GIVEN capacityPerSlot=1, start=2026-09-10T10:00:00-03:00, duration=60, no overlap
- WHEN POST /api/appointments runs TX REPEATABLE READ + FOR UPDATE count 0<1
- THEN INSERT PENDIENTE TIMESTAMPTZ UTC, COMMIT 201 DTO startDateTime/endDateTime

#### Scenario: Capacity exceeded rolls back 409
- GIVEN existing PENDIENTE 09:00-10:00, request 09:30 60min (tstzrange && true, [) half-open)
- WHEN TX FOR UPDATE count 1>=1
- THEN ROLLBACK APPOINTMENT_NOT_AVAILABLE 409, no row

### Requirement: EXCLUDE Safety Net 23P01 Fallback

The system MUST map EXCLUDE USING gist (tstzrange WITH &&) WHERE estado IN ('PENDIENTE','CONFIRMADO') violation 23P01 to APPOINTMENT_NOT_AVAILABLE 409. Count check is primary; EXCLUDE defends capacity=1.

#### Scenario: EXCLUDE maps to 409
- GIVEN race bypasses count, INSERT raises hasPgCode(err,'23P01')
- WHEN outer catch sees 23P01
- THEN 409 {error:{code:"APPOINTMENT_NOT_AVAILABLE",message:"El horario seleccionado ya no se encuentra disponible."}}

#### Scenario: Non-23P01 not mis-mapped
- GIVEN 23514 CHECK or 23503 FK violation
- WHEN error code 23514/23503
- THEN not 409; 400 VALIDATION_ERROR or 404

### Requirement: Concurrency Two-Worker Guarantee (T-029)

The system MUST ensure 2 concurrent POST /api/appointments for same slot capacity=1 yield 1 201 and 1 409. Half-open [start,end): 09:00-10:00 blocks 09:30 not 10:00; adjacent 10:00-11:00 vs 11:00-12:00 no collide.

#### Scenario: Two workers same slot
- GIVEN slot 2026-09-10T10:00:00-03:00 60min, capacity=1, two owners
- WHEN Promise.allSettled([tx1,tx2]) concurrent REPEATABLE READ
- THEN one fulfilled PENDIENTE, one rejected 409, DB count 1

#### Scenario: Adjacent intervals no collision
- GIVEN existing 10:00-11:00 PENDIENTE, request 11:00-12:00
- WHEN TX checks tstzrange && ([10,11) && [11,12) false)
- THEN count 0<1 -> 201

### Requirement: Timezone UTC Handling (INV-06)

The system MUST accept startDateTime ISO 8601 with timezone, convert via WorkshopConfig.timezone BA (baWallTimeToUtcDate) to UTC TIMESTAMPTZ for tstzrange and persistence.

#### Scenario: BA wall to UTC range
- GIVEN start="2026-09-10T09:00:00-03:00", duration=60
- WHEN calculateEndAndValidate + TX tstzrange(startUtc,endUtc)
- THEN stored fecha_hora_inicio 12:00Z, fecha_hora_fin 13:00Z, overlap uses UTC

#### Scenario: DST oracle
- GIVEN BA date near DST transition
- WHEN getBaDayUtcRange delegates to converter
- THEN UTC range matches baWallTimeToUtcDate oracle

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
