# Delta for appointment — t036-admin-pending-query — NONE (Informational)

> T-036 admin pending view is already shipped by T-033 via filter reuse per H-19. No new normative requirement. This delta exists for hybrid traceability; archive MUST NOT add a requirement number.

## Delta Type: NONE — No normative change

**Decision**: `0 ADDED, 0 MODIFIED, 0 REMOVED, 0 RENAMED`. Proposal `Modified Capabilities: appointment note-only or NONE` and explore evidence prove zero prod gap. Preferred outcome is **NONE** with documented non-normative traces below. No new `SHALL/MUST` is introduced by this change.

Existing spec `openspec/specs/appointment/spec.md` already covers the pending view end-to-end. T-036 reuses `GET /api/admin/appointments?status=PENDIENTE` (ADMIN sees all) and `GET /api/appointments?status=PENDIENTE` (CLIENTE sees own) — same `querySchema` + `AppointmentService.listAppointments` + `findTurnosPaginated` single owner per `Technical-spec §4.5`.

## Evidence — Existing Requirements Cover `status=PENDIENTE + gt(now) + pagination`

H-19 verbatim (implementation-plan.md §10): *"si T-036 es solo query con filtro, reutiliza T-033 con param role=ADMIN (`GET /api/appointments?status=PENDIENTE` vs `GET /api/admin/appointments?status=PENDIENTE`). No duplica lógica; delega lectura a AppointmentService.query"*.
T-033 DONE: archived `2026-08-28` delta #339, 6 ADDED, 19/19 GWT, 62 mocked tests, merged `74795b9`. T-035 DONE: `requireAuth` + `assertRole(ADMINISTRADOR)` proven (`ADMIN 200` / `CLIENTE 403`).

| Existing requirement (SHALL) | What it guarantees for pending view |
|---|---|
| Query — Status Exact Filter | MUST support `status=PENDIENTE` exact `estado=:status` conjunctive with RN-04; `PENDIENTE` needs **no** `include*` flag (only `CANCELADO`/`RECHAZADO` do) |
| Query — RN-04 Default Filter | MUST filter `startDateTime > now` UTC conjunctively; pending is future-only |
| Query — Pagination Envelope | MUST return `{data:TurnoDTO[], pagination:{page,limit,total,totalPages}}` `limit 1..100 default 20`, `sort asc\|desc\|startAt:asc\|startAt:desc`, `total` shares `whereClause` |
| Query — Role Gating and Invariants | MUST inject `customerId=authUser.id` for CLIENTE; ADMIN via `assertRole(ADMINISTRADOR)` sees all; shared `querySchema` |
| DTO Mapping INV-08 | MUST return `TurnoDTO` camelCase via `toTurnoDTO`; MUST NOT leak `estado`/`fecha_hora_inicio` |

INV-02/03/06/08 inherited.

## Non-Normative Verification Traces (0 normative scenarios)

#### Trace 1: ADMIN pending 200 with pagination/sort
- GIVEN authenticated `ADMINISTRADOR` and mixed future turnos
- WHEN `GET /api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc`
- THEN `200 {data: TurnoDTO[PENDIENTE where start>now], pagination:{page:1,limit:20,total,totalPages}}` ordered `fechaHoraInicio asc`, `total` uses shared `whereClause`

#### Trace 2: CLIENTE own pending 200
- GIVEN authenticated `CLIENTE A` with own `PENDIENTE` future rows
- WHEN `GET /api/appointments?status=PENDIENTE`
- THEN `200` only `A` rows with `status=PENDIENTE` and `start>now`, `pagination` present

#### Trace 3: ADMIN 200 vs CLIENTE 403 on admin route
- GIVEN same `?status=PENDIENTE` on `GET /api/admin/appointments`
- WHEN `ADMINISTRADOR` vs `CLIENTE` calls admin route
- THEN ADMIN `200` sees all owners; CLIENTE `403 {error:{code:"FORBIDDEN"}}` via `assertRole` before service

#### Trace 4: 401→403→400 precedence
- GIVEN `GET /api/admin/appointments?status=PENDIENTE&limit=101` without JWT vs CLIENTE with invalid limit
- WHEN called
- THEN no-JWT → `401 UNAUTHORIZED` before `400`; CLIENTE on admin → `403` before `400` regardless of `limit=101`

#### Trace 5: No snake leak (INV-08 negative)
- GIVEN any pending row `estado=PENDIENTE` `fecha_hora_inicio` UTC
- WHEN `GET /api/admin/appointments?status=PENDIENTE` or `GET /api/appointments?status=PENDIENTE` returns
- THEN every item has `status`/`startDateTime`/`endDateTime` and `not.toHaveProperty("estado")` / `fecha_hora_inicio`

## ADDED / MODIFIED / REMOVED / RENAMED

None — informational `delta NONE`. `MODIFIED` note-only alternative (one-line parenthetical under Status Exact Filter) is valid but adds archival churn with no SHALL gain; keep NONE.

## References

`implementation-plan.md` H-19 + T-033/T-035 DONE; `Technical-spec §4.5`; `AGENTS.md` INV-02/03/08; `openspec/specs/appointment/spec.md` 19 GWT.
