# Design: T-028 Atomic Booking (T-028 + T-029)

## Technical Approach

Promote `createAppointment` from skeleton to atomic TX: `REPEATABLE READ` isolation → H-13 guards (ownership, service.active, duration inclusive) → `SELECT … FOR UPDATE` count < `capacityPerSlot` → `INSERT PENDIENTE`. The `EXCLUDE USING gist` constraint (0004 migration) is the DB-level safety net; the app-level count is primary. Both paths converge on `AppointmentNotAvailableError` → HTTP 409.

## Architecture Decisions

### Decision: Transaction Isolation Level Wiring

**Choice**: `db.transaction(async tx => { await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`); … })` as the first statement inside the TX callback.

**Alternatives considered**:
- `db.transaction(async tx => {}, { isolationLevel: 'repeatable read' })` — Drizzle v0.45 types accept this but the driver may silently ignore it on `node-postgres`; not reliably tested in this codebase.
- `pool.connect()` bypassing Drizzle — breaks `Tx` typing and DTO mappers; rejected.

**Rationale**: Explicit `SET TRANSACTION` inside the callback is self-documenting, portable across Drizzle versions, and is the pattern already in the exploration doc. The fallback is safe because the statement itself is the first executed in the TX.

### Decision: Capacity Check is Count-Based

**Choice**: `cnt >= deps.config.capacityPerSlot` → reject; `cnt <` → proceed.

**Alternatives considered**:
- Boolean overlap check (`exists`) — discards count, breaks `capacity > 1` future.
- EXCLUDE-only without app count — loses early 409 before INSERT; opaque PG error; harder to log `serviceId/date/slot`.

**Rationale**: Spec INV-01 demands count-based. DI `capacityPerSlot` (default 1, future configurable) is already in `WorkshopConfig`. Hardcoding `cnt >= 1` would violate INV-01; the DI path is required.

### Decision: Repo Helper — `countActiveOverlappingForUpdate`

**Choice**: `turnos.ts` exposes `countActiveOverlappingForUpdate(tx: Tx, range: {fromUtc: Date, toUtc: Date}): Promise<number>` using raw SQL with `FOR UPDATE`.

**Alternatives considered**:
- Inline the query in `appointmentService.ts` — forks the `tstzrange &&` pattern; repo should own SQL.
- Reuse `findActiveTurnosByDateRange` — does not acquire locks; using it inside a TX would be a read-leak.

**Rationale**: Dedicated TX helper with `FOR UPDATE` keeps the lock semantics visible and testable. The existing `findActiveTurnosByDateRange` stays read-only (correct for `GET /availability`). No shared helper between read and write paths.

### Decision: 23P01 Catch Location

**Choice**: Outer catch in `appointmentService.createAppointment` wraps the entire `db.transaction(…)` block; maps `hasPgCode(e, '23P01') → AppointmentNotAvailableError`. Repository `createTurno` catches only `23503` (FK).

**Alternatives considered**:
- Catch 23P01 inside `createTurno` — would require `DbOrTx` over `Db`; conflates repo concern (single INSERT) with app-level concurrency.
- Catch 23P01 in route — leaks PG-specific code to HTTP layer.

**Rationale**: Service layer is the correct boundary: it already catches domain errors from repo; 23P01 from the EXCLUDE constraint is a concurrency signal, not a FK/UNIQUE structural error. Single catch surface.

## Data Flow

```
POST /api/appointments
         │
         ▼
requireAuth(req) ──throws──► 401 UNAUTHORIZED
         │ OK
         ▼
Zod strict parse ──throws──► 400 VALIDATION_ERROR
         │ OK
         ▼
createAppointment(deps, {vehicleId, serviceId, startDateTime, authUser})
         │
         ▼
db.transaction(async tx => {
  SET TRANSACTION ISOLATION LEVEL REPEATABLE READ
         │
         ├── findVehiculoById(tx, vehicleId) ──null──► ValidationError 400
         │
         ├── assertOwnership(vehiculo.customerId, authUser) ──throws──► ForbiddenError 403
         │
         ├── findServicioById(tx, serviceId) ──null──► ValidationError 400
         │
         ├── servicio.active===true? ──false──► InvalidServiceError 400
         │
         ├── calculateEndAndValidate({start, durationMinutes, config})
         │            │ valid=false ──throws──► ValidationError 400
         │            │ valid=true, endDateTime
         │
         ├── countActiveOverlappingForUpdate(tx, {fromUtc:start, toUtc:endDateTime})
         │            │ cnt >= capacityPerSlot ──throws──► AppointmentNotAvailableError
         │
         └── tx.insert(turnos).values({…, estado:'PENDIENTE'}).returning()
                   │ success ──► TurnoDTO
                   │ 23P01 ──► outer catch → AppointmentNotAvailableError
})
         │
         ▼
