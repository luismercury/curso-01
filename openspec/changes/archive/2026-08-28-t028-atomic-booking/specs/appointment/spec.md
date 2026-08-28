# Delta for Appointment — T-028 Atomic Booking (T-028+T-029)

> Atomic TX promotion; T-029 now in scope. 6 prior ADDED remain.

## ADDED Requirements

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

## MODIFIED Requirements

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
