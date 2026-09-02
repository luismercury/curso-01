# Delta for appointment — t045 (Enriched DTO)

## ADDED Requirements

### Requirement: REQ-06 — Enriched DTO and Single-Query JOIN

The system MUST extend reads with `EnrichedTurnoDTOJson` (`serviceName`, `vehicleLabel` added to `TurnoDTOJson`). Repository MUST provide `findTurnosPaginatedEnriched` via one `LEFT JOIN servicios` + `LEFT JOIN vehiculos` (no N+1); fallback MAY use bulk `Map`+`inArray`. Zod strict camelCase (INV-08); NULL join MUST fallback.

#### Scenario: Enriched shape camelCase
- GIVEN JOIN returns `nombre`, `patente`
- WHEN `toEnrichedDTO` maps
- THEN has `serviceName,vehicleLabel` camelCase, no `fecha_hora_inicio`

#### Scenario: Single query — no N+1
- GIVEN 20 turnos `limit=20`
- WHEN `findTurnosPaginatedEnriched` executes
- THEN 1 SQL query; `vehicleLabel="{brand} {model} — {plate}"`

#### Scenario: NULL join fallback
- GIVEN deleted service (LEFT JOIN NULL)
- WHEN mapper receives null
- THEN `serviceName="Servicio no disponible"` — valid Zod