NextResponse.json(dto, {status:201})  │  409/400/403/404
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/services/appointmentService.ts` | Modify | Extend `AppointmentServiceDeps.config` with `capacityPerSlot`; replace skeleton `TODO T-028` with `db.transaction` atomic block (SET TX, H-13 guards, count FOR UPDATE, INSERT); outer 23P01→409 catch |
| `src/db/repositories/turnos.ts` | Modify | Add `countActiveOverlappingForUpdate(tx, range)` using raw `SELECT count(*) WHERE tstzrange && FOR UPDATE`; add `hasPgCode(e,'23P01')` catch in `createTurno` INSERT path |
| `src/app/api/appointments/route.ts` | Create | Thin POST handler: `requireAuth`, Zod strict, call `createAppointment`, map `AppointmentNotAvailableError→409`, `InvalidServiceError→400`, `ForbiddenError→403`, `ValidationError→400`, else rethrow |
| `src/services/__tests__/appointmentService.test.ts` | Modify | Add TX-mocked unit tests: `cnt >= capacity → throws`, `cnt < capacity → inserts`, `23P01 synthetic → throws`, `H-13 order (ForbiddenError before lock)` |
| `tests/integration/appointmentConcurrency.test.ts` | Create | `describe.skipIf(!process.env.DATABASE_URL)` — seed vehiculo+servicio, `Promise.allSettled([createAppt(tx1), createAppt(tx2)])` same slot capacity=1, assert `1 fulfilled + 1 rejected APPOINTMENT_NOT_AVAILABLE`; adjacent slots do not collide |

## Interface Contracts

### `AppointmentServiceDeps.config` extension

```ts
// Before (T-027)
config: Pick<WorkshopConfig, 'timezone' | 'operatingHours'>;

// After (T-028)
config: Pick<WorkshopConfig, 'timezone' | 'operatingHours' | 'capacityPerSlot'>;
```

### `countActiveOverlappingForUpdate`

```ts
function countActiveOverlappingForUpdate(
  tx: Tx,
  range: { fromUtc: Date; toUtc: Date },
): Promise<number>;
```

Query: `SELECT count(*)::int FROM turnos WHERE tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($1,$2) AND estado IN ('PENDIENTE','CONFIRMADO') FOR UPDATE`

### POST /api/appointments

Request:
```json
{ "vehicleId": "uuid", "serviceId": "uuid", "startDateTime": "2026-09-10T09:00:00-03:00" }
```

Response 201: `TurnoDTO`
Response 400: `{ error: { code: "VALIDATION_ERROR"|"INVALID_SERVICE", message } }`
Response 403: `{ error: { code: "FORBIDDEN", message } }`
Response 409: `{ error: { code: "APPOINTMENT_NOT_AVAILABLE", message: "El horario seleccionado ya no se encuentra disponible." } }`

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `cnt >= capacity → throws` | Mock `tx.execute` returning `{ rows: [{ cnt: 1 }] }`; call `createAppointment`; assert `AppointmentNotAvailableError` |
| Unit | `cnt < capacity → inserts` | Mock `tx.execute` returning `{ rows: [{ cnt: 0 }] }`; mock `tx.insert`; assert DTO returned |
| Unit | `23P01 → same 409` | Mock `tx.insert` throwing synthetic `{ code: '23P01' }`; assert `AppointmentNotAvailableError` |
| Unit | H-13 order | Mock `findVehiculoById` returning non-owner; assert `ForbiddenError` thrown before any lock acquired |
| Integration | 2-worker same slot, capacity=1 | Real PG, seed, `Promise.allSettled([appt(tx1), appt(tx2)])`, assert `1 fulfilled + 1 rejected` with code `APPOINTMENT_NOT_AVAILABLE` |
| Integration | Adjacent slots no collision | Existing 10-11, request 11-12; both succeed |

## Concurrency Test Harness

```ts
// tests/integration/appointmentConcurrency.test.ts
describe.skipIf(!process.env.DATABASE_URL)('T-029 two-worker concurrency', () => {
  it('1 × 201 + 1 × 409 for same slot capacity=1', async () => {
    const seed = await seedFixture(); // vehiculo + active servicio + BA slot 10:00
    const results = await Promise.allSettled([
      createAppointment({ ...deps, db, config }, { vehicleId: seed.v1, serviceId: seed.svc, startDateTime: seed.slot10, authUser: seed.owner1 }),
      createAppointment({ ...deps, db, config }, { vehicleId: seed.v2, serviceId: seed.svc, startDateTime: seed.slot10, authUser: seed.owner2 }),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected  = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as any).reason.code).toBe('APPOINTMENT_NOT_AVAILABLE');
    const count = await db.select().from(turnos).where(/* same slot */);
    expect(count).toHaveLength(1);
  });
});
```

**PG requirement note**: `describe.skipIf(!process.env.DATABASE_URL)` gates this test. Run with `docker compose up db` + `DATABASE_URL`. The `vitest concurrent` flag alone does NOT simulate PG row locks — it only exercises Node event-loop interleaving.

## Migration / Rollback

No new migration. `0004_graceful_james_howlett.sql` already has `EXCLUDE USING gist`. Rollback: revert `appointmentService.ts` to `TODO T-028` skeleton, remove `countActiveOverlappingForUpdate` from `turnos.ts` (keep 23P01 catch), delete `route.ts`. Keep migration.

## Open Questions

- [ ] None — all decisions resolved in proposal/exploration phases.
