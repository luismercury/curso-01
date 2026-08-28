# Design: t032-cancel-appointment

## Technical Approach

Thin `PATCH /api/appointments/{id}/cancel` route mirroring `confirm/route.ts` but **without** `assertRole(ADMINISTRADOR)`. The service (`cancelAppointment`) owns all business logic: `assertOwnership` → `ensureFuture` → `canTransition` → `updateTurnoStatus`. Route only wires auth, UUID parsing, DI config, error envelope, and `200` response.

## Architecture Decisions

### Decision: No `assertRole` in cancel route

**Choice**: `requireAuth` only; `assertOwnership` lives in the service.
**Alternatives considered**: Copy `assertRole(ADMINISTRADOR)` from `confirm`/`reject` (would block owner CLIENTE with 403).
**Rationale**: Spec FL-03b requires owner CLIENTE or ADMINISTRADOR. Service `assertOwnership` provides ADMIN bypass automatically. Route-level `assertRole` would reject valid owner CLIENTE callers — the most critical bug to avoid.

### Decision: DI shape matches confirm/reject for consistency

**Choice**: `config: Pick<typeof workshopConfig, "timezone" | "operatingHours" | "capacityPerSlot">` passed to `cancelAppointment`.
**Alternatives considered**: Pass only `timezone` (cancel doesn't use capacity/operatingHours).
**Rationale**: Keeps deps shape uniform across all three transition routes; service ignores extra fields. Tests assert this shape to catch accidental DI drift.

### Decision: No `new Date()` in route

**Choice**: Route creates no clock; `cancelAppointment` uses `getNow(deps)` internally.
**Alternatives considered**: Route injects `now` via deps.
**Rationale**: INV-06 / H-12 time borders (`08:59` allow, `09:00:00` reject) must be deterministic and testable. Clock injection lives at the service layer where `getNow` supports `deps.now`. Route stays thin.

## Data Flow

```
PATCH /api/appointments/[id]/cancel
  │ middleware (auth guard)
  ├─ requireAuth(req)                  → 401 UNAUTHORIZED
  ├─ uuidSchema.parse(id)              → 400 VALIDATION_ERROR
  ├─ cancelAppointment({db, config}, id, authUser)
  │    ├─ loadOr404 → 404 NOT_FOUND
  │    ├─ assertOwnership → 403 FORBIDDEN (CLIENTE non-owner)
  │    ├─ ensureFuture(now, start) → 409 INVALID_APPOINTMENT_STATE "El turno ya comenzó"
  │    ├─ canTransition opts        → 409 INVALID_APPOINTMENT_STATE
  │    └─ updateTurnoStatus → toTurnoDTO → TurnoDTO {status:"CANCELADO"}
  └─ NextResponse.json(dto, {status:200})
```

Ownership check (service) precedes time check — prevents timing oracle on non-owner requests.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/appointments/[id]/cancel/route.ts` | Create | Thin PATCH, `requireAuth` only, `cancelAppointment` DI, error map |
| `src/app/api/appointments/[id]/cancel/route.test.ts` | Create | Mocked auth/service, table-driven ownership + border cases |

**Unchanged (consumed)**: `appointmentService.ts#cancelAppointment`, `appointmentStateMachine.ts`, `turnos.ts#updateTurnoStatus`, `requireAuth.ts`, `errors.ts`.

## Interfaces / Contracts

```ts
// Route signature
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse>

// Success response
// 200 { id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status: "CANCELADO", ... }

// Error envelope (§12)
{ error: { code: string, message: string, issues?: ZodIssue[] } }

// Error code → status mapping
UNAUTHORIZED → 401 | FORBIDDEN → 403 | VALIDATION_ERROR → 400
APPOINTMENT_NOT_FOUND → 404 | INVALID_APPOINTMENT_STATE → 409
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (route) | Error mapping, auth precedence, DTO shape, DI config | `vi.mock` auth + service, table-driven cases |
| Unit (service) | Already covered T-027 | Not in scope |
| E2E | Not in scope | — |

Route test cases (mirrors `confirm/route.test.ts` + cancel-specific ownership):

| Case | Auth | Expected |
|------|------|----------|
| Unauth + malformed UUID | throws `UnauthorizedError` | `401` before `400` |
| Non-owner CLIENTE | `requireAuth` ok, service throws `ForbiddenError` | `403` before `409` |
| Malformed UUID | auth ok | `400 VALIDATION_ERROR` + `issues` |
| Unknown UUID | auth ok, service throws `AppointmentNotFoundError` | `404` |
| Terminal state (`RECHAZADO`/`CANCELADO`) | service throws `InvalidAppointmentStateError` | `409` |
| `now >= start` | service throws `InvalidAppointmentStateError` "El turno ya comenzó" | `409` |
| Owner CLIENTE future | service returns `CANCELADO` DTO | `200` + no snake leak |
| ADMIN any owner future | service returns `CANCELADO` DTO | `200` |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollback

No migration required. Rollback: delete `src/app/api/appointments/[id]/cancel/` directory. No data impact.

## Open Questions

None.
