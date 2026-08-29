# Delta for Appointment — T-033 Query (RN-04 / H-28 / H-11)

## ADDED Requirements

### Requirement: Query — RN-04 Default Filter

The system MUST default to `estado IN (PENDIENTE,CONFIRMADO) AND fechaHoraInicio>now` UTC; `CANCELADO`/`RECHAZADO` excluded unless `includeCancelled`/`includeRejected=true` (default `false`), conjunctive with `gt(now)`.

#### Scenario: Default hides CANCELADO/RECHAZADO
- GIVEN 4 statuses future `start>now`
- WHEN `GET /api/appointments` without flags
- THEN only `PENDIENTE|CONFIRMADO`

#### Scenario: includeCancelled adds CANCELADO
- GIVEN same data
- WHEN `?includeCancelled=true`
- THEN adds `CANCELADO` only

#### Scenario: includeRejected adds RECHAZADO
- GIVEN same data
- WHEN `?includeRejected=true`
- THEN adds `RECHAZADO` only

#### Scenario: Both flags add all
- GIVEN same data
- WHEN `?includeCancelled=true&includeRejected=true`
- THEN all 4 statuses where `start>now`

### Requirement: Query — Status Exact Filter

The system MUST support `status=PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` adding `estado=:status` conjunctive with RN-04. `status=CANCELADO` MUST require `includeCancelled=true`; `status=RECHAZADO` MUST require `includeRejected=true`; otherwise `400 VALIDATION_ERROR`. Invalid enum → `400`.

#### Scenario: Status with flag passes
- GIVEN `status=CANCELADO&includeCancelled=true`
- WHEN queried
- THEN only `CANCELADO` `start>now`; `total` matches

#### Scenario: Contradiction is 400
- GIVEN `status=CANCELADO` without flag
- WHEN queried
- THEN `400 VALIDATION_ERROR`

#### Scenario: Invalid enum is 400
- GIVEN `status=COMPLETADO`
- WHEN queried
- THEN `400`

### Requirement: Query — Date Filter (BA Timezone)

The system MUST support `date=YYYY-MM-DD` as `[00:00 BA, next 00:00 BA)` UTC via `getBaDayUtcRange(timezone)` DST-aware, conjunctive with `gt(now)`. Invalid format → `400`. `date` with `from`/`to` → `400`.

#### Scenario: Valid BA day
- GIVEN `date=2026-09-10` BA `-03:00`
- WHEN queried
- THEN `>=2026-09-10T03:00Z AND <2026-09-11T03:00Z` plus `gt(now)`

#### Scenario: Invalid date is 400
- GIVEN `date=2026/09/10`
- WHEN queried
- THEN `400`

#### Scenario: date vs from/to exclusion
- GIVEN `date=2026-09-10&from=2026-09-10T00:00:00-03:00`
- WHEN queried
- THEN `400`

### Requirement: Query — Range Filter from/to

The system MUST support `from`/`to` ISO 8601 with timezone (`Z`|`±HH:MM`) as UTC `TIMESTAMPTZ`; filter `>=from` and `<to` half-open, conjunctive with `gt(now)`. Invalid ISO → `400`; `from>to` → `400`.

#### Scenario: Range filters UTC
- GIVEN `from=2026-09-10T00:00:00-03:00`
- WHEN queried
- THEN only `start>=from` plus `gt(now)`

#### Scenario: Invalid ISO is 400
- GIVEN `from=2026-09-10` no TZ
- WHEN queried
- THEN `400`

#### Scenario: from greater than to is 400
- GIVEN `from=2026-09-11T00:00-03:00&to=2026-09-10T00:00-03:00`
- WHEN queried
- THEN `400`

### Requirement: Query — Pagination Envelope

The system MUST return `{data:TurnoDTO[], pagination:{page,limit,total,totalPages}}` per §8.5. `limit 1..100 default 20`, `page>=1 default 1`, `offset>=0` alt, `page` wins (`offset=(page-1)*limit`). `sort` whitelist `asc|desc|startAt:asc|startAt:desc` default `asc`, `ORDER BY fechaHoraInicio`. `total` same `whereClause`, `totalPages=ceil(total/limit)` (0 if 0). Violations → `400`. DTO via `toTurnoDTO`.

#### Scenario: Default envelope
- GIVEN 25 future rows
- WHEN no pagination params
- THEN `{data:[20], pagination:{page:1,limit:20,total:25,totalPages:2}}` asc

#### Scenario: Page/offset and sort
- GIVEN 25 rows
- WHEN `?page=2&limit=20&sort=startAt:desc` or `?offset=20`
- THEN `offset=20` desc; `page` overrides `offset`

#### Scenario: Validation rejects
- GIVEN `limit=101` or `page=0` or `sort=DROP`
- WHEN queried
- THEN `400`

### Requirement: Query — Role Gating and Invariants

The system MUST enforce `GET→Service` (§4.5): `GET /api/appointments` injects `customerId=authUser.id` if `CLIENTE`; `GET /api/admin/appointments` requires `assertRole(ADMINISTRADOR)` and sees all. Unauthenticated → `401` before `400`. CLIENTE on admin → `403`. Store `TIMESTAMPTZ` UTC, return `TurnoDTO` camelCase via `toTurnoDTO`, no snake leak. Shared `querySchema`.

#### Scenario: CLIENTE scoped
- GIVEN A(2 rows) B(1 row) future
- WHEN A calls `GET /api/appointments`
- THEN only A rows; repo `customerId=A.id`

#### Scenario: ADMIN sees all
- GIVEN mixed owners
- WHEN ADMIN calls `GET /api/admin/appointments`
- THEN all owners; no `customerId` filter

#### Scenario: 401 before 400 and 403
- GIVEN no JWT `limit=101`; GIVEN CLIENTE on admin
- WHEN called
- THEN `401` not `400`; CLIENTE admin → `403`
