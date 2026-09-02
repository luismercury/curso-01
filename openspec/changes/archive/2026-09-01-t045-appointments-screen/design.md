# Design: t045-appointments-screen — Upcoming Appointments (T-045 UI-04)

## Technical Approach

Enhance RSC `page.tsx` (`auth`→`config`→`Promise.all(confirmed,enrichedList)`) with single `LEFT JOIN turnos→servicios+vehiculos`. Mapper `toEnrichedDTO`→`toEnrichedJson` (ISO strings) crosses RSC boundary. Client compound `AppointmentList` provides `timezone`+memoized `Intl.DateTimeFormat` via context. `BookingConfirmation` stays under `Suspense`. No client fetch or internal HTTP hop.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Enrichment | N+1 / LEFT JOIN / Map+inArray | N+1 = 20 queries; Map = 3 queries; JOIN = 1 | **LEFT JOIN primary**, Map fallback. 1 query asserted. |
| DTO | Extend vs wrapper | Wrapper indirection | **Extend** `EnrichedTurnoDTO extends TurnoDTO + serviceName/vehicleLabel` + Json ISO variant. |
| Component | Monolith vs compound | Boolean `isPending` doubles states | **Compound** `Root/.Card/.Badge/.Empty/.Pagination/.Skeleton` via `createContext`+`use()`. Explicit `PendingBadge`/`ConfirmedBadge`. |
| Pagination | offset vs ?page&limit | offset leaks impl | **URL `?page&limit`**, `router.push` `scroll:false`, clamp 1..100. |
| Timezone | toLocaleString vs Intl(timeZone) | Local TZ mismatch | **`Intl.DateTimeFormat(timeZone: config.timezone)`** memoized + `suppressHydrationWarning`. |

## Data Flow

```
auth() → redirect /login if null
  ├─ getWorkshopConfig(db) → {timezone}
  ├─ Promise.all → fetchConfirmed + listAppointmentsEnriched({page,limit,now,customerId})
  │     findTurnosPaginatedEnriched: SELECT turnos.* + servicios.nombre + vehiculos.marca/modelo/patente
  │       FROM turnos LEFT JOIN servicios ON servicio_id LEFT JOIN vehiculos ON vehiculo_id
  │       WHERE estado IN ('PENDIENTE','CONFIRMADO') AND start>now ORDER BY start ASC LIMIT/OFFSET + count(*)
  │     → toEnrichedJson (snake→camel, NULL→fallback)
  └─ Props → AppointmentList.Root(appointments, timezone, pagination)
               ├─ Context {timezone, formatters}
               ├─ EmptyState if 0 else <ol> Card×N → PendingBadge|ConfirmedBadge
               └─ Pagination nav (?page&limit)
   Suspense → BookingConfirmation
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(customer)/appointments/page.tsx` | Modify | Use `listAppointmentsEnriched`, `toEnrichedJson`, Zod `?page&limit` clamp, pass `timezone`+`pagination` to List, `Suspense` for banner. |
| `src/app/(customer)/appointments/_components/AppointmentList.tsx` | Create | Compound client: `Root/Card/Badge/Empty/Pagination/Skeleton`, context + `useAppointment()` guard, memoized Intl. |
| `src/app/(customer)/appointments/_components/AppointmentCard.tsx` | Create | Row: Fecha/Horario via context formatters, `serviceName`, `vehicleLabel`. Merge into List if <60 LOC. |
| `src/app/(customer)/appointments/appointments.module.css` | Modify | Add `.list/.card/.badgePending/.badgeConfirmed/.empty/.pagination/.skeleton`. |
| `src/db/repositories/turnos.ts` | Modify | Add `findTurnosPaginatedEnriched(db, {customerId,page,limit,sort,now,includeCancelled,includeRejected})`. |
| `src/db/mappers/turno.ts` | Modify | Add `EnrichedTurnoDTO` + `toEnrichedDTO` (NULL→"Servicio/Vehículo no disponible") + `toEnrichedJson`. |
| `src/lib/api/appointments.ts` | Modify | Add `EnrichedTurnoDTOJson` + `enrichedTurnoDTOSchema` strict. |
| `src/services/appointmentService.ts` | Modify | Add `listAppointmentsEnriched(deps, {page,limit}, authUser)` — CLIENTE injects customerId (INV-03). |
| `src/lib/validators/appointmentsQuery.ts` | Create | Zod `page>=1` default1, `limit 1..100` default20, `sort` whitelist. |
| Tests | Modify | Unit mapper/Zod, repo join+count, RSC integration. |

