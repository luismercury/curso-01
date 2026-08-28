# Design: t030-confirm-appointment — PATCH /api/appointments/[id]/confirm

## Technical Approach

Thin Next.js App Router `PATCH` handler that delegates `PENDIENTE→CONFIRMADO` transition to the existing `confirmAppointment` service. Route is auth/role guard + UUID validation + error mapping only; all business logic lives in the service (RN-07 matrix, `now < startDateTime` UTC check).

## Architecture Decisions

### Decision: Explicit `assertRole` before service delegation

**Choice**: Route calls `requireAuth → assertRole(ADMINISTRADOR) → uuidSchema.parse → confirmAppointment`
**Alternatives considered**:
- A1: Service-only role check → `409` for `CLIENTE` (semantically wrong HTTP status)
- A3: Direct repo access bypassing service → duplicates RN-07 matrix outside single owner

**Rationale**: HTTP `403` for role violation, `409` for state violation — per §12 envelope spec. Service's `canTransition` acts as defense-in-depth. Matches `PATCH /api/services/[id]` precedent.

### Decision: `AppointmentServiceDeps` shape for DI

**Choice**: Pass `{ db, config: { timezone, operatingHours, capacityPerSlot } }` to `confirmAppointment`
**Alternatives considered**: Omit `capacityPerSlot` since confirm doesn't check capacity
**Rationale**: Service deps shape is fixed; `capacityPerSlot` is unused but harmless to pass. Clock injection (`deps.now?`) for testability — service uses `getNow()`.

### Decision: No capacity / `FOR UPDATE` / `tstzrange` in route

**Choice**: Route has zero DB concurrency primitives
**Rationale**: Confirm is single-row `UPDATE`; capacity counting belongs to T-028 atomic booking only. Service calls `updateTurnoStatus` (plain `UPDATE ... RETURNING`), not the overlap-count path.

## Data Flow

```
Request → middleware (401 guard)
        → requireAuth (401 UNAUTHORIZED | AuthUser)
        → assertRole(ADMINISTRADOR) (403 FORBIDDEN)
        → uuidSchema.parse (400 VALIDATION_ERROR)
        → confirmAppointment({ db, config }, id, authUser)
            → loadOr404 → AppointmentNotFoundError (→ 404)
            → ensureFuture(now, startDateTime) → InvalidAppointmentStateError "El turno ya comenzó" (→ 409)
            → canTransition(PENDIENTE, CONFIRMADO, ADMINISTRADOR) → InvalidAppointmentStateError (→ 409)
            → updateTurnoStatus → TurnoDTO
        → 200 TurnoDTO (status:"CONFIRMADO", camelCase)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/confirm/route.ts` | Create | Thin PATCH handler, ~70 LOC |
| `src/app/api/appointments/[id]/confirm/route.test.ts` | Create | Mocked auth/service, table-driven |

**Reused unchanged**: `appointmentService.ts#confirmAppointment`, `appointmentStateMachine.ts`, `requireAuth.ts`, `roles.ts`, `errors.ts`, `toTurnoDTO`.

## Error Mapping Table

| Error source | HTTP | Code | Notes |
|-------------|------|------|-------|
| `requireAuth` throws `UnauthorizedError` | 401 | `UNAUTHORIZED` | No valid JWT |
| `assertRole` throws `ForbiddenError` | 403 | `FORBIDDEN` | `CLIENTE` role |
| `z.string().uuid().parse(id)` throws `ZodError` | 400 | `VALIDATION_ERROR` | Malformed UUID, includes `issues` |
| `AppointmentNotFoundError` | 404 | `APPOINTMENT_NOT_FOUND` | Unknown ID |
| `InvalidAppointmentStateError` (wrong state, `now>=start`, terminal) | 409 | `INVALID_APPOINTMENT_STATE` | Service throws with message |
| Success | 200 | — | `TurnoDTO` camelCase |

**Not applicable**: `APPOINTMENT_NOT_AVAILABLE` (409) — capacity endpoint, not confirm.

## Dependency Injection

```ts
import { db } from "@/db";
import { workshopConfig } from "@/config/workshopConfig";
import { confirmAppointment } from "@/services/appointmentService";

const config: Pick<typeof workshopConfig, "timezone" | "operatingHours" | "capacityPerSlot"> = {
  timezone: workshopConfig.timezone,
  operatingHours: workshopConfig.operatingHours,
  capacityPerSlot: workshopConfig.capacityPerSlot,
};

const dto = await confirmAppointment({ db, config }, id, authUser);
```

`deps.now` is **not** injected in the route — service defaults to `new Date()` at UTC. Tests can override via `confirmAppointment({ db, config, now: fakeDate }, ...)`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Route error codes + DTO shape | `vi.mock` auth + service, table-driven cases |
| Unit | No snake leak | Assert `status` present, `estado`/`fecha_hora_inicio` absent |
| Unit | DI passed correctly | Spy on service mock calls, assert `config` shape |
| Unit | Auth order | 401 before 400 — mock `requireAuth` rejecting before UUID parse |

**Test cases (table-driven)**:
1. `ADMIN + PENDIENTE future` → `200`, DTO has `status:"CONFIRMADO"`
2. `CLIENTE` → `403 FORBIDDEN`
3. Unauthenticated → `401 UNAUTHORIZED`
4. Malformed UUID → `400 VALIDATION_ERROR` (+ `issues`)
5. Unknown ID → `404 APPOINTMENT_NOT_FOUND`
6. `now >= startDateTime` → `409 INVALID_APPOINTMENT_STATE` ("El turno ya comenzó")
7. Already `CONFIRMADO` → `409 INVALID_APPOINTMENT_STATE`
8. Terminal `RECHAZADO`/`CANCELADO` → `409 INVALID_APPOINTMENT_STATE`

**Snake leak check** in `200` case: response must not contain `estado`, `fecha_hora_inicio`, `cliente_id`, `vehiculo_id`, `servicio_id`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This is a pure HTTP route handler with no side effects beyond DB writes.

## Migration / Rollback

No migration required. Rollback: delete `src/app/api/appointments/[id]/confirm/` directory and revert commit.
