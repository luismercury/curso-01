# Design: T-031 PATCH /api/appointments/{id}/reject — Thin Route

## Technical Approach

Mirror the confirmed `confirm/route.ts` pattern (T-030) for `PENDIENTE→RECHAZADO`. Route is thin — no body, no capacity logic, no `FOR UPDATE` — delegating entirely to `rejectAppointment` which owns the RN-07 `canTransition` check and the `now < startDateTime` UTC time guard.

## Architecture Decisions

### Decision: Route structure mirrors confirm

**Choice**: Copy-paste `confirm/route.ts` → `reject/route.ts`, swapping `confirmAppointment` → `rejectAppointment`.

**Alternatives considered**: A shared helper for both routes (premature; `cancel` diverges); direct repository calls (duplicates state matrix, bypasses single-owner service).

**Rationale**: Minimal diff, proven pattern, `cancel` future divergence contained.

### Decision: Error order 401→403→400→404→409

**Choice**: `requireAuth` → 401, `assertRole` → 403, UUID parse → 400, `AppointmentNotFoundError` → 404, `InvalidAppointmentStateError` → 409.

**Rationale**: Matches spec scenario order; prevents auth leakage through validation.

## Data Flow

```
PATCH /api/appointments/[id]/reject
  │
  ├─ requireAuth(req) → 401 if missing/invalid JWT
  │   └─ assertRole(ADMINISTRADOR) → 403 if wrong role
  │       └─ UUID schema parse → 400 if malformed
  │           └─ rejectAppointment({db, config}, id, authUser)
  │               ├─ loadOr404 → 404 if not found
  │               ├─ ensureFuture(now, startDateTime) → 409 "El turno ya comenzó"
  │               ├─ canTransition(PENDIENTE, RECHAZADO, ADMIN) → 409 if invalid
  │               └─ updateTurnoStatus(id, RECHAZADO) → 200 TurnoDTO
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/reject/route.ts` | Create | Thin PATCH; `server-only`; DI config; error map; calls `rejectAppointment` |
| `src/app/api/appointments/[id]/reject/route.test.ts` | Create | Mocked auth/service; 7 scenarios from spec |

## Interfaces / Contracts

No new interfaces. Reuse: `AppointmentServiceDeps`, `TurnoDTO`, `rejectAppointment`, `toErrorBody`, `toValidationError`, `requireAuth`, `assertRole`, `UserRole`, `ERROR_CODES`, `AppointmentNotFoundError`, `InvalidAppointmentStateError`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (route) | 7 scenarios from spec | Mocked `requireAuth`, `rejectAppointment`; assert status + body |
| Integration | Full flow | Not in scope — service already covered |

7 scenarios (spec.md §1–7):
1. `ADMIN` + `PENDIENTE` future → 200 `RECHAZADO` DTO, no `estado` leak
2. `CLIENTE` → 403 via `assertRole`, service not called
3. unauth + malformed UUID → 401 before UUID validation
4. `ADMIN` + malformed UUID → 400 `VALIDATION_ERROR` with issues
5. `ADMIN` + unknown UUID → 404 `APPOINTMENT_NOT_FOUND`
6. `ADMIN` + non-`PENDIENTE` → 409 `INVALID_APPOINTMENT_STATE`
7. `ADMIN` + `now >= startDateTime` → 409 `"El turno ya comenzó"`

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollback

No migration required. Rollback: delete `src/app/api/appointments/[id]/reject/`; revert commit → 404. Zero data impact.

## Open Questions

None.
