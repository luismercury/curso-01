# Design: t034-lifecycle-tests — Exhaustive RN-07 Lifecycle Coverage

## Technical Approach

T-034 is a **test-only change** (no prod code, no DB, no new routes). It closes FASE 6 coverage gaps by adding two new test files that exhaustively prove the RN-07 transition matrix, H-12 UTC borders, H-13 guard ordering, and EC-04 visibility — all via `vi.mock` with deterministic UTC dates.

## Architecture Decisions

### Decision: Pure unit + mocked service vs Live DB

| Option | Verdict | Rationale |
|--------|---------|-----------|
| Pure unit (`canTransition` matrix) + mocked `AppointmentService` | **Selected** | No DB; `<400` LOC; deterministic; proven harness from existing `appointmentService.test.ts` |
| Thin-DB mock via `db.select` chain | Rejected | Brittle, duplicates `turnos.query.test.ts` |
| Live Postgres E2E | Rejected | Needs Docker; `ECONNREFUSED`; overkill; exceeds budget |

### Decision: vi.mock repos vs real drizzle mock

| Option | Verdict | Rationale |
|--------|---------|-----------|
| `vi.mock` with manual mock chain (existing pattern) | **Selected** | Same harness as `appointmentService.test.ts`; easy spy assertions |
| Real drizzle `mockDb` object | Rejected | Overlaps brittle `turnos.query.test.ts` pattern; more setup |

### Decision: `deps.now` injection vs fake timers

| Option | Verdict | Rationale |
|--------|---------|-----------|
| `deps.now: Date` injection (already DI in `AppointmentServiceDeps`) | **Selected** | Strict UTC `getTime()` comparison; deterministic; no `vi.useFakeTimers` side-effects |
| `vi.useFakeTimers` / `Date.now` override | Rejected | Global; can leak between tests; harder to assert precise `<` border |

## Data Flow

### Layer 1 — Domain matrix (`src/domain/__tests__/t034.lifecycle.matrix.test.ts`)

```
it.each(32 combos) → canTransition(from, to, role, opts?)
  → from, to ∈ [PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO]
  → role ∈ [CLIENTE, ADMINISTRADOR]
  → opts = { now, startDateTime } for CANCELADO paths
  → expect: true (4 allowed) | false (28 invalid)
```

Time guard rows: `now=11:59Z` (allow) vs `now=12:00Z` (reject) vs `now=12:00:01Z` (reject), with `start=12:00Z` (BA 09:00).

### Layer 2 — Service integration (`src/services/__tests__/appointmentLifecycle.test.ts`)

```
beforeEach → vi.clearAllMocks()
AuthUser fixtures (CLIENTE aaaa…, ADMINISTRADOR cccc…)
TurnoDTO fixtures (startDateTime: new Date("2026-09-10T12:00:00.000Z") = BA 09:00)

Lifecycle chains:
  confirmAppointment(deps, id, ADMIN) → mockFindTurnoById(PENDIENTE) → mockUpdateTurnoStatus → expect status CONFIRMADO
  rejectAppointment(deps, id, ADMIN)  → mockFindTurnoById(PENDIENTE) → mockUpdateTurnoStatus → expect status RECHAZADO
  cancelAppointment(deps, id, owner)  → mockFindTurnoById + assertOwnership → expect CANCELADO
  cancelAppointment(deps, id, ADMIN)  → mockFindTurnoById + assertOwnership → expect CANCELADO (CONFIRMADO→CANCELADO)

Invalid 409s:
  each of 4 invalid transitions → InvalidAppointmentStateError → code "INVALID_APPOINTMENT_STATE"

H-12 borders (confirm + cancel):
  now=11:59Z → 200; now=12:00Z | 12:00:01Z → 409 "El turno ya comenzó"
  EC-03: CONFIRMADO + now>=start → 409 (not just PENDIENTE)

H-13 guards before lock:
  findServicioById({active:false}) → InvalidServiceError 400; expect countActiveOverlappingForUpdate.not.toHaveBeenCalled()
  findVehiculoById({customerId:CLIENTE_2}) → ForbiddenError 403; expect countActiveOverlappingForUpdate.not.toHaveBeenCalled()

H-11/EC-04 visibility:
  listAppointments(CLIENTE, {}) → findTurnosPaginated called with customerId + includeCancelled=false + includeRejected=false
  listAppointments(CLIENTE, {includeRejected:true}) → flag forwarded; RECHAZADO included
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/__tests__/t034.lifecycle.matrix.test.ts` | Create | 32-cell `canTransition` matrix + time guard rows (~80 LOC) |
| `src/services/__tests__/appointmentLifecycle.test.ts` | Create | Lifecycle chains, 4×409, H-12 trio, H-13, H-11/EC-04 (~250 LOC) |
| `src/domain/appointmentStateMachine.ts` | Read-only | Pure `canTransition` source of truth |
| `src/services/appointmentService.ts` | Read-only | Confirmed via mocks only |
| `src/lib/http/errors.ts` | Read-only | Error code constants |
| `src/config/workshopConfig.ts` | Read-only | BA timezone, capacity=1 |
| `src/db/repositories/turnos.ts` | Read-only | Repo signatures |
| `src/lib/auth/requireAuth.ts` | Read-only | AuthUser, ForbiddenError |

**No production files modified.**

## Interfaces / Contracts

### Test fixtures (both files)

