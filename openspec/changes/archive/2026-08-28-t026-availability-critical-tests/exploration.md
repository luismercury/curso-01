# Exploration: t026-availability-critical-tests

## Current State

### How the system works today (FASE 5, frozen predecessors)

Availability is **pure core + thin handler + bulk-fetch adapter**:

- **WorkshopConfig** (`src/config/workshopConfig.ts`): `capacityPerSlot=1`, `slotStepMinutes=30`, `timezone=America/Argentina/Buenos_Aires`, `operatingHours` = `09:00-12:00 / 14:00-18:00` Mon-Fri (parametrizable, validated via `workshopSchedule.ts`). DI everywhere; no hardcoded `09:00`, `30`, or `-03:00` in domain code.

- **Helpers**:
  - `slotGenerator.ts` (`generateSlotsForDate`, `baWallTimeToUtcDate`, `formatSlotsAsHHmm`): generates candidates with `step=30`, converts BA wall `HH:mm` → UTC via `Intl.DateTimeFormat` offset delta (DST-aware), filters each candidate through `calculateEndAndValidate` requiring `fechaHoraFin <= finIntervaloOperativo` inclusive (`11:00+60==12:00 valid`, `11:30+60 invalid`).
  - `duration.ts` (`durationSchema 30..120 %5`, `calculateEndAndValidate`, `findContainingInterval`, `parseIsoToUtc`): validates `end = start + duration` against containing interval, DST-aware via `config.timezone`.
  - `overlap.ts` (`isOverlapping` half-open `[)` via `getTime()`, `countOverlapping` filtered by `ACTIVE_STATUSES=['PENDIENTE','CONFIRMADO']`, `isSlotAvailable` requires `count < capacityPerSlot` integer >=1, documents `tstzrange && FOR UPDATE` / `EXCLUDE USING gist` contract for T-028).
  - `availabilityService.ts` (`getAvailableSlots` pure: `generateSlotsForDate` + `isSlotAvailable` filter; `getAvailableSlotsForDate` async wrapper: computes BA-day UTC range `getBaDayUtcRange(date|YYYY-MM-DD, timezone)` via `baWallTimeToUtcDate("00:00")` DST-aware, single bulk `fetchActiveTurnos({fromUtc,toUtc})`, delegates to pure; `getBaDayUtcRange` supports string and Date overloads).
  - `turnos.ts` (`findActiveTurnosByDateRange`): SQL `tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($from,$to) AND estado IN ('PENDIENTE','CONFIRMADO')`, returns `ExistingEntry[]` (DB adapter).
  - `route.ts` (`GET /api/availability?date=YYYY-MM-DD&serviceId=uuid`): `requireAuth` before parse, Zod `.strict()` (unknown params → 400), calendar overflow `2026-02-30` → 400 via `getBaDayUtcRange` + `noonCheck`, `getServiceById` → 404 `SERVICE_NOT_FOUND` vs 400 bad format, `!active` → 400 `INVALID_SERVICE` no fetch, DI `WorkshopConfig`, adapter `findActiveTurnosByDateRange`, noon sentinel `new Date('YYYY-MM-DDT12:00:00.000Z')` for BA `ymd` via Intl, `400` for invalid `durationMinutes` (25/29/65.5/121), `200 {date, availableSlots: HH:mm[]}` sorted, closed day / fully booked → `200 []` (not error).

- **Test runner**: `vitest` (`vitest.config.ts` `include src/**/*.{test,spec}.{ts,tsx}`, `node` env). All FASE 5 unit tests mock `server-only`. DB integration tests fail locally without Postgres (`ECONNREFUSED ::1:5432`) — pure tests are green.

### Existing tests (FASE 5, coverage inventory)

