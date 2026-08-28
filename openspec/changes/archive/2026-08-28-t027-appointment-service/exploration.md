# Exploration: t027-appointment-service — Appointment Service (FASE 6 Gestion de turnos)

## Current State

**T-027 scope (from implementation-plan.md:858-874):** Create `AppointmentService` as single owner of the turno lifecycle — `Crear solicitudes`, `Consultar turnos`, `Confirmar turnos`, `Rechazar turnos`, `Cancelar turnos`. No `COMPLETADO` in v1; only `PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO` (INV-02). Depends on `T-024 AvailabilityService (DONE)`; feeds `T-028/T-029 atomic booking transaction` and `T-030..T-034` (confirm/reject/cancel/query endpoints + lifecycle tests).

**What exists today (Aug 2026, verified on disk):**

- **Schema/Migration (T-009 DONE):** `src/db/schema.ts` `turnos` table has 9 columns, 4 btree indexes (`idx_turno_*`), 2 CHECKs (`turnos_estado_check`, `turnos_interval_check`), FKs `onDelete RESTRICT`, `TIMESTAMPTZ` UTC (INV-06). `drizzle/0004_graceful_james_howlett.sql` adds `CREATE EXTENSION btree_gist` + `EXCLUDE USING gist (tstzrange(fecha_hora_inicio, fecha_hora_fin) WITH &&) WHERE (estado IN ('PENDIENTE','CONFIRMADO'))` for capacity=1 (INV-04). `turnoInputSchema` (`src/db/validators/turno.ts`) validates `z.enum(['PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'])` + `fechaHoraFin > fechaHoraInicio`.
- **Repository (thin, no transactions):** `src/db/repositories/turnos.ts` exposes `createTurno(db, CreateTurnoInput, config)`, `findTurnoById`, `findTurnosByClienteId`, `findActiveTurnosByDateRange(dbOrTx, {fromUtc,toUtc})`. `createTurno` resolves `servicio.duracionMinutos`, calls `calculateEndAndValidate` (INV-05 inclusive `<=`) then `turnoInputSchema.parse` then `INSERT ... RETURNING` + `toTurnoDTO`. No `REPEATABLE READ`/`SELECT FOR UPDATE` — explicitly deferred to T-028. `hasPgCode` chains `23503/23514/23P01`.
- **DTO boundary (INV-08, enforced):** `src/db/mappers/turno.ts` `toTurnoDTO(row)` maps `clienteId->customerId`, `vehiculoId->vehicleId`, `servicioId->serviceId`, `fechaHoraInicio->startDateTime`, `fechaHoraFin->endDateTime`, `estado->status`, `created_at/updated_at->createdAt/updatedAt`. All tests in `src/db/__tests__/mappers.*` enforce no leakage. Write path uses `CreateTurnoInput` (English camelCase) -> Spanish DB remap + Zod.
- **Availability stack (T-019b..T-026 DONE, pure):** `WorkshopConfig` frozen DI (`src/config/workshopConfig.ts` + `workshopSchedule.ts`), `slotGenerator`, `duration` (`calculateEndAndValidate`, `baWallTimeToUtcDate` DST-aware via `Intl`), `overlap` (`ACTIVE_STATUSES=['PENDIENTE','CONFIRMADO']`, `isSlotAvailable` count `< capacityPerSlot`), `availabilityService.getAvailableSlots` (pure) + `getAvailableSlotsForDate` (async bulk fetch). Route `GET /api/availability` correctly DIs config and guards `servicio.active`. T-026 locks EC-02 `200 {availableSlots:[]}`.
- **Auth (T-050/051/035 DONE):** `src/lib/auth/requireAuth.ts` (`requireAuth`, `assertOwnership`, `assertRole`, `AuthUser {id,email,role}`), `src/lib/auth/roles.ts`, `src/db/repositories/users.ts`. `appointmentGuard.ts` exists as a **T-028 placeholder**: `assertCanCreateAppointment(vehicle, servicio, authUser)` checks `vehicle.customerId == authUser.id` (or ADMIN) + `servicio.active`; throws `ForbiddenError` / `InvalidServiceError`. Comment `// TODO T-028: replace with AppointmentService transaction`.
- **No Appointment state machine yet:** `grep canTransition|AppointmentStateMachine` hits only `turnos.schema.test.ts` negative guard (`not.toMatch(/canTransition/)`). No `src/domain/` directory, no `src/services/appointmentService.ts`, no `AppointmentStatus` enum, no `src/services/__tests__/appointmentService.test.ts`. HTTP routes `src/app/api/appointments/**` do not exist (only availability/customers/services/vehicles/auth). `src/lib/http/errors.ts` currently lacks `APPOINTMENT_NOT_AVAILABLE` / `INVALID_APPOINTMENT_STATE` (has `INVALID_SERVICE`, `VALIDATION_ERROR`, `FORBIDDEN`, etc.).
- **Tech invariants verified:** `src/db/index.ts` exports `db: Drizzle<Pool>`, `Tx`, `DbOrTx` for DI; `server-only` on services; `workshopConfig` frozen with `capacityPerSlot=1`, `slotStepMinutes=30`, `timezone=America/Argentina/Buenos_Aires` (to-be-parametrized via T-036b). `package.json` engines `node>=22`, `vitest` with `vite-tsconfig-paths`.

