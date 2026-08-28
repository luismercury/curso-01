# Exploration: t028-atomic-booking — Atomic Appointment Creation (T-028+T-029)

## Current State

**Scope (H-13 + INV-04/05/06):** `T-028` creates `POST /api/appointments {vehicleId, serviceId, startDateTime}` as a blocking transaction `BEGIN ISOLATION LEVEL REPEATABLE READ → SELECT FOR UPDATE tstzrange && WHERE estado IN ('PENDIENTE','CONFIRMADO') → count < capacityPerSlot → INSERT PENDIENTE COMMIT` with `23P01 EXCLUDE → APPOINTMENT_NOT_AVAILABLE`. `T-029` is the same TX verified by a 2-worker concurrent test (capacity=1, 1 ok / 1 409). Depends on `T-027 (DONE)`, `T-051 (auth)`, `T-019b (WorkshopConfig)` — all satisfied.

**Frozen skeleton today (verified on disk):**

- `src/services/appointmentService.ts:62-120` `createAppointment(deps, input)` is a validated skeleton without atomics. Flow: `Zod createInputSchema → findVehiculoById → assertOwnership(customerId, authUser) → findServicioById → servicio.active==true else InvalidServiceError → calculateEndAndValidate({start, durationMinutes, config}) inclusive `<=` (INV-05) → TODO T-028 → createTurno(db, {customerId, vehicleId, serviceId, startDateTime, status:PENDIENTE}, config)`. No `db.transaction`, no `REPEATABLE READ`, no `FOR UPDATE`, no `23P01` catch. H-13 order is correct (ownership before servicio.active before duration). `deps: {db: DbOrTx, config: Pick<WorkshopConfig,'timezone'|'operatingHours'>, now?}` is missing `capacityPerSlot/slotStepMinutes` — T-028 must extend it.
- `src/db/repositories/turnos.ts` is thin single-statement. `createTurno(db,input,config)` resolves `servicio.duracionMinutos`, calls `calculateEndAndValidate`, inserts via `db.insert(turnos).values(validated).returning()` + `toTurnoDTO`. Maps `23503 FK → TurnoForeignKeyError` but does NOT map `23P01 EXCLUDE → AppointmentNotAvailableError` (that mapping exists only in `updateTurnoStatus`). `findActiveTurnosByDateRange(dbOrTx, {fromUtc,toUtc})` already implements `tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($1,$2) AND estado IN ('PENDIENTE','CONFIRMADO')` returning `ExistingEntry[]`; reusable inside TX. Guard in `turnos.test.ts:214-225` asserts stripped file has no `FOR UPDATE/REPEATABLE READ` — intentionally deferred.
- `src/db/schema.ts` `turnos` has `idx_turno_*`, CHECKs, FKs `RESTRICT`, `TIMESTAMPTZ`. `drizzle/0004_graceful_james_howlett.sql:8` is `EXCLUDE USING gist (tstzrange(fecha_hora_inicio, fecha_hora_fin) WITH &&) WHERE (estado IN ('PENDIENTE','CONFIRMADO'))` + `CREATE EXTENSION btree_gist`. Drizzle has no EXCLUDE DSL — constraint is manual and verified via `pg_constraint contype='x'` tests. This is the DB safety net for capacity=1.
- `src/domain/appointmentStateMachine.ts` pure `canTransition` owned by T-027 — not touched by T-028 but reused for transition errors.
- `src/services/availability/{overlap,duration,slotGenerator,availabilityService}` pure DST-aware stack DI'd with `WorkshopConfig`. `overlap.ACTIVE_STATUSES`, `isSlotAvailable(count < capacity)`, `duration.calculateEndAndValidate` + `baWallTimeToUtcDate` are the canonical building blocks T-028 must call (not duplicate).
- `src/db/index.ts:14-17` exports `db: Drizzle<Pool>`, `Tx`, `DbOrTx`. `drizzle@0.45.2` on `pg@8.23`. `drizzle-orm/node-postgres` `db.transaction(cb, opts?)` supports `{isolationLevel:'repeatable read'}` in this range; fallback is `tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`)` before queries.
- `src/config/workshopConfig.ts` frozen DI: `capacityPerSlot=1`, `slotStepMinutes=30`, `timezone=America/Argentina/Buenos_Aires`. `workshopSchedule.ts` owns `DEFAULT_OPERATING_INTERVALS 09:00-12:00/14:00-18:00` + `getOperatingIntervalsForDate(date,config)` — the `finIntervaloOperativo` source.
- `src/lib/errors.ts:21-43` central `PG_CODES {23P01,23514,23503,23505}` + `hasPgCode(err,code)` walking `cause` chain (Drizzle wraps driver). `src/services/errors.ts:111` `AppointmentNotAvailableError.code=APPOINTMENT_NOT_AVAILABLE` already maps `23P01 → 409`.

### Affected Areas

- `src/services/appointmentService.ts` — **PRIMARY.** Replace TODO with `db.transaction(async tx => {...})` atomic flow: re-validate inside TX (or pass validated dates in), compute `endDateTime`, `SELECT FOR UPDATE` count, `INSERT` or `ROLLBACK + throw AppointmentNotAvailableError`. Must extend `AppointmentServiceDeps.config` to `Pick<WorkshopConfig,'timezone'|'operatingHours'|'capacityPerSlot'|'slotStepMinutes'>` and accept `capacityPerSlot` via DI. Export atomic function as `createAppointment` (single mutation, no new file) to keep `AppointmentService` as sole owner per H-19. Map `23P01` on INSERT path.
- `src/db/repositories/turnos.ts` — **EXTEND, keep thin.** Add TX helper `countActiveOverlappingForUpdate(tx, {fromUtc:Date,toUtc:Date}) → number` or `findActiveTurnosForUpdate(tx, range)` using `sql`tstzrange(...) && tstzrange(...) AND estado IN (...) FOR UPDATE``. Alternatively inline raw SQL in service (preferred to keep repo thin — decide in design). Add `hasPgCode(error,'23P01') → AppointmentNotAvailableError` to `createTurno` path (currently only on `updateTurnoStatus`). Keep signature `(db: DbOrTx)` so TX passes without breaking existing tests. No business logic in repo.
- `src/config/workshopConfig.ts` — **READ-ONLY consumer.** T-028 reads `capacityPerSlot/slotStepMinutes/timezone` via DI; no schema change. T-036b DB-backed provider remains future.
- `src/services/availability/duration.ts` + `overlap.ts` — **CONSUME.** `calculateEndAndValidate` stays sole duration validator; `findActiveTurnosByDateRange` pattern stays but must gain `FOR UPDATE` variant. Do not fork duration logic.
- `src/app/api/appointments/route.ts` — **ADAPTER (T-028 creates).** Route currently absent; it will thinly call `createAppointment` and map `AppointmentNotAvailableError→409`, `InvalidServiceError→400`, `ForbiddenError→403`, `ValidationError→400`, `hasPgCode 23P01→409`. No logic beyond HTTP translation.
- `src/lib/errors.ts` + `src/services/errors.ts` — **MINOR EXTEND.** Already have `23P01` constant; add detection for serialization failures `40001`/`40P01` if `SERIALIZABLE` fallback is offered (retry or same 409). No new error codes needed.
- `src/services/__tests__/appointmentService.test.ts` + `src/db/repositories/turnos.test.ts` + new `tests/integration/appointmentConcurrency.test.ts` — **TEST SURFACE.** Unit tests remain mocked; new integration concurrency test is the acceptance gate for T-029.

### Approaches

1. **Drizzle TX + SELECT FOR UPDATE + count < capacity + EXCLUDE as safety net (hybrid, spec §10) — recommended baseline**
   - Pros: Matches `Technical-spec.md §10` SQL block exactly; `REPEATABLE READ` + `SELECT ... FOR UPDATE` serializes the read-modify-write window; count-based `count < capacityPerSlot` supports future `capacity>1` while `EXCLUDE USING gist ... WHERE estado IN (...)` defends `capacity=1` at DB level even if app lock is bypassed; `23P01` catch converts EXCLUDE violation to same `APPOINTMENT_NOT_AVAILABLE` outcome keeping HTTP contract unified; proven pattern in prior T-023/T-024 `tstzrange &&` handling; failure modes are distinct (count check → explicit 409, EXCLUDE catch → same 409).
   - Cons: Two concurrency mechanisms to maintain (count logic + EXCLUDE migration); must correctly issue `isolationLevel:'repeatable read'` (Drizzle API version-sensitive) or raw `SET TRANSACTION`; `FOR UPDATE` must lock exactly the overlapping active range, not full table, to avoid unnecessary contention.
   - Effort: Medium (1 TX block ~35 LOC + repo helper ~15 LOC + error mapping ~10 LOC + tests).

2. **EXCLUDE-only (no SELECT FOR UPDATE, rely solely on constraint)**
   - Pros: Simplest code — optimistic `INSERT`, catch `23P01 → 409`; no explicit locking; works for `capacity=1` with single statement.
   - Cons: Does not generalize to `capacityPerSlot>1` (EXCLUDE only enforces 1); loses pre-INSERT opportunity to return early `APPOINTMENT_NOT_AVAILABLE` from application count (opaque DB error vs intentional domain error); error message derivation is PG-specific and harder to log with `serviceId/date/slot` context required by `Technical-spec.md §13`; spec explicitly asks for `SELECT FOR UPDATE` + count, so EXCLUDE-only would violate `INV-04` + T-029 traceability.
   - Effort: Low

3. **SERIALIZABLE with retry (no explicit FOR UPDATE)**
   - Pros: PostgreSQL guarantees serializable isolation without manual locking; retry loop handles `serialization_failure 40001`.
   - Cons: Heavier contention and retry complexity for a low-contention workshop domain; `SERIALIZABLE` false positives cause `40001` p99 latency spikes under parallel E2E suite; Drizzle transaction retry wrapper not standardized; spec template defaults to `REPEATABLE READ + FOR UPDATE`, so SERIALIZABLE would drift from documented contract.
   - Effort: Medium-High (retry + metrics)

4. **Application-level mutex / optimistic in-memory lock (Node single-process)**
   - Pros: Zero DB complexity for dev.
   - Cons: Breaks across horizontally scaled Next.js instances / serverless; violates `INV-04` which demands DB-enforced serialization; test would pass locally and fail in production deploy — unacceptable for EC-01.
   - Effort: Low (but incorrect)

### Recommendation

**Adopt Approach 1 — Hybrid `REPEATABLE READ + SELECT FOR UPDATE count + EXCLUDE safety net`.**

Exact atomic sequence inside `src/services/appointmentService.ts#createAppointment` (single method, no new service file):