| File | What it covers | Gaps for T-026 EC-02 |
|------|---------------|----------------------|
| `slotGenerator.test.ts` | 60→12 / 90→10 / 120→8 / 30→14 slots; inclusive `11:00+60` valid vs `11:30+90` excluded; midnight `00:30Z` → previous BA day; NY DST not hardcoded; `slotStep 15` superset, `UTC 09:00BA=12:00Z`; purity guards | Durations via pure generator only, not through `AvailabilityService` with real overlap filtering |
| `duration.test.ts` | `durationSchema` bounds 30..120 %5; `parseIsoToUtc`; `findContainingInterval` outside → undefined; `calculateEndAndValidate` inclusive table `11:30+90/60` exceeds; NY vs BA `intervalEnd` DST divergence | No availability-level `11:30+90` full-flow through `getAvailableSlots` → `[]` |
| `overlap.test.ts` | Half-open adjacency not overlapping; `countOverlapping` ignores `RECHAZADO/CANCELADO`; `isSlotAvailable` capacity 1 vs 2 vs 3, invalid capacity 400; purity `getTime()` only, no drizzle | Capacity filtering tested in isolation, not via `AvailabilityService` candidate filtering count |
| `availabilityService.test.ts` | Pure: empty→12, partial `09:00-10:00` blocks `09:00/09:30` not `10:00`, full occupancy `[]`, closed Sat `[]`, invalid duration/Date 400, capacity `2` with 1 available 2 blocked, `slotStep 15` superset, wrapper: single bulk fetch BA range once, `RECHAZADO/CANCELADO` not blocking, closed still fetches once, purity DI no hardcoded `-03:00` | Missing: 90/120 duration via service with partial/full occupancy; `11:30+90` closure filtered then overlap; multi-overlap count vs capacity table through service; explicit EC-02 named scenario "no hay disponibilidad" with message assertion |
| `route.test.ts` | Auth before parse (401/403 no DB), strict validation 400, `SERVICE_NOT_FOUND` 404 vs `INVALID_SERVICE` 400, valid weekday `200 12 sorted` + `HH:mm` + no `snake_case`, closed Sat `200 []` still fetches once, fully booked `200 []`, half-open `09:00-10:00` not blocking `10:00`, single bulk fetch BA range verified, DST `getBaDayUtcRange` string vs Date + NY offsets, `slotStep 15` superset | EC-02 presence is implicit (closed + fully booked). No named `EC-02 Sin disponibilidad` test with assertion that `200 []` is the correct "no hay disponibilidad" signal, no `90 min` fully booked variant, no `11:30+90` not-generated slot assertion at route level, no `fuera de apertura` 13:00 wall-time excluded |

**Duplication already avoided**: duration bounds, half-open, capacity DI, DST via `Intl` are each tested once in their owner file and re-used via import checks (`server-only`, no `@/db`). T-026 must not re-test them exhaustively.

## Affected Areas

- `src/services/availability/availabilityService.ts` — pure core `getAvailableSlots` and wrapper `getAvailableSlotsForDate` + `getBaDayUtcRange` (subject of critical tests)
- `src/services/availability/slotGenerator.ts` — candidate generation and duration filter (duration interaction, crossing closure)
- `src/services/availability/overlap.ts` — `count < capacityPerSlot` counting (overlap with capacity >1 future)
- `src/services/availability/duration.ts` — inclusive `<= finIntervaloOperativo` and `findContainingInterval` (fuera de apertura)
- `src/app/api/availability/route.ts` — thin handler strict validation, `INACTIVE → INVALID_SERVICE`, `200 []` EC-02 contract
- `src/config/workshopConfig.ts` / `src/config/workshopSchedule.ts` — DI config, `DEFAULT_OPERATING_INTERVALS`, `validateIntervals`
- `src/db/repositories/turnos.ts` — `findActiveTurnosByDateRange` adapter (`tstzrange &&`, `ACTIVE_STATUSES`) — out of scope for DB integration (mocked in T-026), only adapter contract
- `vitest.config.ts` / `package.json` — test runner `vitest run`, `server-only` mock pattern, no new deps
- `openspec/specs/` — no delta required (T-026 is edge-case coverage, not behavior change)

## Approaches

### 1. Dedicated pure + thin handler file(s) — recommended

