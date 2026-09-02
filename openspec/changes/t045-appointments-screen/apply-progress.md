# Apply Progress — t045-appointments-screen (T-045 UI-04)

**Apply PR1 split — data layer only, stacked-to-main (5 PRs all <400 lines).**
PR2 (surface — AppointmentList compound + RSC integration + CSS) is a
separate sdd-apply after the 5-PR stack merges.

## Stack Overview (5 PRs, all <400 lines each)

The original single-PR commit `0c68459` (+1261/-4) was split along DAG
edges so each slice is a cohesive work unit with tests-with-code:

| PR | Branch | Files | Lines | What ships |
|----|--------|-------|-------|------------|
| PR1a | `feature/t045-appointments-screen-pr1a` | 2 | 269 | EnrichedTurnoDTO + toEnrichedDTO + toEnrichedJson + ENRICHED_FALLBACK |
| PR1b | `feature/t045-appointments-screen-pr1b` | 2 | 197 | Wire-format Zod schemas (turnoDTOSchema + enrichedTurnoDTOSchema + appointmentStatusSchema) |
| PR1c | `feature/t045-appointments-screen-pr1c` | 2 | 206 | URL-state validator (parseAppointmentsQuery + pageSchema + limitSchema + appointmentsSortSchema) |
| PR1d | `feature/t045-appointments-screen-pr1d` | 2 | 345 | findTurnosPaginatedEnriched repo (single LEFT JOIN, no N+1) |
| PR1e | `feature/t045-appointments-screen-pr1e` | 3 | 336 | listAppointmentsEnriched service (IDOR defense + DI clock) + mirror doc |

**Total: 11 files, +1353/-4 across the 5-PR stack.**

## DAG + Stacking Order

```
PR1a (mapper)
 ├── PR1c (validator)         — independent, can land anytime
 └── PR1d (repo) → PR1e (service)
PR1b (api Zod)                — independent, can land anytime
```

