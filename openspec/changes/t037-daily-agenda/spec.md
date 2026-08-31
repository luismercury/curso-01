# Delta for appointment — t037-daily-agenda — NONE (Informational)

> T-037 daily agenda already shipped by T-033 via `?date=YYYY-MM-DD` reuse per H-19. No new normative requirement. Archive MUST NOT add a requirement number.

## Delta Type: NONE — No normative change

**Decision**: `0 ADDED, 0 MODIFIED, 0 REMOVED, 0 RENAMED`. Zero prod gap; no new `SHALL` introduced.

`GET /api/appointments?date=YYYY-MM-DD` (CLIENTE own, `turno.clienteId==authUser.id`) and `GET /api/admin/appointments?date=YYYY-MM-DD` (ADMIN all) reuse `querySchema` + `AppointmentService.listAppointments` + `findTurnosPaginated` via `getBaDayUtcRange(timezone)` BA half-open DST-aware per `Technical-spec §8.5`.

Alias `GET /api/admin/agenda?date=` **deferred** per §8.5 (T-036 `/pending` precedent). If needed: thin forward `requireAuth→assertRole→parse→listAppointments` (0 LOC core).

## Evidence — Existing Requirements Cover Agenda

T-033 DONE `2026-08-28` #339 6 ADDED 19/19 GWT 62 tests `74795b9`. T-035 DONE `requireAuth`/`assertRole` (`ADMIN 200`/`CLIENTE 403`). `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`.

| Existing SHALL | Guarantees for `?date` agenda |
|---|---|
| Query — Date Filter (BA Timezone) | `date=YYYY-MM-DD` → `[00:00 BA, next 00:00 BA)` UTC via `getBaDayUtcRange`, half-open `gte/lt`, conjunctive `gt(now)` RN-04; bad format `400`; `date` vs `from/to` `400` |
| Query — RN-04 Default Filter | `startDateTime > now` UTC conjunctive; `CANCELADO`/`RECHAZADO` excluded unless `includeCancelled`/`includeRejected=true` default `false` (H-11) |
| Query — Pagination Envelope (H-28) | `{data:TurnoDTO[], pagination:{page,limit,total,totalPages}}` `limit 1..100 default 20`, `page` wins `offset`, `sort asc|desc|startAt:asc|startAt:desc` default `asc` → `ORDER BY fechaHoraInicio`; `total` shares `whereClause` |
| Query — Role Gating | CLIENTE injects `customerId` (own); ADMIN `assertRole(ADMINISTRADOR)` sees all; shared `querySchema` |
| DTO Mapping INV-08 | `toTurnoDTO` camelCase; no `estado`/`fecha_hora_inicio` leak |

H-27 = `startAt:asc` ordering; INV-02/03/06/08 inherited; BA range via `baWallTimeToUtcDate`+`nextBaYmd`.

## Non-Normative Verification Traces (0 normative scenarios)

#### Trace 1: ADMIN agenda ?date=YYYY-MM-DD 200 ordered startAt:asc pagination (all)
- GIVEN `ADMINISTRADOR`, mixed future turnos on `2026-09-10` BA
- WHEN `GET /api/admin/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc`
- THEN `200 {data: TurnoDTO[ start>=2026-09-10T03:00Z AND start<2026-09-11T03:00Z AND start>now], pagination:{page:1,limit:20,total,totalPages}}` ordered `fechaHoraInicio asc`, shared `whereClause` (H-27+H-28)

#### Trace 2: CLIENTE agenda ?date=... 200 ordered scoped to customerId (own)
- GIVEN `CLIENTE A` own `PENDIENTE|CONFIRMADO` on `2026-09-10`, other owner `B` same day
- WHEN `GET /api/appointments?date=2026-09-10&sort=startAt:asc`
- THEN `200` only `A` rows in BA range with `start>now`, ordered `asc`, `pagination` present; repo `customerId=A.id`

#### Trace 3: includeCancelled/includeRejected flags — default false, true includes (H-11)
- GIVEN `CANCELADO`+`RECHAZADO` future rows `start>now` on `2026-09-10`
- WHEN `?date=2026-09-10` vs `&includeCancelled=true` vs `&includeRejected=true` vs both
- THEN default only `PENDIENTE|CONFIRMADO`; each flag adds its status conjunctive with `gt(now)`+BA range; both add all 4

#### Trace 4: 401→403→400 precedence with ?date&limit=101
- GIVEN `GET /api/admin/appointments?date=2026-09-10&limit=101` without JWT vs CLIENTE on admin same params
- WHEN called
- THEN no-JWT → `401` before `400`; CLIENTE → `403` before `400` regardless of `limit=101` (auth→role→parse)

#### Trace 5: INV-08 no snake leak + H-28 envelope
- GIVEN row `estado=PENDIENTE` `fecha_hora_inicio` UTC on `2026-09-10`
- WHEN `GET /api/appointments?date=2026-09-10` or `GET /api/admin/appointments?date=2026-09-10`
- THEN each item has `status`/`startDateTime`/`endDateTime`/`customerId`/`vehicleId`/`serviceId`, `not.toHaveProperty("estado")`; shape `{data,pagination}` `totalPages=ceil(total/limit)`

## ADDED / MODIFIED / REMOVED / RENAMED

None — `delta NONE`. `MODIFIED` note-only under Date Filter valid but churn with no SHALL gain; keep NONE per T-036.

## References

`implementation-plan.md` F-08/H-11/H-19/H-27/H-28 + T-033/T-035 DONE; `Technical-spec §4.5/§8.5` single owner, alias deferred; `AGENTS.md` INV-02/03/06/08; `openspec/specs/appointment/spec.md` BA half-open + `gt(now)`.