Create one new file `src/services/availability/__tests__/t026-availability-critical.test.ts` (or `availability.critical.test.ts`) covering all 7 T-026 minima via the pure wrapper `getAvailableSlotsForDate` with mocked `fetchActiveTurnos` (no DB), plus 1–2 named EC-02 route assertions added to `src/app/api/availability/route.test.ts` (or a tiny `t026-ec02.route.test.ts` file) verifying `200 {availableSlots: []}` is the "no hay disponibilidad" signal.

- Pros: Minimal blast radius, no duplication of T-021..T-025 exhaustive cases; pure tests are deterministic and fast (no Postgres); `INTL` DST and inclusive boundary exercised at the correct layer; EC-02 verified at both service and HTTP contract; follows established colocated `__tests__` pattern; easy to keep <150 lines and under 400-line review budget
- Cons: Requires discipline to inject `vi.fn()` fetch and build BA wall `Date` fixtures (`new Date('2026-09-07T09:00:00-03:00')`) consistently; must share helper `makeConfig` / `e()` across files or duplicate small helper
- Effort: Low

### 2. Expand existing files in place (no new file)

Add the 7 scenarios directly into `availabilityService.test.ts` and `route.test.ts` as additional `describe("T-026 critical")` blocks.

- Pros: Zero new files, keeps coverage in canonical files
- Cons: Bloates already ~150–395 line files; mixes T-026 traceability (EC-02) with lower-level unit tests; harder for `sdd-verify` to attribute T-026 coverage; review diff mixes old and new concerns
- Effort: Low

### 3. DB-backed integration suite

Spin up Postgres and run `getAvailableSlotsForDate` against real `insert turno` + `findActiveTurnosByDateRange` via `drizzle-orm` with `REPEATABLE READ`.

- Pros: Exercises real `tstzrange &&` SQL and `EXCLUDE` constraint
- Cons: Needs running DB in CI, flaky, slow, already covered by T-009/T-028; violates T-026's intent (critical availability logic, not DB plumbing); duplication of `overlap`/`slotGenerator` integration; requires `DATABASE_URL` and seed, unlike all current T-024/T-025 pure tests which mock fetch
- Effort: High

## Recommendation

**Adopt Approach 1** (dedicated pure file + minimal route EC-02 named test), because:

1. T-026's frozen predecessors (T-019b..T-025) already enforce pure core, DI, `server-only`, `WorkshopConfig` parametization. T-026 must verify **composition** (generation → duration filter → overlap count → handler) without re-proving each layer's invariants. A single focused file `src/services/availability/__tests__/t026-availability-critical.test.ts` with table-driven cases satisfies the 7 minima and EC-02 traceability while keeping duplication near zero.
2. Hybrid artifact store already exists (`sdd-init/curso-01` stable, `artifact_store.mode=both`). The pure file can assert `server-only`, no `@/db`, no hardcoded `-03:00`/`capacity=1` once and delegate bounds to the owner files. Route EC-02 assertion belongs at handler level where `200 []` vs `4XX` distinction is explicit.
3. Pure mock is faster and already proven: `availabilityService.test.ts` demonstrates the pattern (`vi.fn(async ()=>[ExistingEntry])`, `getBaDayUtcRange` oracle, `formatSlotsAsHHmm` presentation). Re-using it isolates T-026 from `ECONNREFUSED` integration failures observed in `pnpm exec vitest run` (integration tests requiring Postgres).
4. Keeps review budget safe: estimated +110–160 authored lines (service) + ~25 lines route addition = ~185 lines < 400 budget; no chained PR needed (`Chained PRs recommended: No`).

### What exactly T-026 should test (ratifiable checklist)

All tests construct config via `workshopConfigSchema.parse({})` (DI) and use BA wall fixtures `new Date('YYYY-MM-DDTHH:mm:00-03:00')` or `baWallTimeToUtcDate`. No DB.

**`src/services/availability/__tests__/t026-availability-critical.test.ts` — pure with mocked fetch (proposed)**:

