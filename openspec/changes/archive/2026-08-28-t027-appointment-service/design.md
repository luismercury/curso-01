# Design: T-027 Appointment Service (FASE 6)

## Technical Approach

Pure domain `AppointmentStateMachine` + thin `AppointmentService` per RN-07 matrix. The state machine owns `AppointmentStatus` (PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO — no COMPLETADO), `canTransition(from,to,role)`, and `isTerminal`. The service layer orchestrates validations then delegates to repository. Concurrency (REPEATABLE READ/SELECT FOR UPDATE) is explicitly deferred to T-028; T-027 diff must NOT contain those strings.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|-----------|--------|--------------|-----------|
| State machine location | `src/domain/appointmentStateMachine.ts` | inline in service / `src/services/` | Single import source for T-030..T-036; zero DB deps; trivially unit-testable |
| Status enum | `z.enum` frozen + const union | plain TypeScript union | Zod rejects COMPLETADO at parse time; test can assert invalid states throw |
| Clock injection | `now: Date` param on cancel/confirm | `Date.now()` call | Fake timers enable edge-case coverage (08:59/09:00:00/09:00:01) |
| Repository pattern | `DbOrTx` param on mutations | Hardcode `db` import | T-028 transaction can pass `tx` without signature change |
| Error mapping | `23P01 → APPOINTMENT_NOT_AVAILABLE` in repo | map at controller | keeps repo thin; service only sees domain errors |
| DTO boundary | `toTurnoDTO` reused, no new mapper | duplicate mapping | INV-08 enforced already; adding new mapper risks leakage |

## Data Flow

```
Controller → requireAuth(req) → AuthUser
                           ↓
              AppointmentService (validates)
                           ↓
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
   createAppointment  confirm/reject    query/getById
   (validates servicio.   (canTransition +   (RN-04 filters
    activo, ownership,    now<start +       + pagination
    duration, fin<=close)  role/ownership)    + ownership)
         ↓                ↓                ↓
   createTurno repo   updateTurnoStatus  findTurnosPaginated
         ↓                ↓                ↓
      toTurnoDTO ←←←←←←←←←←←←←←←←←←←←←←←┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/appointmentStateMachine.ts` | Create | `AppointmentStatus`, `canTransition`, `isTerminal`, Zod schema, RN-07 matrix |
| `src/services/appointmentService.ts` | Create | `createAppointment`, `confirmAppointment`, `rejectAppointment`, `cancelAppointment`, `getAppointmentById`, `listAppointments` |
| `src/db/repositories/turnos.ts` | Modify | Add `updateTurnoStatus`, `findTurnosPaginated(query)` with `DbOrTx` |
| `src/services/errors.ts` | Modify | Add `AppointmentNotAvailableError`, `InvalidAppointmentStateError` |
| `src/lib/http/errors.ts` | Modify | Add `APPOINTMENT_NOT_AVAILABLE`, `INVALID_APPOINTMENT_STATE` to `ERROR_CODES` + `STATUS_BY_CODE` |

## Interfaces / Contracts

```typescript
// src/domain/appointmentStateMachine.ts

export const AppointmentStatus = ['PENDIENTE','CONFIRMADO','RECHAZADO','CANCELADO'] as const;
export type AppointmentStatus = typeof AppointmentStatus[number];
export const AppointmentStatusSchema = z.enum(AppointmentStatus);

export type Role = 'CLIENTE' | 'ADMINISTRADOR';

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  role: Role,
  opts?: { now?: Date; startDateTime?: Date }
): boolean { /* RN-07 matrix */ }

export function isTerminal(status: AppointmentStatus): boolean { /* RECHAZADO|CANCELADO */ }

// src/services/appointmentService.ts

export interface AppointmentServiceDeps {
  db: DbOrTx;
  config: Pick<WorkshopConfig, 'timezone' | 'operatingHours'>;
  now?: Date; // injected clock for testing
}

export async function createAppointment(
  deps: AppointmentServiceDeps,
  input: { vehicleId: string; serviceId: string; startDateTime: Date; authUser: AuthUser }
): Promise<TurnoDTO> { /* validates servicio.activo, ownership, duration, fin<=cierre; TODO T-028: atomic check */ }

export async function confirmAppointment(deps, id, authUser): Promise<TurnoDTO>
export async function rejectAppointment(deps, id, authUser): Promise<TurnoDTO>
export async function cancelAppointment(deps, id, authUser): Promise<TurnoDTO> // now < startDateTime UTC
export async function getAppointmentById(deps, id, authUser): Promise<TurnoDTO | null> // ownership enforced
export async function listAppointments(deps, query, authUser): Promise<PaginatedResult<TurnoDTO>> // RN-04 defaults
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|---------|
| Unit | `canTransition` matrix (6 valid + all invalid + role combos) | Table-driven, `test.each` |
| Unit | `isTerminal` | 4 cases |
| Unit | Service methods with mocked repo + fake `now` | `vi.mock` repo, `vi.useFakeTimers()` |
| Integration | Full flow with real DB (T-034) | After T-028 routes exist |

## DI Explanation

- **WorkshopConfig**: passed as `Pick<WorkshopConfig, 'timezone'|'operatingHours'>` — same shape as `createTurno`, future DB-backed config (T-036b) won't change signature.
- **Clock (`now`)**: optional param defaulting to `new Date()` in service; tests inject frozen `Date` to cover edge cases. `now` compared to `startDateTime` via UTC `getTime()` only (INV-06).
- **DbOrTx**: `updateTurnoStatus` and `findTurnosPaginated` accept `DbOrTx` so T-028 can pass a transaction without signature change. No `SELECT FOR UPDATE` in T-027 diff — that's T-028's job.
- **No SELECT FOR UPDATE**: T-027's `createAppointment` is a skeleton that validates preconditions but marks `// TODO T-028: wrap in REPEATABLE READ + SELECT FOR UPDATE`. Review must reject any `FOR UPDATE` or `REPEATABLE READ` string in this diff.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollback

No migration required. Rollback: delete `src/domain/appointmentStateMachine.ts` + `src/services/appointmentService.ts`, revert `turnos.ts` + `errors.ts` patches, keep `appointmentGuard.ts` as fallback (deprecated, not deleted until T-028).

## Open Questions

None.
