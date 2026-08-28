# Design: T-026 Availability Critical Tests [EC-02]

## Technical Approach

Pure-test architecture with no behavior mutation. Composition is achieved by calling existing pure functions (`getAvailableSlotsForDate`, `getAvailableSlots`, `generateSlotsForDate`, `formatSlotsAsHHmm`) through a `vi.fn()` mocked `fetchActiveTurnos` adapter. The suite proves the chain: **generation → inclusive boundary ≤ → count < capacity → 200 []**. It does not re-prove lower-layer invariants (half-open `[)`, `durationSchema` bounds, DST via `Intl`).

## Architecture Decisions

### Decision: Pure wrapper over direct pure-core calls

**Choice**: Test `getAvailableSlotsForDate` (async wrapper) with `vi.fn()` fetch, not `getAvailableSlots` directly.
**Alternatives considered**: (a) Call `getAvailableSlots` pure directly — skips `getBaDayUtcRange` DST oracle path. (b) Expand existing `availabilityService.test.ts` — bloats a 151-line file.
**Rationale**: The wrapper is the production I/O boundary. It calls `getBaDayUtcRange` once and passes the range to `fetchActiveTurnos`. Testing through the wrapper exercises the same DST-aware range computation the route handler uses. Existing `availabilityService.test.ts` already covers the direct pure path; T-026 covers composition.

### Decision: `vi.fn()` mock replacing `findActiveTurnosByDateRange` adapter

**Choice**: `vi.fn(async () => existingEntries)` injected as `fetchActiveTurnos`.
**Alternatives considered**: (a) Mock `@/db/repositories/turnos` module — leaks implementation detail. (b) Real Postgres — `ECONNREFUSED` without Docker.
**Rationale**: `fetchActiveTurnos` is already a `FetchActiveTurnos` interface (`(range) => Promise<ExistingEntry[]>`) in the production signature. Injecting a `vi.fn()` is the canonical vitest pattern used in `availabilityService.test.ts` lines 64–66 and 93–122. No module-level mock of the repository is needed.

### Decision: Table-driven cases with `it.each` for capacity and duration

**Choice**: Inline table arrays for `capacity 1/2/3 × overlap 0/1/2` and `duration 30/60/90/120 × expected-count`.
**Alternatives considered**: (a) Separate `it()` per case — 20+ cases, high repetition. (b) Parametrize via external JSON — over-engineering for 7 requirements.
**Rationale**: `it.each` is used in `availabilityService.test.ts` line 45 for duration validation. T-026 extends the same pattern for overlap capacity and duration counts. Keeps all cases visible in one describe block with minimal boilerplate.

### Decision: EC-02 named route assertions in existing `route.test.ts`

**Choice**: Add two `it("EC-02 …")` blocks to the existing `route.test.ts` `describe("GET /api/availability — delegation & response")` section, one for fully-booked and one for closed Saturday.
**Alternatives considered**: (a) New `route.ec02.test.ts` — extra file, minimal content. (b) `it.only` tag — changes test runner behavior.
**Rationale**: `route.test.ts` already has a fully-booked `200 []` case (lines 306–320) and a closed Saturday `200 []` case (lines 294–304). Adding explicit `EC-02` in the name satisfies the traceability requirement (`sdd-verify` can grep for `EC-02`). Two `it` blocks, ~15 lines total, stays within the 400-line budget.

## Data Flow

```
vitest server-only
       │
       ▼
t026-availability-critical.test.ts
       │
       ├── makeConfig()           → workshopConfigSchema.parse({})
       ├── e(s,en,st)            → ExistingEntry fixture (BA wall Date)
       ├── vi.fn() mock fetch    → FetchActiveTurnos stub
       │
       ▼
getAvailableSlotsForDate({ fetchActiveTurnos: mock })
       │
       ├── getBaDayUtcRange(date, tz)  ← DST-aware via Intl
       ├── mock({ fromUtc, toUtc })   ← returns ExistingEntry[]
       │
       ▼
getAvailableSlots({ existingTurnos })  ← pure
       │
       ├── generateSlotsForDate()      ← step=30, filtered by calculateEndAndValidate
       │    └── calculateEndAndValidate → valid=false for 11:30+90 (exceeds interval)
       │
       └── isSlotAvailable()           ← countOverlapping < capacityPerSlot
            └── countOverlapping        ← ACTIVE_STATUSES filter, half-open [)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/services/availability/__tests__/t026-availability-critical.test.ts` | Create | 7 T-026 minima + EC-02; ~190 lines; pure with mocked fetch |
| `src/app/api/availability/route.test.ts` | Modify | Add 2 EC-02 named `it()` blocks in `delegation & response` describe; ~15 lines added |

## Interfaces / Contracts

```typescript
// Existing — no new interfaces introduced

// Existing: FetchActiveTurnos (availabilityService.ts)
type FetchActiveTurnos = (range: { fromUtc: Date; toUtc: Date }) => Promise<ExistingEntry[]>;
type ExistingEntry = { start: Date; end: Date; status: string };

// Existing: WorkshopConfig DI
type WorkshopConfig = { timezone: string; slotStepMinutes: number; capacityPerSlot: number; operatingHours: ... };

// Existing: getAvailableSlotsForDate signature used by T-026
function getAvailableSlotsForDate(args: {
  date: Date;
  durationMinutes: number;
  config: WorkshopConfig;
  fetchActiveTurnos: FetchActiveTurnos;
}): Promise<Slot[]>;

// Existing: Slot type
type Slot = { start: Date; end: Date };

// Test helper shape (mirrors availabilityService.test.ts lines 9-15)
function makeConfig(o?: Partial<WorkshopConfig>): WorkshopConfig;
function e(s: string, en: string, st: string): ExistingEntry; // BA wall Date
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | 7 T-026 minima via `getAvailableSlotsForDate` + `vi.fn()` mock | Table-driven `it.each` for capacity×overlap and duration×count; boundary `11:00+60` valid / `11:30+90` invalid; EC-02 service-level `200 []` |
| Integration | EC-02 HTTP contract via `GET /api/availability` route | Two named `it("EC-02 …")` blocks asserting `200 {availableSlots:[]}` with `error` key absent |

### Test Matrix (7 requirements → cases)

| Req | Description | Cases |
|-----|-------------|-------|
| R1 Empty-day | No existing turnos → all candidates | 1 (MON 60min → 12 slots) |
| R2 Single occupancy | PENDIENTE / CONFIRMADO blocks `09:00,09:30` not `10:00` | 2 (each status) |
| R3 Count vs capacity | `capacity=1/1 overlap→blocked`, `capacity=2/1→available`, `capacity=2/2→blocked` | 3 via `it.each` |
| R4 Duration filter | `30→14`, `60→12`, `90→10`, `120→8` on empty day | 4 via `it.each` |
| R5 Outside hours | Saturday `[]`; `13:00-14:00` existing outside intervals → no effect on morning | 2 |
| R6 EC-02 | `200 {availableSlots:[]}` no `error` for fully-booked 60/90 and closed Saturday | 3 service + 2 route |
| R7 11:30+90 exclusion | `11:30` never generated; `10:30+90==12:00` present; `calculateEndAndValidate` → `valid=false` | 2 |

**Total**: ~12–14 `it` blocks in 1 describe, ~190 lines. No DB, no new deps, vitest `server-only`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in this pure-test change.

## Migration / Rollback

No migration required. Rollback: delete `t026-availability-critical.test.ts` and remove the 2 added `it()` blocks from `route.test.ts`. `vitest run` returns to prior green state.

## Open Questions

- [ ] None — all decisions resolved in proposal/spec/exploration phases.
