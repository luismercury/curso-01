# Tasks: T-032 Cancel Appointment — PATCH /api/appointments/{id}/cancel (RN-07)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 (route 70 + tests 130) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Cancel route + tests + verify | PR 1 | `pnpm vitest run src/app/api/appointments/[id]/cancel/route.test.ts` | N/A — mocked unit | `src/app/api/appointments/[id]/cancel/` — delete → 404 |

## Phase 1: Route — Thin Cancel Without assertRole

- [x] 1.1 Create `src/app/api/appointments/[id]/cancel/route.ts` `server-only` `PATCH`: `requireAuth(req) → uuidSchema.parse(id) → cancelAppointment({db,config},id,authUser) → NextResponse.json(dto,200)`; `401 before 400`; no `assertRole`
- [x] 1.2 Wire DI `config: Pick<WorkshopConfig,"timezone"|"operatingHours"|"capacityPerSlot">` from `workshopConfig`; no `new Date()` — service `getNow` is canonical UTC (INV-06)
- [x] 1.3 Map errors via `toErrorBody`/`toValidationError` (§12): `Unauthorized→401`, `Forbidden→403`, `ZodError→400+issues`, `AppointmentNotFound→404`, `InvalidAppointmentState→409`; rethrow unknown
- [x] 1.4 Assert diff has no `assertRole`/`FOR UPDATE`/`EXCLUDE`/`capacityPerSlot`/`tstzrange` (INV-01/04/05 out-of-scope)

## Phase 2: Tests — 8 Scenarios (Mocked Route Unit)

> Mocks mirror `confirm/route.test.ts`: `server-only`, `@/db`, `@/services/appointmentService` (`cancelAppointment`), `@/lib/auth/requireAuth`.

- [x] 2.1 `401 before 400` — `UnauthorizedError` with valid UUID and malformed UUID both → `401 UNAUTHORIZED`, service not called
- [x] 2.2 `403 ownership-first` — non-owner `CLIENTE customerB` on future `PENDIENTE` (even `now>=start`) → `403 FORBIDDEN` via `ForbiddenError` before time guard
- [x] 2.3 `400 malformed UUID` — auth owner/ADMIN, `not-a-uuid` and `""` → `400 VALIDATION_ERROR` with `issues`
- [x] 2.4 `404 not found` — `AppointmentNotFoundError` → `404 APPOINTMENT_NOT_FOUND`
- [x] 2.5 `409 terminal` — `RECHAZADO`/`CANCELADO` (`now<start`) → `409 INVALID_APPOINTMENT_STATE` no mutation
- [x] 2.6 `409 H-12 borders` — `start=09:00-03:00` (12:00Z): `09:00:00` and `09:00:01` → `409 "El turno ya comenzó"`; `08:59` path covered by 200
- [x] 2.7 `200 owner` — owner `CLIENTE` future `PENDIENTE` → `200 TurnoDTO status:CANCELADO` camelCase, no `estado`/`fecha_hora_inicio` leak
- [x] 2.8 `200 ADMIN + INV-08/DI` — ADMIN future `CONFIRMADO` any owner → `200 CANCELADO` + assert `cancelAppointment` called with `{db, config:{timezone,operatingHours,capacityPerSlot}}`

## Phase 3: Verification

- [x] 3.1 Run `pnpm typecheck` (`tsc --noEmit`)
- [x] 3.2 Run `pnpm vitest run src/app/api/appointments/[id]/cancel/route.test.ts` — all 8 scenarios + DI/INV-08 green

## Spec Scenario Map

| Scenario | Task |
|----------|------|
| Happy path — owner CLIENTE PENDIENTE → CANCELADO | 2.7 |
| Happy path — ADMIN CONFIRMADO → CANCELADO | 2.8 |
| Ownership-first — non-owner 403 before time | 2.2 |
| Unauthenticated — 401 before 400 | 2.1 |
| Invalid identifier — malformed UUID 400 | 2.3 |
| Not found — 404 | 2.4 |
| Wrong state — RECHAZADO\|CANCELADO 409 | 2.5 |
| Already started — H-12 08:59/09:00/09:00:01 | 2.6 |