```ts
// deps.config extended to Pick<WorkshopConfig,'timezone'|'operatingHours'|'capacityPerSlot'>
return db.transaction(async (tx) => {
  // If Drizzle version exposes opts: { isolationLevel: 'repeatable read' } pass as 2nd arg,
  // else first statement:
  await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);

  // 1. Vehiculo + ownership (keep H-13 order: ownership BEFORE availability)
  const vehicle = await findVehiculoById(tx, input.vehicleId);
  if (!vehicle) throw new ValidationError(...);
  assertOwnership(vehicle.customerId, input.authUser);

  // 2. Servicio + activo guard
  const servicio = await findServicioById(tx, input.serviceId);
  if (!servicio) throw new ValidationError(...);
  if (!servicio.active) throw new InvalidServiceError(...);

  // 3. Duration + closure (INV-05 inclusive <=)
  const dr = calculateEndAndValidate({ start: input.startDateTime, durationMinutes: servicio.durationMinutes, config: deps.config });
  if (!dr.valid) throw dr.error;
  const endDateTime = dr.end;

  // 4. Blocking availability: FOR UPDATE count
  const overlapping = await tx.execute(sql`
    SELECT count(*)::int AS cnt FROM turnos
    WHERE tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange(${input.startDateTime}, ${endDateTime})
      AND estado IN ('PENDIENTE','CONFIRMADO')
    FOR UPDATE
  `);
  // or repo helper: countActiveOverlappingForUpdate(tx, {fromUtc: input.startDateTime, toUtc: endDateTime})

  const cnt = Number((overlapping.rows?.[0] as any)?.cnt ?? 0);
  if (cnt >= deps.config.capacityPerSlot) throw new AppointmentNotAvailableError(...);

  // 5. INSERT PENDIENTE (TIMESTAMPTZ UTC via Drizzle timestamp columns)
  const [row] = await tx.insert(turnos).values({
    clienteId: vehicle.customerId, vehiculoId: input.vehicleId,
    servicioId: input.serviceId, fechaHoraInicio: input.startDateTime,
    fechaHoraFin: endDateTime, estado: 'PENDIENTE',
  }).returning();

  return toTurnoDTO(row);
});
```