- **1. Día sin turnos (empty)**: `MON 2026-09-07 60min, existing=[]` → `getAvailableSlots` == `generateSlotsForDate` (12 slots), wrapper `fetchActiveTurnos` mocked `[]` returns same; asserts `["09:00",..., "17:00"]` sorted.
- **2. Un turno existente capacity 1 → slot ocupado**: existing `09:00-10:00 PENDIENTE`, `duration 60` → `09:00,09:30` absent, `10:00` present; second variant `existing 09:00-10:00 CONFIRMADO` same result (proves `ACTIVE_STATUSES` both block). Use `isSlotAvailable` indirectly via service.
- **3. Turnos superpuestos con conteo vs capacity**: table `capacity=1` with `1 overlap → blocked`, `capacity=2` with `1 overlap → available, 2 overlaps same slot → blocked`, `capacity=3` with `2 overlaps → available`. Fixtures: two existing both `09:00-10:00` (`PENDIENTE` + `CONFIRMADO`) overlapping candidate `09:00 60min` and `09:30 60min` (shared count). Assert `formatSlotsAsHHmm` contains/not contains accordingly. Proves count-based not boolean.
- **4. Servicio 1h y varias horas (filtrado por duración y cruce cierre)**:
  - `60 min` → 12 slots (includes `11:00` inclusive edge `11:00+60==12:00 valid`).
  - `90 min` → 10 slots (last morning `10:30`, afternoon `16:30`; `11:00` excluded because `11:00+90=12:30>12:00`).
  - `120 min` → 8 slots.
  - `30 min` → 14 slots includes `11:30` and `17:30`.
  - Assert via wrapper with `durationMinutes` param; empty existing so only duration filter applies.
- **5. Horario fuera de apertura**: exists `existing 13:00-14:00 PENDIENTE` (outside intervals) → does **not** affect `09:00` candidate (not overlapping any candidate). Closed Saturday `2026-09-12` with `duration 60` → `[]` even with mocked existing `09:00-10:00` (generated candidates `[]` before filtering). Also: `calculateEndAndValidate` fuera `08:59` and `12:00` edge excluded proven via `candidate not generated`.
- **6. Sin disponibilidad — EC-02 (trazabilidad explícita)**:
  - **Full occupancy 60 min**: `candidates.map(c=>{start:c.start,end:c.end,status:'PENDIENTE'})` as existing → service returns `[]`, wrapper with mocked fetch returns `[]`.
  - **Full occupancy 90 min**: same but with `90 min` candidates (10 slots) fully booked → `[]`.
  - **Assertion**: result `[]` is pure `Slot[]` (service) and, at route level (see below), `200 {availableSlots:[]}` distinct from `400/404`. Test names must contain `EC-02` and assert no `ValidationError` thrown for empty convenience — `200` is the "no hay disponibilidad" inform — not an error envelope.
- **7. Slot que cruza cierre 11:30+90 → debe rechazarse (T-022b)**:
  - `generateSlotsForDate 90 min` does not contain `11:30` nor `17:00`; `getAvailableSlots 90 min` never offers `11:30`; wrapper same.
  - Negative case: direct `calculateEndAndValidate({start: ba 11:30, duration 90})` → `valid=false` `ValidationError`. Include afternoon mirror `17:30+60` invalid for completeness.
  - Wrapper with single `existing` not needed — filtering is in generation layer; T-026 proves composition returns no `11:30` even without overlap.

**`src/app/api/availability/route.test.ts` addition (minimal, EC-02 contract)**:

- `EC-02 fully booked → 200 {availableSlots:[]}` already exists but add explicit `it("EC-02 Sin disponibilidad fully booked returns 200 [] with message-free contract")` asserting body is `{date, availableSlots:[]}` not `{error: ...}` and that `error` key is absent (client interprets empty array as "no hay disponibilidad").
- `EC-02 closed Saturday → 200 []` add named variant with same contract.
- Optional: `90 min fully booked → 200 []` route variant building `candidates 90 min` then mocking fetch — proves duration interaction survives handler DI.

