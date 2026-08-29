# Delta for Appointment — T-034 Lifecycle Tests

## ADDED Requirements

### Requirement: Exhaustive RN-07 Matrix via canTransition — Pure Unit

MUST gate via `canTransition(from,to,role,opts?)` per RN-07. `AppointmentStatus` SHALL be `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO`. `to=CANCELADO` with opts MUST enforce `now.getTime()<start.getTime()` strict `<`.

| from | to | role | ok |
|------|----|------|----|
| PENDIENTE | CONFIRMADO | ADMINISTRADOR | yes |
| PENDIENTE | RECHAZADO | ADMINISTRADOR | yes |
| PENDIENTE | CANCELADO | CLIENTE,ADMIN | if `now<start` |
| CONFIRMADO | CANCELADO | CLIENTE,ADMIN | if `now<start` |
| RECHAZADO,CANCELADO | * | * | no |
| * | COMPLETADO | * | no |

#### Scenario: 32-cell matrix
- GIVEN `from`×`to` in 4 statuses × `role` 2 (32 combos)
- WHEN `canTransition(from,to,role)` no opts
- THEN `true` for 4 allowed, `false` for 28 others

#### Scenario: Time guard strict <
- GIVEN `PENDIENTE|CONFIRMADO->CANCELADO`, allowed role, `start=12:00Z` (09:00 BA)
- WHEN opts `now=11:59Z` vs `12:00Z` vs `12:00:01Z`
- THEN `true` / `false` / `false`

#### Scenario: Terminals and COMPLETADO
- GIVEN `from` in `RECHAZADO|CANCELADO` or `to=COMPLETADO`
- WHEN any role/opts
- THEN `false`; `isTerminal` true for terminals

### Requirement: Lifecycle Chains via AppointmentService — Mocked

SHALL prove chains via mocked `DbOrTx` (`findTurnoById`,`updateTurnoStatus`) with `deps:{db:mock,config,now}` without DB. Each MUST call `updateTurnoStatus`.

#### Scenario: PENDIENTE->CONFIRMADO ADMIN
- GIVEN mocked `PENDIENTE` future `start=12:00Z`, `now=11:59Z`
- WHEN `confirmAppointment(deps,id,ADMIN)`
- THEN `status=CONFIRMADO`, `updateTurnoStatus(id,"CONFIRMADO")`

#### Scenario: PENDIENTE->RECHAZADO ADMIN
- GIVEN same mocked future PENDIENTE
- WHEN `rejectAppointment(deps,id,ADMIN)`
- THEN `status=RECHAZADO`, `updateTurnoStatus(id,"RECHAZADO")`

#### Scenario: PENDIENTE->CANCELADO owner
- GIVEN mocked future PENDIENTE owned by CLIENTE
- WHEN `cancelAppointment(deps,id,owner)` `now<start`
- THEN `status=CANCELADO` via `canTransition({now,start})`

#### Scenario: CONFIRMADO->CANCELADO owner and ADMIN
- GIVEN mocked future `CONFIRMADO` owned by CLIENTE, `now=11:59Z`
- WHEN `cancelAppointment` as owner and as ADMIN
- THEN both `status=CANCELADO`

### Requirement: Invalid Transitions 409 via Service

MUST reject invalid via `InvalidAppointmentStateError` `409 INVALID_APPOINTMENT_STATE` (`Cannot transition ...`). No `updateTurnoStatus`.

#### Scenario: Four invalids 409
- GIVEN future `CONFIRMADO|RECHAZADO|CANCELADO|PENDIENTE` `now<start`
- WHEN `CONFIRMADO->CONFIRMADO`, `RECHAZADO->CONFIRMADO`, `CANCELADO->CONFIRMADO`, `PENDIENTE->PENDIENTE`
- THEN each throws `409` containing `Cannot transition`

#### Scenario: Terminal cancel 409
- GIVEN `RECHAZADO|CANCELADO` owned, `now<start`
- WHEN `cancelAppointment`
- THEN `409 INVALID_APPOINTMENT_STATE`

### Requirement: H-12 UTC Borders — BA (EC-03)

MUST enforce `now<start` via `getTime()` strict `<` with `deps.now`; `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` for conversion. `start=09:00 BA=12:00Z`. Allow `11:59Z` only; reject `12:00Z` and `12:00:01Z` with `409 "El turno ya comenzó"`. Store `TIMESTAMPTZ` UTC.

#### Scenario: Cancel borders owner
- GIVEN `start=12:00Z` owned `PENDIENTE|CONFIRMADO`
- WHEN `cancelAppointment` with `now=11:59Z` vs `12:00Z` vs `12:00:01Z`
- THEN `200 CANCELADO` / `409 "El turno ya comenzó"` / `409`

#### Scenario: Confirm borders ADMIN
- GIVEN `start=12:00Z` `PENDIENTE`, ADMIN
- WHEN `confirmAppointment` with `now=11:59Z` vs `12:00Z` vs `12:00:01Z`
- THEN `200 CONFIRMADO` / `409 "El turno ya comenzó"` / `409`

#### Scenario: EC-03 CONFIRMADO past cancel
- GIVEN `CONFIRMADO` `start=12:00Z`, `now=12:00Z` or `12:00:01Z`
- WHEN `cancelAppointment` owner
- THEN `409 "El turno ya comenzó"` no update

### Requirement: H-13 Guards Before Lock — createAppointment

MUST enforce H-13 before `countActiveOverlappingForUpdate`. Order SHALL be `findVehiculoById->assertOwnership->findServicioById->active->calculateEndAndValidate->FOR UPDATE`. Failures MUST NOT reach lock.

#### Scenario: Inactive service 400 before lock
- GIVEN `vehiculo.customerId==authUser.id`, `servicio.active=false`
- WHEN `createAppointment(deps,input)`
- THEN `400 INVALID_SERVICE` and lock not called

#### Scenario: Foreign vehicle 403 before lock
- GIVEN `vehiculo.customerId != authUser.id`
- WHEN `createAppointment` CLIENTE
- THEN `403 FORBIDDEN` and lock not called

### Requirement: H-11/EC-04 Visibility RN-04 via Flags

MUST implement `listAppointments` RN-04 via mocked `findTurnosPaginated`. Default hides `CANCELADO|RECHAZADO` (only `PENDIENTE|CONFIRMADO` where `start>now`). Flags default `false`. CLIENTE injects `customerId`; ADMIN sees all. No DB via `vitest` mocked `DbOrTx`.

#### Scenario: Default hides RECHAZADO/CANCELADO
- GIVEN `listAppointments(CLIENTE,{},auth)` no flags
- WHEN `findTurnosPaginated` called
- THEN args `customerId`, `includeCancelled=false`, `includeRejected=false`, `now`; excludes both

#### Scenario: Flags opt-in
- GIVEN same data
- WHEN `includeCancelled:true` vs `includeRejected:true`
- THEN forwards flag; includes each

#### Scenario: RECHAZADO non-active
- GIVEN future `RECHAZADO` `start>now`
- WHEN default vs `includeRejected:true` (CLIENTE/ADMIN)
- THEN default excludes, flag includes; never active