## Interfaces / Contracts

```ts
interface EnrichedTurnoDTO extends TurnoDTO {
  serviceName: string | null; // servicios.nombre
  vehicleLabel: string | null; // `${marca} ${modelo} — ${patente}`
}
interface EnrichedTurnoDTOJson extends TurnoDTOJson {
  serviceName: string; vehicleLabel: string;
}
const enrichedTurnoDTOSchema = turnoDTOSchema.extend({
  serviceName: z.string().min(1),
  vehicleLabel: z.string().min(1),
  status: z.enum(["PENDIENTE","CONFIRMADO","RECHAZADO","CANCELADO"]),
}).strict();

function toEnrichedDTO(row: TurnoRow & { servicioNombre: string|null, vehiculoMarca: string|null, vehiculoModelo: string|null, vehiculoPatente: string|null }): EnrichedTurnoDTO
function toEnrichedJson(d: EnrichedTurnoDTO): EnrichedTurnoDTOJson
function findTurnosPaginatedEnriched(db: DbOrTx, q: FindTurnosPaginatedQuery): Promise<{data: EnrichedTurnoDTO[]; pagination: Pagination}>
function listAppointmentsEnriched(deps: AppointmentServiceDeps, q: {page?:number; limit?:number}, authUser: AuthUser): Promise<{data: EnrichedTurnoDTOJson[]; pagination: Pagination}>

interface AppointmentListRootProps { appointments: EnrichedTurnoDTOJson[]; timezone: string; pagination: Pagination }
const AppointmentList = { Root, Card, Badge: { PendingBadge, ConfirmedBadge }, Empty, Pagination, Skeleton }
function useAppointment(): AppointmentListContextValue // throws outside Root
```
`paginate()` per technical-spec §8.5: `offset=(page-1)*limit`, `totalPages=ceil(total/limit)`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit mapper/Zod | NULL fallback, snake→camel, ISO | vitest null rows, `safeParse` rejects snake |
| Unit repo | JOIN+count, RN-04, clamp, no N+1 | Mock drizzle — assert `leftJoin`+`count(*)` single call |
| Unit service | Ownership+clock | Assert CLIENTE injects customerId |
| Integration RSC | auth redirect, Intl BA, badge, empty, pagination URL, no snake leak | Extend `page.test.tsx` — mock auth/config/enriched, assert BA date, `aria-label` badge, `appointments-empty`, `Página 2 de 2` |

## Threat Matrix

N/A — no shell/subprocess/VCS boundaries. INV-03 ownership via `customerId` injection; no new trust boundary.

## Migration / Rollout

No migration. Revert commit → T-044 raw list. Single PR <400 lines; split `t045a` (DTO/repo/mapper/service) / `t045b` (RSC/components/styles) if exceeded.

## Open Questions

- [ ] `sort` param needed in URL? Spec fixes `startAt:asc` for T-045.
- [ ] `vehicleLabel` format `"${brand} ${model} — ${plate}"` confirmed vs plate only?

## Invariant Checklist

- INV-02: Zod enum UPPER_SNAKE, defaults only PENDIENTE/CONFIRMADO.
- INV-03: RSC `auth()`→`redirect("/login")` before DB; service injects `customerId` for CLIENTE.
- INV-06: DB TIMESTAMPTZ UTC; `Intl` with `config.timezone`; no naive TIMESTAMP.
- INV-08: Mapper renames `servicios.nombre→serviceName`, `vehiculos.patente→vehiclePlate`; Zod `.strict()` blocks leak.