Add outer catch: `if (hasPgCode(e,'23P01')) throw new AppointmentNotAvailableError(...,{cause:e})` and for `40001/40P01` either rethrow as same 409 or retry once (document choice; prefer direct 409 without retry for v1). Route mapper translates `APPOINTMENT_NOT_AVAILABLE → 409 {error:{code,message}}`.

**Isolation level wiring:** Prefer `db.transaction(async tx=>..., {isolationLevel:'repeatable read'})` if `drizzle-orm@0.45` types allow; verify with `pnpm exec tsc --noEmit` and fallback to explicit `SET TRANSACTION` inside callback. Never open a separate `pool.connect()` outside Drizzle — it bypasses Drizzle's `Tx` typing and DTO mappers.

**Why this wins:** Faithful to spec `INV-04` + `§10` SQL template, preserves H-13 validation order, keeps `WorkshopConfig` parametrized, generalizes to future `capacity>1`, and leaves EXCLUDE as defense-in-depth without double-counting logic.

### Risks

- **Availability read vs write TX mismatch:** `GET /api/availability` uses `findActiveTurnosByDateRange` without `FOR UPDATE` (correct for reads), but `createAppointment` must not reuse that non-locking helper. Guard: add dedicated `findActiveTurnosForUpdate` / raw `FOR UPDATE` query; review checklist blocks reuse.
- **Hardcoding PG codes 23P01/40001:** Mis-mapping turns EXCLUDE vs CHECK (`23514`) vs FK (`23503`) into wrong HTTP status. Guard: reuse central `hasPgCode` + `PG_CODES` + existing `turnos.test.ts` cause-chain test pattern; keep constants in `src/lib/errors.ts`.
- **H-13 order violation (ownership before availability):** Placing `SELECT FOR UPDATE` before `assertOwnership` leaks slot existence to non-owners and burns row locks. Guard: keep order `auth → vehicle ownership → servicio.active → duration → SELECT FOR UPDATE`; ownership failure → 403 without touching lock.
- **Timezone / closure drift:** `startDateTime` already ISO→UTC `Date` by route/validator; `calculateEndAndValidate` must receive same `config.timezone` and `operatingHours` used by `getOperatingIntervalsForDate`. Validating outside TX with a different config than inside TX creates `11:30+90` bypass. Guard: compute `endDateTime` inside TX with `deps.config` (single DI source), keep `parseIsoToUtc` → `Date` boundary only at HTTP layer.
- **Capacity parametrization slip:** Hardcoding `cnt >= 1` instead of `cnt >= deps.config.capacityPerSlot` freezes v1 capacity and breaks T-019b contract. Guard: `deps.config` extends to `capacityPerSlot`, validated `int>=1`; tests pass `capacityPerSlot=2` expecting second overlap to succeed.
- **Drizzle TX isolationLevel API drift:** If `drizzle-orm` version does not accept `isolationLevel` option, silent fallback to `READ COMMITTED` would weaken guarantee. Guard: assert at startup/test that `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` appears in TX path; add unit test checking stripped `appointmentService.ts` contains `REPEATABLE READ` and `FOR UPDATE`.
- **EXCLUDE migration drift:** `drizzle/0004_graceful_james_howlett.sql` must remain applied; regenerating migrations via `drizzle-kit generate` could drop the manual EXCLUDE. Guard: keep `Drizzle has no EXCLUDE DSL` comment in `schema.ts`, pin file-content test asserting `EXCLUDE USING gist` string.
- **408/409 vs 400 confusion:** Closing violation `fechaHoraFin > finIntervaloOperativo` must remain `400 VALIDATION_ERROR` (INV-05), not `409 APPOINTMENT_NOT_AVAILABLE`. Mixing them breaks API contract for UI retry vs validation copy.
- **Concurrent test flakiness:** Real PG TX timing varies; `Promise.all` without `Promise.allSettled` hides the rejected branch; not draining pool causes hang. Guard: use `Promise.allSettled` + deterministic assertions `1 fulfilled + 1 rejected with code`, reuse single `pool` not two pools.

