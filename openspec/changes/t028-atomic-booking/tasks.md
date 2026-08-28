# Tasks: t028-atomic-booking — Atomic Booking (T-028 + T-029)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 490 (repo 80 + service 120 + route 90 + tests 200) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 repo+service → PR2 route+integration |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Repo `countActiveOverlappingForUpdate` + Service atomic TX (`createAppointment`) | PR1 | `pnpm vitest run src/services/__tests__/appointmentService.test.ts` | N/A — mocked `Tx` + `tx.execute` spy for `SET TRANSACTION` | Revert `src/db/repositories/turnos.ts` + `src/services/appointmentService.ts` to `TODO T-028` skeleton |
| 2 | Route `POST /api/appointments` + verification (unit + 2-worker integration) | PR2 | `pnpm vitest run tests/integration/appointmentConcurrency.test.ts && npx tsc --noEmit` | `docker compose up db && DATABASE_URL=... pnpm vitest run tests/integration/appointmentConcurrency.test.ts` | Delete `src/app/api/appointments/route.ts` + `tests/integration/appointmentConcurrency.test.ts` |

## Phase 1: Repo Helper FOR UPDATE + 23P01 (R1,R2)

- [x] 1.1 Add `countActiveOverlappingForUpdate(tx,range)` to `src/db/repositories/turnos.ts` — `SELECT count(*) WHERE tstzrange && FOR UPDATE AND estado IN ('PENDIENTE','CONFIRMADO')` via `tx.execute` (R1)
- [x] 1.2 Keep `findActiveTurnosByDateRange` read-only (no FOR UPDATE) — no shared lock helper
- [x] 1.3 Add `hasPgCode(e,'23P01')→AppointmentNotAvailableError` in `createTurno` INSERT; keep `23503` distinct (R2,R6)
- [x] 1.4 Use `PG_CODES.EXCLUSION_VIOLATION` from `src/lib/errors.ts` — no raw `'23P01'` outside constant

## Phase 2: Service Atomic TX (R1,R2,R4,R5)

- [x] 2.1 Extend `AppointmentServiceDeps.config` to `Pick<WorkshopConfig,'timezone'|'operatingHours'|'capacityPerSlot'>` (R1,R5)
- [x] 2.2 Wrap body in `db.transaction(async tx=>{await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);...})` first statement (R1)
- [x] 2.3 Enforce H-13 order before lock: `findVehiculoById`→`assertOwnership`→`findServicioById`→`active`→`calculateEndAndValidate` inclusive `<=finIntervalo` (R5; 400≠409)
- [x] 2.4 Call `countActiveOverlappingForUpdate(tx,{fromUtc,toUtc})`; if `cnt>=capacityPerSlot` throw `AppointmentNotAvailableError` (DI, not `>=1`) (R1)
- [x] 2.5 Insert `PENDIENTE` via `tx.insert(turnos).returning()` with UTC dates; map via `toTurnoDTO` (R4,INV-06/08)
- [x] 2.6 Outer catch around `db.transaction`: `hasPgCode(e,'23P01')→409` with message "El horario seleccionado ya no se encuentra disponible."; rethrow `23503/23514` (R2,R6)

## Phase 3: Route POST /api/appointments (R6)

- [ ] 3.1 Create `src/app/api/appointments/route.ts` — Zod strict `{vehicleId,serviceId,startDateTime}` + `requireAuth`→401 (R6)
- [ ] 3.2 Call `createAppointment({vehicleId,serviceId,startDateTime,authUser})` with DI `db`+`workshopConfig` (R1,R4)
- [ ] 3.3 Map `{error:{code,message}}`: `AppointmentNotAvailableError`→409, `InvalidServiceError`→400, `ForbiddenError`→403, `ValidationError`→400; `201→TurnoDTO` (R6)
- [ ] 3.4 Return `NextResponse.json(dto,{status:201})` via `toTurnoDTO` — no snake_case leak (INV-08)

## Phase 4: Verification (R1-R6)

- [ ] 4.1 Mocked TX units in `src/services/__tests__/appointmentService.test.ts`: `cnt>=cap→409`, `cnt<cap→201`, synthetic `23P01`→409, `23514/23503`≠409 (R1,R2,R6)
- [ ] 4.2 H-13 order test: non-owner `ForbiddenError` before `countActiveOverlappingForUpdate`; spy verifies no count query (R5)
- [ ] 4.3 400 vs 409: `11:30+90>12:00→400` no FOR UPDATE; overlap `09:30 vs 09:00-10:00→409` (R5,R6)
- [ ] 4.4 Capacity DI: `capacity=2,cnt=1→201` proves not hardcoded `>=1` (R1)
- [ ] 4.5 Integration `tests/integration/appointmentConcurrency.test.ts` `skipIf(!DATABASE_URL)`: same slot `Promise.allSettled`→1×201+1×409 count 1; adjacent `10-11 vs 11-12→both 201` half-open (R3)
- [ ] 4.6 `npx tsc --noEmit` zero errors + `pnpm vitest run` green; gated skip verified without `DATABASE_URL`