**Helpers**: reuse `makeConfig(o)` via `workshopConfigSchema.parse` and `e(s,en,status)` via `new Date('YYYY-MM-DDTHH:mm:00-03:00')` (as in `availabilityService.test.ts`). No new dependencies, mock `server-only` as existing files do.

### Out of scope for T-026 (defer, do not duplicate)

- Concurrency / `REPEATABLE READ` + `SELECT FOR UPDATE` + `EXCLUDE USING gist` → `T-028/T-029/T-060` (EC-01), not availability query.
- `turnos` DB adapter real SQL parity and `EXCLUDE` constraint violation paths → `T-009` / `T-028`.
- `POST /api/appointments` booking validation (`RECHAZADO`/`CONFIRMADO` creation, `INVALID_SERVICE` for inactive service, `FORBIDDEN` for `vehiculo.clienteId != authUser.id`) → `T-015/T-028/T-034`.
- Observability (`availability latency` histogram, `conflicts_total` counter) → `T-056b`.
- `GET /api/services` public catalog and admin CRUD `PATCH /api/services/{id}` → `T-016b/T-019`.
- Auth middleware token shape / `bcrypt` rounds → `T-050/T-051`.
- UI `EC-02` rendering "No hay disponibilidad" copy → `T-042` (frontend); service contract is `availableSlots: []`.

## Risks

- **Timezone DST half-day**: `getBaDayUtcRange` DST via `Intl.DateTimeFormat` offset delta is correct for `America/Argentina/Buenos_Aires` (no DST) and `America/New_York` (23h `2026-03-08` spring-forward). Hardcoding `-03:00` in fixtures is safe only via `new Date('...-03:00')` → UTC; the implementation must keep using `Intl`, not a literal offset. Test must assert via `getBaDayUtcRange` oracle, not wall strings.
- **Inclusive boundary `<= finIntervaloOperativo`**: `11:00+60==12:00` valid vs `11:30+60>12:00` invalid is one minute away; a `getTime() <` vs `<=` slip flips 12 slots to 10. Table-driven assertions for `11:00/11:30` across 30/60/90/120 are the guard.
- **Capacity count vs boolean confusion**: `capacityPerSlot` is DI `int >=1`, default 1, no hardcoded `=1`; `count < capacity` not `count === 0`. Future capacity `2` must allow one overlap — test must cover `capacity 2 with 1 overlap → available` to lock count semantics.
- **Duration filter interaction doubling as overlap**: A slot excluded by duration (`11:30+90`) is indistinguishable from one excluded by occupancy. T-026 must isolate generation (`generateSlotsForDate` alone) before adding overlap fixtures, otherwise false confidence.
- **Mock fidelity**: `fetchActiveTurnos({fromUtc,toUtc})` must be called once with `getBaDayUtcRange(string, timezone)` exact range (already verified in existing tests). A second mock that filters by status (`RECHAZADO` ignored) diverges from `findActiveTurnosByDateRange` SQL `IN ('PENDIENTE','CONFIRMADO')`; wrapper test must include `RECHAZADO/CANCELADO` not blocking to prove adapter contract.
- **Empty vs closed ambiguity**: Both `fully booked` and `closed Saturday` return `200 []`. T-026 must name both EC-02 sub-cases separately so `sdd-verify` can trace EC-02 coverage for "no hay disponibilidad" in either condition.
- **Integration suite without Postgres**: `ECONNREFUSED :5432` observed for all `*.integration.test.ts`. T-026 must remain pure (mocked `fetch`) so it stays green in local `pnpm exec vitest run` without Docker; DB parity is proven by `findActiveTurnosByDateRange` contract test elsewhere, not here.

## Ready for Proposal

Yes — T-026 is ready to proceed to `sdd-propose` and `sdd-spec`.

**Orchestrator should tell the user**: Approve a dedicated T-026 file `src/services/availability/__tests__/t026-availability-critical.test.ts` (mocked fetch, ~12 table-driven cases covering 7 minima plus EC-02 named) and add a named `EC-02 200 []` assertion in `src/app/api/availability/route.test.ts`; no DB dependency, no new libraries, review budget Low (<200 lines), chain not needed.
