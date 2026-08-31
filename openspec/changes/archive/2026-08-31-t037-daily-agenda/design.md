# Design: t037-daily-agenda — Daily Agenda via Date Filter Reuse (FASE 7 T-037)

## Technical Approach

**0 LOC prod — informational reuse.** Agenda = `?date=YYYY-MM-DD` on T-033 paginated query. Both `GET /api/appointments` (CLIENTE own) and `GET /api/admin/appointments` (ADMIN all) reuse `querySchema` + `AppointmentService.listAppointments` (§4.5/H-19) → `findTurnosPaginated` → `getBaDayUtcRange` BA half-open `[00:00,next 00:00)` UTC + `gt(now)` + shared `whereClause` → `toTurnoDTO` → `{data,pagination}`. Alias `GET /api/admin/agenda?date=` deferred per §8.5 (T-036 precedent). Delta `NONE` — `Query — Date Filter` covers agenda.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Shared `querySchema` (`src/lib/http/appointmentQuery.ts`) vs per-route validator | Duplicate drifts on `date` calendar check, `date↔from/to` 400, `status↔include*` 400, `limit 1..100`, `sort` whitelist | **Shared** — `dateSchema` regex+`isValidCalendarDate`, `booleanQueryParam` default false, `superRefine` mutual exclusions, `page/limit/offset` + `sort asc\|desc\|startAt:asc\|startAt:desc` default `asc` |
| `AppointmentService.listAppointments` single owner (§4.5) vs new AgendaService | New service duplicates `customerId` injection + `now` clock, violates H-19 | **Single owner** — CLIENTE injects `customerId=authUser.id`, ADMIN bypasses; `now=getNow(deps)` if absent; delegates to `findTurnosPaginated` |
| `findTurnosPaginated` `date→getBaDayUtcRange` vs new repo query | New query duplicates half-open `gte/lt`, `gt(now)`, shared `whereClause` for `count`+`select`, `page wins offset`, `orderBy fechaHoraInicio` | **Reuse** — `getBaDayUtcRange(YYYY-MM-DD, WorkshopConfig.timezone)` DST-aware via `baWallTimeToUtcDate`+`nextBaYmd`; conjunctive `gt(fechaHoraInicio,now)` + `gte(fromUtc)/lt(toUtc)` + `inArray(estado,statuses)` + shared `whereClause`; `limit=20 page=1` defaults |
| Alias `GET /api/admin/agenda?date=` vs canonical `GET /api/admin/appointments?date=` | Alias duplicates `requireAuth→assertRole→parse→list` thin boilerplate, drifts on `page/limit/sort` propagation; canonical already spec'd §8.5 | **Defer alias** — document alias, build only if UI contract demands; thin forward `src/app/api/admin/agenda/route.ts` `requireAuth→assertRole→parseAppointmentQuery→listAppointments` if needed (T-036 precedent) |
| DTO `toTurnoDTO` invariant vs raw row | Raw leaks `estado`/`fecha_hora_inicio` (INV-08) | **Keep `toTurnoDTO`** — camelCase `status/startDateTime/endDateTime/customerId` |

## Data Flow

```
GET /api/appointments?date=2026-09-10&page=1&limit=20&sort=startAt:asc          (CLIENTE)
GET /api/admin/appointments?date=2026-09-10&includeCancelled=&includeRejected=  (ADMIN)
  │
  requireAuth(req) ──401 {code:UNAUTHORIZED} before 400
  [assertRole(ADMINISTRADOR) ──403 {code:FORBIDDEN} before 400]  // admin only
  parseAppointmentQuery(raw) ──400 VALIDATION_ERROR (date YYYY-MM-DD, date↔from/to, status↔include*, limit 1..100, sort whitelist)
  listAppointments({db,config,now: new Date()}, parsed, authUser)
    effectiveQuery.customerId = authUser.id if CLIENTE else undefined
    effectiveQuery.now = now ?? getNow(deps)
    findTurnosPaginated(db, effectiveQuery)
      statuses = [query.status] or ["PENDIENTE","CONFIRMADO"] + cancelled/rejected flags (H-11)
      effectiveDateRange = getBaDayUtcRange(date, WorkshopConfig.timezone)  // [00:00 BA, next 00:00 BA) UTC via Intl oracle
      where = inArray(estado,statuses) AND gt(fechaHoraInicio,now) AND gte/lt(dateRange) AND eq(customerId?) AND sortDir
      whereClause shared → count(*) total/totalPages=ceil(total/limit) + select limit/offset page-wins offset orderBy fechaHoraInicio
      rows.map(toTurnoDTO)  // INV-08 snake→camel, INV-06 TIMESTAMPTZ UTC
  200 {data: TurnoDTO[], pagination:{page,limit,total,totalPages}}  INV-02 preserved
```