### Ready for Proposal

Yes — **Ready.** Current skeleton, invariants, DB wiring, and test seams are identified; dependencies `T-027/T-051/T-019b` are DONE; implementation plan `T-028+T-029 atomic` has exact TX template and acceptance gate. Next phase is `sdd-propose` to lock `WorkshopConfig` DI extension and TX boundary, then `sdd-spec` delta for `appointment` domain (add atomic creation + 23P01 mapping + 2-worker concurrency scenarios), `sdd-design` (TX sequence diagram + Drizzle API choice), `sdd-tasks` (break down file touch set + concurrency test task), followed by `sdd-apply` feature branch.

**File touch set for T-028+T-029:**
- `src/services/appointmentService.ts` — implement atomic `createAppointment` (extend `AppointmentServiceDeps.config` with `capacityPerSlot`)
- `src/db/repositories/turnos.ts` — add `countActiveOverlappingForUpdate(tx,range)` / inline `FOR UPDATE` + map `23P01 → AppointmentNotAvailableError` on INSERT
- `src/app/api/appointments/route.ts` — new route thin wrapper + error mapper (creates with atomic service)
- `src/lib/errors.ts` / `src/services/errors.ts` — expose `23P01/40001` handling if not already
- `tests:` `src/services/__tests__/appointmentService.test.ts` (mocked TX unit) + `src/db/repositories/turnos.test.ts` (EXCLUDE mapping) + new `tests/integration/appointmentConcurrency.test.ts` (real PG 2-worker)