```typescript
// AuthUser
const ADMIN = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "ADMINISTRADOR" as const, email: "a@a.com" };
const CLIENTE = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "CLIENTE" as const, email: "c@c.com" };
const CLIENTE_2 = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role: "CLIENTE" as const, email: "c2@c.com" };

// TurnoDTO — BA 09:00 = UTC 12:00Z
const START_09Z = new Date("2026-09-10T12:00:00.000Z"); // 09:00 BA
const makeTurno = (overrides) => ({ id: "33333333-3333-4333-8333-333333333333", customerId: CLIENTE.id, startDateTime: START_09Z, status: "PENDIENTE", ...overrides });

// Config
const config = { timezone: "America/Argentina/Buenos_Aires", operatingHours: undefined, capacityPerSlot: 1 };
```

### Mock setup (service file)

```typescript
vi.mock("@/db/repositories/turnos", async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;
  return {
    ...orig,
    findTurnoById: vi.fn((...a) => mockFindTurnoById(...a)),
    updateTurnoStatus: vi.fn((...a) => mockUpdateTurnoStatus(...a)),
    findTurnosPaginated: vi.fn((...a) => mockFindTurnosPaginated(...a)),
    countActiveOverlappingForUpdate: vi.fn((...a) => mockCountActiveOverlappingForUpdate(...a)),
  };
});
vi.mock("@/db/repositories/vehiculos", () => ({ findVehiculoById: vi.fn((...a) => mockFindVehiculoById(...a)) }));
vi.mock("@/db/repositories/servicios", () => ({ findServicioById: vi.fn((...a) => mockFindServicioById(...a)) }));
```

### Error assertions (§12 envelope)

```typescript
// 409 INVALID_APPOINTMENT_STATE
await expect(fn(...)).rejects.toMatchObject({ code: "INVALID_APPOINTMENT_STATE" });
await expect(fn(...)).rejects.toThrow("El turno ya comenzó"); // H-12/EC-03 past

// 400 INVALID_SERVICE
await expect(createAppointment(...)).rejects.toMatchObject({ code: "INVALID_SERVICE" });

// 403 FORBIDDEN
await expect(cancelAppointment(...)).rejects.toMatchObject({ code: "FORBIDDEN" });
```

## Testing Strategy

| Requirement | Layer | File | Scenarios |
|------------|-------|------|-----------|
| RN-07 matrix 32 cells | Unit | `t034.lifecycle.matrix.test.ts` | 32 `it.each` combos → `canTransition` → true/false |
| Time guard `now<start` strict `<` | Unit | `t034.lifecycle.matrix.test.ts` | 3 rows: 08:59 allow / 09:00 reject / 09:00:01 reject |
| `isTerminal` | Unit | `t034.lifecycle.matrix.test.ts` | `isTerminal(RECHAZADO/CANCELADO) === true` |
| Lifecycle chains (4 valid) | Service | `appointmentLifecycle.test.ts` | confirm/reject/cancel with ADMIN + owner |
| 4 invalids → 409 | Service | `appointmentLifecycle.test.ts` | CONFIRMADO→CONFIRMADO, RECHAZADO→CONFIRMADO, CANCELADO→CONFIRMADO, PENDIENTE→PENDIENTE |
| EC-03 CONFIRMADO past | Service | `appointmentLifecycle.test.ts` | `CONFIRMADO` + `now>=start` → 409 "El turno ya comenzó" |
| H-12 trio cancel | Service | `appointmentLifecycle.test.ts` | `now=11:59Z/12:00Z/12:00:01Z` + `PENDIENTE\|CONFIRMADO→CANCELADO` |
| H-12 trio confirm | Service | `appointmentLifecycle.test.ts` | `now=11:59Z/12:00Z/12:00:01Z` + `PENDIENTE→CONFIRMADO` |
| H-13 inactive before lock | Service | `appointmentLifecycle.test.ts` | `active:false` → 400; count not called |
| H-13 foreign before lock | Service | `appointmentLifecycle.test.ts` | `customerId mismatch` → 403; count not called |
| H-11/EC-04 visibility | Service | `appointmentLifecycle.test.ts` | default hides RECHAZADO/CANCELADO; flags opt-in |

**Total test cases:** ~60. **Coverage target:** `AppointmentStateMachine` + `canTransition` ≥ 80%.

**Deterministic clock:** All dates explicit UTC `new Date("2026-09-10T12:00:00.000Z")` (never naive). `beforeEach` → `vi.clearAllMocks()`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Test-only change with `vi.mock` in-memory dependencies.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| H-12 off-by-one (`now>=start` vs `now>start`) | High | Strict `<` in both `canTransition` and `ensureFuture`; assert all three borders explicitly |
| Missing cell masked by route mock | Medium | Exhaustive `it.each` 32 at domain layer, not wrapped in service |
| Mock leak between tests | Medium | `vi.clearAllMocks()` in `beforeEach`; `mockReset()` per mock |
| BA naive Date (`new Date("09:00")` = UTC) | Medium | Always use explicit `Z` suffix; comment BA equivalence |
| `CONFIRMADO→CANCELADO` past not tested | Low | Explicit EC-03 scenario for `CONFIRMADO` with `now>=start` |

## Open Questions

None — all decisions resolved in `explore.md` and `proposal.md`.

## Migration / Rollout

No migration required. Test-only change. Rollback: delete the two new `*.test.ts` files.