Auth precedence **`401→403→400`** invariant: missing JWT →401 even with `?date=&limit=101`; CLIENTE on admin →403 even with invalid `date`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | Keep | `querySchema`/`parseAppointmentQuery` already validate `date`, `page/limit/sort`, `include*`, mutual exclusions |
| `src/db/repositories/turnos.ts` | Keep | `findTurnosPaginated` resolves `date` via `getBaDayUtcRange` half-open DST-aware, shared `whereClause`, pagination |
| `src/services/appointmentService.ts` | Keep | `listAppointments` single owner, role-gated injection |
| `src/services/availability/availabilityService.ts` | Keep | `getBaDayUtcRange` DST oracle (`baWallTimeToUtcDate` + `nextBaYmd`) |
| `src/app/api/appointments/route.ts` | Keep | `requireAuth→parse→list→200 {data,pagination}` thin |
| `src/app/api/admin/appointments/route.ts` | Keep | `requireAuth→assertRole→parse→list→200`; optional alias `src/app/api/admin/agenda/route.ts` thin forward if needed |
| `src/app/api/**/route.test.ts` | Keep/Optional | Optional named agenda trace `?date=&page=&limit=&sort=startAt:asc 200 ordered` (0 prod LOC) |
| `openspec/specs/appointment/spec.md` | None | Delta NONE — `Query — Date Filter` covers agenda; archive MUST NOT add requirement number |

No migration. No enum change (INV-02 `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO`).

## Interfaces / Contracts

```typescript
querySchema: z.object({ date: z.string().regex(/YYYY-MM-DD/).refine(isValidCalendarDate).optional(), status: enum(PENDIENTE..), includeCancelled/Rejected: boolean.default(false), from/to: isoWithTz.optional(), page/limit/offset, sort: enum(asc|desc|startAt:*).default(asc) }).superRefine(/* date↔from/to 400; CANCELADO→flag; from>to */)
parseAppointmentQuery(raw): ParsedAppointmentQuery
listAppointments(deps:{db,config,now}, query, authUser) => Promise<{data: TurnoDTO[], pagination}>
getBaDayUtcRange(baYmd, timeZone): {fromUtc,toUtc} // half-open DST-aware
// response 200 {data,pagination} | 401/403/400 {error:{code,message}} — asc alias for startAt:asc → ORDER BY fechaHoraInicio
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `date` calendar-valid, `date↔from/to` 400, `CANCELADO` without flag 400, `limit=101` 400 | Existing zod suites |
| Repo | BA half-open `gte/lt` DST-aware + `gt(now)` shared `whereClause`; `page wins offset` | `turnos.query.test.ts` mocked |
| Route | ADMIN `?date=&page=&limit=&sort=startAt:asc` 200 ordered; CLIENTE scoped; `401→403→400`; no `estado` leak | `vi.mock` assert `listMock` args (5 traces) |

Reuse T-033 proofs; agenda adds naming trace only.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration. Pure read-filter reuse; inherited `requireAuth`/`assertRole` guards unchanged.

## Migration / Rollout

No migration. Zero prod/config/data change. Rollback reverts optional named test/note only. Deploy docs-only. T-033 `74795b9` + T-035 remain source.

## Open Questions

- None — H-19 single-owner, T-033/T-035 DONE (2026-08-28, 74795b9, 62 tests), INV-02/03/06/08 and `WorkshopConfig.timezone=America/Argentina/Buenos_Aires` verified 2026-08-31.