### Affected Areas

- `src/domain/appointmentStateMachine.ts` — **NEW, highest priority.** Pure domain module owning `AppointmentStatus` type + `canTransition(from,to,role)` per RN-07 matrix. Zero DB/imports, fully unit-testable. Single source of truth for T-030..T-033; prevents duplication.
- `src/services/appointmentService.ts` — **NEW, thin orchestrator.** Owns business operations `createAppointment` (skeleton, defers to T-028 transaction), `getAppointmentById`/`listAppointments` (query with RN-04 filters + `paginate` + ownership), `confirmAppointment`/`rejectAppointment`/`cancelAppointment` (validate `canTransition` + `now < startDateTime` via UTC + role/ownership, then delegate to repo update). Must stay thin: no `SELECT FOR UPDATE`, no slot generation.
- `src/db/repositories/turnos.ts` — **EXTEND.** Add `updateTurnoStatus`, `findTurnos` (paginated, filters `status/includeCancelled/includeRejected/from/to/date`, `sort`, `page/limit->offset`), `findTurnosForUpdate` stub or keep locked helper for T-028 only. Keep thin: single-statement, `DbOrTx` injected, no business logic.
- `src/services/errors.ts` + `src/lib/http/errors.ts` — **EXTEND.** Add `AppointmentNotAvailableError` (409) and `InvalidAppointmentStateError` (409/400 per §12) + map `PG_CODES.EXCLUSION_VIOLATION 23P01 -> APPOINTMENT_NOT_AVAILABLE`, `CHECK 23514 -> VALIDATION_ERROR`. Add `ERROR_CODES.APPOINTMENT_NOT_AVAILABLE`, `INVALID_APPOINTMENT_STATE` and `STATUS_BY_CODE` entries.
- `src/db/mappers/turno.ts` — **REUSE (no change).** Already hardened INV-08. T-027 must reuse `toTurnoDTO`; write path stays `CreateTurnoInput -> turnoInputSchema`.
- `src/services/availability/*` — **CONSUME, do not duplicate.** `AppointmentService.create` will call `calculateEndAndValidate` + `findActiveTurnosByDateRange` for pre-check, but atomic count check remains in T-028 transaction. No new duration logic.
- `src/lib/auth/requireAuth.ts` + `src/services/appointmentGuard.ts` — **REUSE/DEPRECATE.** `assertOwnership`/`assertRole` stay canonical; `appointmentGuard.assertCanCreateAppointment` is superseded by `AppointmentService` (which owns `servicio.active` + ownership) — guard can be removed or re-exported after T-027.
- `src/app/api/appointments/**` (future) — **OUT OF SCOPE for T-027.** Routes `POST /api/appointments`, `PATCH .../confirm|reject|cancel`, `GET /api/appointments` + `GET /api/admin/appointments` belong to T-028..T-033. T-027 must NOT create routes; it provides the service they will call.
- `src/services/__tests__/appointmentStateMachine.test.ts` + `src/services/__tests__/appointmentService.test.ts` — **NEW.** Matrix unit tests (6 valid + all invalid combos + role matrix) and service thin tests (mocked repo, fake timers for `now < start`). T-034 will expand with integration.

### Approaches

1. **Monolithic `AppointmentService` with colocated pure `canTransition` helper** — Single `src/services/appointmentService.ts` file containing `AppointmentStatus` const, `canTransition` function, and all service methods (`create`, `query`, `confirm`, `reject`, `cancel`) that delegate to `turnos` repo. Validation (`canTransition` + `now < start` + `servicio.active` + ownership) lives inline in each method.
   - Pros: Fewest files; minimal indirection; quickest to land; fits current service pattern (`customerService`, `vehicleService`, `servicioService` each single file); matches `Technical-spec §4.5` "AppointmentService is single owner" literally.
   - Cons: File grows to ~300 LOC mixing pure transition logic with I/O orchestration; `canTransition` not independently importable for T-030..T-033 without pulling service deps; harder to unit-test matrix in isolation; encourages future duplication when admin module (`T-036/T-037`) needs same matrix; violates single-responsibility as service accumulates query + command + domain.
   - Effort: Low (1 file + repo extensions + error codes).