**Test strategy for 2-worker concurrency (T-029):**
- **Integrationally authoritative (real PG required by `Technical-spec.md §10`):** Mark `tests/integration/appointmentConcurrency.test.ts` with `describe.skipIf(!process.env.DATABASE_URL)`. Setup: seed one `vehiculo` + `servicio active (60min)` + known BA slot `2026-09-10T10:00:00-03:00` under `09:00-12:00/14:00-18:00`, `capacityPerSlot=1`, two distinct `authUser {id,role:CLIENTE}` each owning their vehiculo or sharing with ADMIN bypass. Fire `Promise.allSettled([createAppointment(tx1Deps,...), createAppointment(tx2Deps,...)])` using same `db` pool (two concurrent `db.transaction` calls execute on separate pool clients). Assert `fulfilled.length===1 && rejected.length===1 && rejected.code==='APPOINTMENT_NOT_AVAILABLE'` and DB has exactly 1 `PENDIENTE`. Also assert `tstzrange &&` overlap: adjacent `10:00-11:00` vs `11:00-12:00` does NOT collide.
- **Unit-level (CI without PG):** Mock `tx.execute` returning `cnt=0` vs `cnt=1` to verify branch `cnt >= capacity → throw AppointmentNotAvailableError`; verify `23P01` catch path via synthetic error with `cause.code='23P01'`; verify H-13 `ForbiddenError` before lock is hit. These run unconditionally.
- **Avoid:** `vitest` `concurrent` flag alone does not simulate DB row locks — it is Node event-loop concurrency, not PG isolation. Do not claim coverage without the integration run. Document `pnpm test -- tests/integration/appointmentConcurrency.test.ts` requires `docker compose up db` + `DATABASE_URL`.
