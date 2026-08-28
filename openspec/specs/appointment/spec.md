# Delta for Appointment — T-027

> `canTransition` + thin `AppointmentService` skeleton (RN-07/INV-02/03/05/06/08). Concurrency (`REPEATABLE READ`/`SELECT FOR UPDATE`/`EXCLUDE`) out of scope — `TODO T-028`.

## ADDED Requirements

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

The system MUST validate `createAppointment` input, `servicio.activo==true`, ownership via `assertOwnership`, `durationMinutes` via `calculateEndAndValidate`, `fechaHoraFin <= finIntervaloOperativo` inclusive (INV-05). Store `TIMESTAMPTZ` UTC via `WorkshopConfig.timezone`. No atomics (`TODO T-028`).

#### Scenario: Inclusive close passes
- GIVEN config `09:00-12:00/14:00-18:00`, `60min`, `start=2026-09-10T11:00:00-03:00` BA→UTC
- WHEN `createAppointment` validates activo/ownership, computes `fechaHoraFin=start+60`
- THEN `11:00+60==12:00` satisfies `<=` and persists UTC

#### Scenario: Reject inactive, foreign vehicle, close-crossing
- GIVEN `servicio.activo=false` OR `vehiculo.customerId!=authUser.id` OR `11:30+90>12:00`
- WHEN `createAppointment` called
- THEN `VALIDATION_ERROR`/`INVALID_SERVICE` vs `FORBIDDEN` vs `VALIDATION_ERROR`; no INSERT

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

The system MUST use `VALIDATION_ERROR` 400, `INVALID_APPOINTMENT_STATE` 409, `APPOINTMENT_NOT_FOUND` 404 as `{error:{code,message}}`. `APPOINTMENT_NOT_AVAILABLE`/`23P01` deferred to T-028.

#### Scenario: Shapes
- GIVEN bad input vs invalid transition/past vs unknown id
- WHEN `create` vs `confirm` terminal vs `getById` missing
- THEN `400 VALIDATION_ERROR` vs `409 INVALID_APPOINTMENT_STATE` vs `404 APPOINTMENT_NOT_FOUND`

#### Scenario: Skeleton does not throw concurrency error
- GIVEN concurrent `createAppointment` same slot
- WHEN skeleton runs (no `SELECT FOR UPDATE`)
- THEN no `APPOINTMENT_NOT_AVAILABLE` — `TODO T-028`