2. **Pure domain `AppointmentStateMachine` + thin `AppointmentService` (recommended)** — Extract `src/domain/appointmentStateMachine.ts` (or `src/domain/appointment/stateMachine.ts`) as zero-dependency pure module: `AppointmentStatus` enum/union, `TRANSITIONS` map, `canTransition(from,to,role)`, `isTerminal(status)`. `AppointmentService` becomes thin orchestrator that imports the machine, validates transitions, then calls repo. Query vs command stay in same service for v1 (no CQRS split); pagination helper `paginate` reused from `Technical-spec §8.5`. `AppointmentService.create` is intentionally non-atomic skeleton (validates `servicio.active`, ownership, duration, pre-check via `isSlotAvailable`) and documents `// T-028 will wrap in REPEATABLE READ + SELECT FOR UPDATE`.
   - Pros: Single source of truth for RN-07 consumed by T-030/T-031/T-032/T-036/T-037 without duplication; pure machine is trivially unit-tested with table-driven tests and achieves >80% coverage gate (DoD H-22); service stays thin/reversible; aligns with `Technical-spec §4.5 ownership (H-19)` "AppointmentService is unique owner, others delegate"; preserves INV-04 boundary (concurrency stays in T-028, machine has no DB logic); easy to add `now < start` helper alongside machine.
   - Cons: One extra file to maintain; import path `src/domain/*` is new convention (no prior `src/domain` — need to create directory); slight indirection for readers expecting everything in `services/`.
   - Effort: Low-Medium (2 files + repo + error codes + tests; ~250 LOC total, well under 400-line budget).

3. **Command/Query split (`AppointmentService` + `AppointmentQueryService`)** — Separate write service (`create/confirm/reject/cancel`) from read service (`query`/`agenda`) with distinct interfaces, mirroring `Technical-spec §4.5 vs §4.6` split (`AppointmentService` vs `AppointmentQueryService`/`AppointmentService.query`). Each has own repo methods.
   - Pros: Clean CQRS boundary; query can evolve pagination/filters without touching command; aligns with `T-036` note "delega lectura a AppointmentQueryService / AppointmentService.query".
   - Cons: Premature for v1 scale (single workshop, capacity=1, low read volume); doubles service boilerplate; risks diverging validation (both must enforce RN-04 filters consistently); `implementation-plan DAG` lists T-027 as single service — split would create an unplanned artifact and confuse T-033 ownership; over-engineered for 400-line budget; no current query volume justifies CQRS.
   - Effort: Medium-High (3 files + duplicated mappers + extra tests).

### Recommendation

**Adopt Approach 2: Pure domain `AppointmentStateMachine` + thin `AppointmentService`.**

Why it is the best fit:

- **Invariant fidelity:** RN-07 matrix becomes a pure function `canTransition(from,to,role)` with exhaustive table tests. T-030/T-031/T-032 simply call `if (!canTransition(...)) throw new InvalidAppointmentStateError(...)` — no matrix copy-pasta. INV-02 (`PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO`, no `COMPLETADO`) is enforced in one place.
- **Boundary hygiene:** Keeps INV-04 concurrency out of T-027 (`EXCLUDE`/`SELECT FOR UPDATE` live only in `T-028/T-029` transaction). T-027's `createAppointment` validates `servicio.active`, `vehicle.customerId == authUser.id` (INV-03 ownership), and `fechaHoraFin <= finIntervaloOperativo` via `calculateEndAndValidate` (INV-05), but does NOT do blocking count — it documents handoff to T-028. Duration/slot generation stays in `availability/*` (pure DI).
- **DTO/timezone discipline:** All repo boundaries use `CreateTurnoInput` (English camelCase) -> `turnoInputSchema` -> `toTurnoDTO` (INV-08). Time comparisons `now < startDateTime` compare `TIMESTAMPTZ` UTC `getTime()` only (INV-06), with helper `isFutureTurno(startDateTime, now)` taking `now: Date` via DI/clock for testability (edge cases `09:00:00` exact, `09:00:01`, `08:59`).
- **File layout (what T-027 owns vs delegates):**

  ```
  src/domain/appointmentStateMachine.ts   # NEW — pure, owns RN-07 (T-027)
  src/services/appointmentService.ts      # NEW — thin, owns orchestration + validation (T-027)
  src/db/repositories/turnos.ts           # EXTEND — add updateTurnoStatus + paginated query (T-027)
  src/services/errors.ts                  # EXTEND — Appointment errors (T-027)
  src/lib/http/errors.ts                  # EXTEND — ERROR_CODES + STATUS_BY_CODE (T-027)
  src/services/appointmentGuard.ts        # DEPRECATE — superseded, remove after T-027
  --- delegated to later ---
  src/db/repositories/turnos.ts#createTurnoTx  # T-028/029 — REPEATABLE READ transaction
  src/app/api/appointments/**                 # T-028..T-033 routes
  src/config/workshopConfig.getWorkshopConfig # T-036b DB-backed config
  ```

