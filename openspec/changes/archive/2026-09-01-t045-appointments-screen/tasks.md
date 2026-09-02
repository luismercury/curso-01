# Tasks: t045-appointments-screen — Upcoming Appointments List (T-045 UI-04)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~695 (prod ~420 + test ~275) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Suggested split | PR1 data → PR2 surface |
| Runtime harness | `pnpm dev` → `/appointments` BA rows+badge+empty+pagination |
| Chain strategy | pending — orchestrator must ask |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

> `ask-on-risk` → orchestrator asks user **before apply**: `stacked-to-main` | `feature-branch-chain` | `size:exception`.

### Work Units

| Unit | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|-----------|----------------------|-----------------|-------------------|
| 1 | PR1 data layer + unit tests | `pnpm vitest run src/db/mappers/turno.test.ts src/db/repositories/turnos.enriched.test.ts src/lib/api/appointments.test.ts src/services/appointmentService.test.ts` | `pnpm dev` → no UI change | mapper/repo/api/service; page still raw |
| 2 | PR2 surface + RSC integration | `pnpm vitest run src/app/(customer)/appointments/page.test.tsx src/app/(customer)/appointments/_components/AppointmentList.test.tsx` | `pnpm dev` → BA rows+badge+empty+pagination | `_components/*` + `page.tsx` + css |

## Phase 1: Data Layer Foundation (PR 1)

- [ ] 1.1 `src/db/mappers/turno.ts` — `EnrichedTurnoDTO extends TurnoDTO {serviceName: string\|null; vehicleLabel: string\|null}`; `toEnrichedDTO` NULL→`"Servicio/Vehículo no disponible"`; `toEnrichedJson` ISO strings [REQ-01/06, INV-08].
- [ ] 1.2 `src/lib/api/appointments.ts` — `EnrichedTurnoDTOJson` + `enrichedTurnoDTOSchema = turnoDTOSchema.extend({serviceName:z.string().min(1), vehicleLabel:z.string().min(1)}).strict()` [REQ-06, INV-08].
- [ ] 1.3 `src/lib/validators/appointmentsQuery.ts` *(new)* — `page` coerce int≥1 default1, `limit` 1..100 default20, `sort` enum `startAt:asc`; clamps, never throws [REQ-04].
- [ ] 1.4 `src/db/repositories/turnos.ts` — `findTurnosPaginatedEnriched(db,q)` single `leftJoin(servicios)`+`leftJoin(vehiculos)` + count; RN-04 defaults; `offset=(page-1)*limit` [REQ-01/03/04/06, INV-02/06].
- [ ] 1.5 `src/services/appointmentService.ts` — `listAppointmentsEnriched(deps,q,authUser)` injecting `customerId` for `CLIENTE` [REQ-05, INV-03].
- [ ] 1.6 `src/db/mappers/turno.test.ts` *(new)* — NULL→fallback; ISO string; Zod rejects snake [GWT 1.1/1.3/6.3].
- [ ] 1.7 `src/db/repositories/turnos.enriched.test.ts` *(new)* — mock drizzle; 1 `leftJoin` chain + 1 count (no N+1) [GWT 6.2].
- [ ] 1.8 `src/lib/api/appointments.test.ts` (extend) — `EnrichedTurnoDTOJson` shape + strict rejects snake [GWT 5.2/6.1].
- [ ] 1.9 `src/services/appointmentService.test.ts` *(new)* — `CLIENTE`→`customerId` injected; ADMINISTRADOR receives q [INV-03].

## Phase 2: Surface Layer (PR 2)

- [ ] 2.1 `src/app/(customer)/appointments/page.tsx` (modify) — `auth()→/login`; `getWorkshopConfig(db)`; `appointmentsQuerySchema.parse`; `Promise.all(getAppointmentById, listAppointmentsEnriched)`; `toEnrichedJson`; `timezone+pagination` to List; `BookingConfirmation` under `Suspense` [REQ-01/04/05, INV-03/06/08].
- [ ] 2.2 `src/app/(customer)/appointments/_components/AppointmentList.tsx` *(new)* — `"use client"` compound `Root/Card/StatusBadge.Pending|Confirmed/Empty/Pagination/Skeleton`; `createContext`+`use()` guard; memoized `Intl.DateTimeFormat(timeZone)`; `suppressHydrationWarning` [REQ-01/02/03/04, INV-06].
- [ ] 2.3 `src/app/(customer)/appointments/_components/AppointmentCard.tsx` *(new, merge if <60L)* — Fecha/Horario via context; `serviceName`; `vehicleLabel`; badge [REQ-01/02].
- [ ] 2.4 `src/app/(customer)/appointments/appointments.module.css` (extend) — `.list/.card/.badgePending/.badgeConfirmed/.empty/.pagination/.skeleton` [REQ-02/03].
- [ ] 2.5 `src/app/(customer)/appointments/_components/AppointmentList.test.tsx` *(new, jsdom+RTL)* — empty→Empty; BA Fecha+Servicio+Vehículo+`aria-label`; `?page=2` controls; no snake; outside-Root throws [GWT 1.1/1.2/2.1/2.2/3.1/4.1/5.1].
- [ ] 2.6 `src/app/(customer)/appointments/page.test.tsx` (extend) — null auth→`/login`; `?page=0&limit=101`→clamp page=1 limit=20; `serviceName`/`vehicleLabel` present; `aria-label`; `appointments-empty`; `Página 2 de 2`; no snake [GWT 1.1..5.3].

## Phase 3: Verification

- [ ] 3.1 `pnpm typecheck`+`lint`+`vitest run`+`build` green; bundle no `server-only`/`@/db`.
- [ ] 3.2 Manual: BA rows+badge; `?page=2&limit=5` paginates; `?limit=999` clamps no 500.

## DAG

`1.1→1.2→1.4→1.7` · `1.3→2.1` · `1.4→1.5→1.9` · `1.6,1.8` independent · `2.1→2.2→2.5` · `2.2→2.3→2.6` · `2.4→2.2` · PR1 before PR2.

## Threat Matrix

N/A — no shell/subprocess/VCS boundaries per design. INV-03 `customerId` injection is existing trust boundary (T-033).
