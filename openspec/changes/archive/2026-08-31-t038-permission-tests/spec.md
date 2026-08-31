# Delta for Appointment — t038-permission-tests (Verification-Only)

**Change:** `t038-permission-tests` — Permission Traceability Suite (FASE 7 T-038)
**Type:** NONE — informational, 0 new SHALL, 0 prod LOC
**Domains:** `appointment` (reuses existing Confirm/Query Role Gating)

## Summary

No normative change. Existing `openspec/specs/appointment/spec.md` requirements
`Confirm Appointment PENDIENTE→CONFIRMADO (T-030)` and `Query — Role Gating (T-033/T-036)`
already enforce `INV-03` auth, `RN-07` `canTransition`, `H-19` single-owner, `INV-08` DTO.
Behavior is green but scattered (`confirm/route.test.ts`, `admin/appointments/route.test.ts`);
T-038 consolidates evidence into one auditable suite
`src/app/api/__tests__/t038-permission.test.ts`. This delta documents traces only.

## Normative Delta

### ADDED Requirements

None — verification-only. No new `MUST/SHALL` introduced.

### MODIFIED Requirements

None — existing `Confirm Appointment` and `Query — Role Gating and Invariants` unchanged.

### REMOVED Requirements

None.

### RENAMED Requirements

None.

## Verification Traces (Non-Normative, 6 traces for `sdd/t038-permission-tests/spec`)

All traces reuse existing GWT; they assert no new contract.

| # | Trace | Existing Requirement | Route / Layer | Expected | Evidence |
|---|-------|----------------------|---------------|----------|----------|
| T1 | CLIENTE cannot confirm | Confirm — Forbidden CLIENTE | `PATCH /api/appointments/{id}/confirm` thin `requireAuth→assertRole` | `403 {error:{code:FORBIDDEN}}`, `confirmAppointment` NOT called | `t038-permission.test.ts` CLIENTE+VALID_UUID |
| T2 | CLIENTE cannot list all | Query — Role Gating (ADMIN sees all) | `GET /api/admin/appointments` thin `requireAuth→assertRole→parseQuery` | `403 FORBIDDEN`, `listAppointments` NOT called | same suite, `limit=101` variant proves `403` not `400` |
| T3 | ADMIN can confirm | Confirm — Happy path ADMIN | `PATCH .../confirm` → `confirmAppointment` | `200 TurnoDTO status:CONFIRMADO`, INV-08 no `estado`/`fecha_hora_inicio` leak | same suite, asserts `toTurnoDTO` camelCase + `status` |
| T4 | ADMIN can list agenda | Query — Role Gating + Date Filter (BA) | `GET /api/admin/appointments?date=YYYY-MM-DD` | `200 {data:TurnoDTO[], pagination:{page,limit,total,totalPages}}` ordered `asc`, BA half-open | same suite, `?date=2026-09-10` passthrough, `listMock` called with `role=ADMINISTRADOR` |
| T5 | Precedence 401→403→400 | Confirm + Query — Unauthenticated / Validation order | Both routes | unauth+malformed UUID → `401` not `400`; CLIENTE `limit=101` → `403` not `400`; ADMIN `limit=101` → `400 VALIDATION_ERROR` | T5a/b/c in suite, `requireAuth` before `uuidSchema`/`parseAppointmentQuery` |
| T6 | Defense-in-depth | State Transition Matrix via `canTransition` (RN-07) | `appointmentService.confirmAppointment` direct (no route) | `CLIENTE` `PENDIENTE→CONFIRMADO` → `409 INVALID_APPOINTMENT_STATE` via `canTransition(...,CLIENTE)=false` | suite `describe defense-in-depth` uses real `canTransition`, not mocked service |

### Coverage notes

- **H-19 single-owner:** routes stay thin; `AppointmentService` owns transitions — proven by `service not called` on T1/T2 `403`.
- **INV-03 auth:** `requireAuth` JWT (`authjs.session-token` httpOnly) → `401 UNAUTHORIZED`; `assertRole(ADMINISTRADOR)` → `403 FORBIDDEN` before validation (T5).
- **RN-07:** `canTransition(PENDIENTE,CONFIRMADO,ADMIN)=true`, `CLIENTE=false` — route `403` vs service `409` distinction is invariant (T6).
- **INV-08:** T3/T4 assert `status` not `estado`, `startDateTime`/`endDateTime` not `fecha_hora_*`.
- **Out of scope:** E2E/DB/JWT, capacity/slot/timezone, schema/UI — no change.

## References (non-normative)

- Existing spec: `openspec/specs/appointment/spec.md` — Confirm/Reject/Cancel + Query Filters/Ranges/Pagination + Role Gating (401 before 400, 403).
- `openspec/specs/workshop-schedule/spec.md` — unchanged.
- Harness: `vi.mock("server-only")`, `vi.mock("@/services/appointmentService")`, `vi.mock("@/lib/auth/requireAuth")` copied from T-030/T-036; fixtures `ADMIN`/`CLIENTE`, `VALID_UUID`/`MALFORMED_UUID`.