- **Testability & DoD:** Pure machine hits `coverage >=80%` easily with table-driven unit tests. Service tests mock `turnos` repo and use fake timers for `now < start` edges, keeping integration out of T-027 (integration comes in T-034). Under 400-line budget (2 new files ~150 LOC each + ~40 LOC repo/error extensions + tests).

### Risks

- **Duplicating transition logic that T-030..T-033 will need** — Mitigated by extracting `appointmentStateMachine` as single import; enforce via `turnos.schema.test.ts` negative guard and code review that no route/service re-implements `PENDIENTE->CONFIRMADO` checks inline.
- **Hardcoding estados / adding `COMPLETADO`** — `Technical-spec §6.4` and `Functional-spec RN-07` forbid `COMPLETADO` in v1. Define `AppointmentStatus = 'PENDIENTE'|'CONFIRMADO'|'RECHAZADO'|'CANCELADO'` as const union and freeze; add Zod `z.enum` guard and test that `COMPLETADO` rejects. Never use capitalised `Pendiente`.
- **Leaking `snake_case`/Spanish DB names to API** — All service return types are `TurnoDTO` (English). Enforce via `toTurnoDTO`-only writes and review that no `row.fecha_hora_inicio` escapes; mapper tests already guard this.
- **Mixing concurrency logic into T-027 (must stay in T-028)** — `AppointmentService.create` must NOT contain `SELECT FOR UPDATE`/`EXCLUDE` handling; mark with `// TODO T-028` and keep `createTurno` thin single-INSERT. Review checks for `FOR UPDATE`, `REPEATABLE READ`, `EXCLUDE` strings in T-027 diff.
- **`now < startDateTime` timezone pitfall** — Compare UTC `getTime()` only; inject `now` param (clock) instead of calling `new Date()` inside service; DST handled via `WorkshopConfig.timezone` only for `getBaDayUtcRange`, not for cancel check. Cover edges `now==09:00:00` reject, `08:59` allow, `09:00:01` reject (H-12/T-034).
- **Role/ownership confusion** — `CAN_TRANSITION` needs `role` param: `PENDIENTE->CANCELADO` and `CONFIRMADO->CANCELADO` allow `CLIENTE (owner) | ADMINISTRADOR`, while `PENDIENTE->CONFIRMADO/RECHAZADO` allow only `ADMINISTRADOR`. Client paths must also call `assertOwnership(turno.customerId, authUser)` before transition; admin bypasses. Forbid `RECHAZADO/CANCELADO -> *`.
- **Over-eager query scope** — T-027's `listAppointments` must implement RN-04 filtering (`PENDIENTE|CONFIRMADO` with `startDateTime > now` by default, `includeCancelled/includeRejected` flags opt-in) and pagination helper `paginate` (`limit<=100`, `sort=startAt:asc/desc`) matching `Technical-spec §8.5`. Client queries must filter `customerId == authUser.id`; admin sees all. Doing this wrong leaks cancelled/rejected as active.

### Ready for Proposal

Yes — **Ready.** Scope is bounded, dependencies are satisfied (`AvailabilityService`, `WorkshopConfig`, `Auth`), and the pure-domain + thin-service split is validated against all 8 invariants. Next phase is `sdd-propose` to lock `src/domain/appointmentStateMachine` API (`canTransition`, `AppointmentStatus`) and `AppointmentService` surface (method signatures, error codes, DTOs), then `sdd-spec` to write delta specs for `appointment` domain with GWT scenarios per RN-07, then `sdd-design`.

No clarification needed. Frozen context confirmed: `turnos` hardened, `AvailabilityService` pure, `Auth` guards ready. T-027 must not pre-implement T-028's atomic transaction or HTTP routes.
