# Appointments Screen Specification — t045-appointments-screen (New Capability)

> New capability. T-045 UI-04 Próximos turnos FL-03/RN-04/H-11/H-28 via RSC + compound AppointmentList. Depends T-033.

## Requirements

### Requirement: REQ-01 — Upcoming List with Timezone Formatting

The system MUST render upcoming turnos showing Fecha, Horario, Servicio, Vehículo, Estado (FL-03). Each row MUST use `EnrichedTurnoDTOJson` (`serviceName`, `vehicleLabel`). Fecha/Horario MUST use `Intl.DateTimeFormat` with `WorkshopConfig.timezone = America/Argentina/Buenos_Aires`. DB `TIMESTAMPTZ` UTC (INV-06); RSC serializes ISO strings only.

#### Scenario: Happy list — enriched rows
- GIVEN CLIENTE with 2 upcoming `PENDIENTE|CONFIRMADO` `start > now` UTC
- WHEN RSC fetches enriched and renders `AppointmentList`
- THEN 2 rows each with BA Fecha/Horario, Servicio, Vehículo, Estado badge

#### Scenario: UTC→BA conversion
- GIVEN `fechaHoraInicio 2026-09-10T12:00:00Z` (09:00 BA) + `timezone BA`
- WHEN formatter uses `Intl` with `timeZone: config.timezone`
- THEN Fecha `10/09/2026` Horario `09:00` — not `12:00`

#### Scenario: Deleted service fallback
- GIVEN turno with NULL LEFT JOIN (deleted service/vehicle)
- WHEN `toEnrichedDTO` maps
- THEN `serviceName="Servicio no disponible"`, `vehicleLabel="Vehículo no disponible"` — row still renders

### Requirement: REQ-02 — Status Badge and A11y

The system MUST map `status` UPPER_SNAKE (INV-02) to badges: `PENDIENTE`/`CONFIRMADO` only; no `COMPLETADO`. Badge MUST have `aria-label`. List `role="list"`, items `role="listitem"`, page `<h1>`.

#### Scenario: Badge variants
- GIVEN `status=PENDIENTE` and `CONFIRMADO`
- WHEN `StatusBadge` renders
- THEN `aria-label="Estado: PENDIENTE"` (amber) and `"Estado: CONFIRMADO"` (green)

#### Scenario: A11y roles
- GIVEN 3 upcoming turnos
- WHEN querying roles
- THEN `list` + 3 `listitem` + `heading` "Próximos turnos" all present

### Requirement: REQ-03 — Empty State and RN-04 Default Filter

The system MUST show empty state when `data.length==0`. Próximos MUST default `PENDIENTE|CONFIRMADO` `start > now` UTC; `CANCELADO`/`RECHAZADO` excluded (T-045 never requests flags).

#### Scenario: Empty state
- GIVEN zero upcoming turnos
- WHEN page renders
- THEN `data-testid="appointments-empty"` with "No tienes turnos próximos", zero rows

#### Scenario: Default excludes CANCELADO/RECHAZADO
- GIVEN 4 future turnos (one per status) `start > now`
- WHEN screen queries defaults (`includeCancelled/Rejected=false`)
- THEN only PENDIENTE+CONFIRMADO render

### Requirement: REQ-04 — URL Pagination

The system MUST support `?page&limit` per §8.5: `limit 1..100` default 20, `page>=1` default 1, `sort=startAt:asc`, envelope `{data, pagination:{page,limit,total,totalPages}}`. Invalid values MUST coerce/default — never 500 — no snake leak.

#### Scenario: Pagination happy
- GIVEN 25 turnos, URL `?page=2&limit=20`
- WHEN RSC parses Zod, `offset=20`
- THEN 5 rows + controls "Página 2 de 2"

#### Scenario: Invalid limit/page
- GIVEN `?page=0&limit=101` or `?page=abc`
- WHEN Zod fails
- THEN clamps to `page=1 limit=20`, renders list/empty — no throw

### Requirement: REQ-05 — Auth Guard, No Snake Leak, RSC Serialization

The system MUST guard via `auth()` (INV-03): no session → `redirect("/login")` before DB. MUST expose only `EnrichedTurnoDTOJson` camelCase (INV-08); RSC→client props MUST be serializable ISO strings + pagination.

#### Scenario: Auth redirect
- GIVEN no JWT
- WHEN requesting `/appointments`
- THEN `redirect("/login")`, no `findTurnosPaginated` call

#### Scenario: No snake leak INV-08
- GIVEN row `{fecha_hora_inicio, estado, cliente_id}`
- WHEN props reach client
- THEN has `startDateTime,status,customerId` and `NOT.hasProperty("fecha_hora_inicio")`

#### Scenario: ISO serialization
- GIVEN DB `Date` UTC
- WHEN `toEnrichedDTO` maps
- THEN client receives `startDateTime:"2026-09-10T12:00:00.000Z"` string — not `Date` object