Linear stack chosen for stacked-to-main: **PR1a → PR1b → PR1c → PR1d → PR1e**.
The chain respects DAG (PR1d depends on PR1a's mapper; PR1e depends on
PR1d's repo) while bundling the independent api/validator slices in
between.

## PR1e Files (this commit)

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `src/services/appointmentService.ts` | modify | +46/-1 | `listAppointmentsEnriched` — INV-03 customerId injection for CLIENTE, ADMIN passthrough, deps.now DI clock |
| `src/services/__tests__/appointmentService.enriched.test.ts` | create | +179 | 8 tests: IDOR regression, ADMIN passthrough, clock DI, page/limit forwarding |
| `openspec/changes/t045-appointments-screen/apply-progress.md` | create | +110 | This mirror doc |

## Phase 1 Task Status (tasks.md)

| Task | Status | Evidence |
|------|--------|----------|
| 1.1 Enriched DTO types + mappers | [x] | PR1a `src/db/mappers/turno.ts` (108L) + `turno.test.ts` 10 tests |
| 1.2 Zod strict schemas for enriched DTO | [x] | PR1b `src/lib/api/appointments.ts` turnoDTOSchema + enrichedTurnoDTOSchema + appointmentStatusSchema + 12 tests |
| 1.3 Repository LEFT JOIN method | [x] | PR1d `src/db/repositories/turnos.ts` findTurnosPaginatedEnriched + 10 tests asserting single LEFT JOIN chain |
| 1.4 Service layer listAppointmentsEnriched | [x] | PR1e `src/services/appointmentService.ts` listAppointmentsEnriched + 8 tests asserting IDOR |
| 1.5 Mapper snake leak test | [x] | PR1a `turno.test.ts` — "never leaks snake_case / Spanish DB keys (INV-08)" |
| 1.6 Zod enum + strict test | [x] | PR1b `appointments.test.ts` — turnoDTOSchema strict, appointmentStatusSchema COMPLETADO rejected |
| 1.7 Repo single-query + no N+1 test | [x] | PR1d `turnos.enriched.test.ts` — "single-query JOIN (GWT 6.2, no N+1)" |
| 1.8 Service ownership IDOR test | [x] | PR1e `appointmentService.enriched.test.ts` — "INV-03 customerId injection (IDOR defense)" |
| 1.9 Pagination clamp + enrichment null fallback test | [x] | PR1a `turno.test.ts` (NULL fallback) + PR1c `appointmentsQuery.test.ts` (parseAppointmentsQuery clamp) |

## Per-PR Verification

| PR | typecheck | vitest focused | vitest full |
|----|-----------|----------------|-------------|
| PR1a | 0 errors | 10/10 pass | 1226 + 10 = 1236 pass |
| PR1b | 0 errors | 34/22+12 pass (existing T-043 + new T-045) | +12 vs baseline |
| PR1c | 0 errors | 12/12 pass | +12 vs baseline |
| PR1d | 0 errors | 10/10 pass | +10 vs baseline |
| PR1e | 0 errors | 8/8 pass | +8 vs baseline |
| **Cumulative** | **0 errors** | **44 new tests** | **1226 + 44 = 1270 pass** |

Pre-existing baseline failures (NOT introduced by this slice, also fail on
`master` without these changes):
- `src/db/__tests__/turnos.integration.test.ts` — `server-only` mock infrastructure gap
- `src/db/__tests__/clientes.schema.test.ts` — `AUTH_SECRET` env var missing
- `src/db/__tests__/servicios.schema.test.ts` — services routes now exist (added in T-020+)

## Invariant Enforcement

- **INV-02** (UPPER_SNAKE states, no COMPLETADO): `appointmentStatusSchema`
  enum `[PENDIENTE, CONFIRMADO, RECHAZADO, CANCELADO]`. PR1b test asserts
  COMPLETADO rejected.
- **INV-03** (auth ownership): `listAppointmentsEnriched` injects
  `effectiveQuery.customerId = authUser.id` for CLIENTE, drops
  caller-supplied. PR1e test asserts `IDOR defense`.
- **INV-06** (UTC TIMESTAMPTZ): `toEnrichedJson` uses `.toISOString()`.
  `turnoDTOSchema`/`enrichedTurnoDTOSchema` use
  `z.string().datetime({ offset: true })`. PR1a + PR1b tests assert ISO
  shape `2026-09-10T12:00:00.000Z`.
- **INV-08** (snake→camel mappers): `toEnrichedDTO` renames all DB
  columns. `enrichedTurnoDTOSchema.strict()` rejects snake_case keys at
  parse time. PR1a + PR1b tests assert `not.toHaveProperty('fecha_hora_inicio')`.
- **Drizzle performance (no N+1)**: `findTurnosPaginatedEnriched` runs ONE
  count over `turnos` + ONE data select with LEFT JOIN. PR1d test asserts
  `selectMock.toHaveBeenCalledTimes(2)` and `joins.length === 2`
  referencing imported `servicios, vehiculos` table identities.

## Rollback Boundary

Reverting the 5-commit stack removes:
- `EnrichedTurnoDTO`/`EnrichedTurnoDTOJson` types (PR1a + PR1b)
- `enrichedTurnoDTOSchema`/`turnoDTOSchema`/`appointmentStatusSchema` Zod (PR1b)
- `parseAppointmentsQuery` + `appointmentsQuerySchema` (PR1c)
- `findTurnosPaginatedEnriched` repo function (PR1d)
- `listAppointmentsEnriched` service function (PR1e)

The `/appointments` page (T-044) continues to work — it still uses
`listAppointments` + `TurnoDTO` raw IDs (the design called this safe
fallback). No DB migration (no new tables, no new columns).

## Workload Note (5-way split vs original size:exception)

Original single-PR forecast was ~330 lines; actual was 1261 lines (10
files, +1371/-4). The original `sdd-apply` recommended `size:exception`
because the mapper → validator → repo → service chain looked inseparable.

On closer analysis the chain IS separable along DAG edges:
- The validator (PR1c) had no PR1 consumers — only JSDoc references in
  the repo/service. It ships as API surface for PR2 (RSC page).
- The mapper → repo → service chain is the strict DAG path (PR1a → PR1d → PR1e).
- The api Zod schemas (PR1b) extend the existing `TurnoDTOJson` interface
  in master — independent of the mapper.

Result: 5 PRs each <400 lines (269, 197, 206, 345, 336), each a cohesive
work unit with tests-with-code. No tests were orphaned, no code was
trimmed, no comments/JSDoc were compressed.

## Out of Scope (PR2 — separate sdd-apply)

- `src/app/(customer)/appointments/page.tsx` list enhancement
- `src/app/(customer)/appointments/_components/AppointmentList.tsx` (compound)
- `src/app/(customer)/appointments/_components/AppointmentCard.tsx`
- `src/app/(customer)/appointments/appointments.module.css` (tokens)
- RSC integration with timezone `Intl` + `Suspense` + URL pagination UI

## Mirror Locations (hybrid store)

- Engram: `sdd/t045-appointments-screen/apply-progress` (obs #498)
- Filesystem: `openspec/changes/t045-appointments-screen/apply-progress.md` (this file)
