# Design: t036-admin-pending-query — Admin Pending Query (Informational Reuse)

## Technical Approach

**0 LOC prod** — T-036 reuses T-033. Admin pending = `GET /api/admin/appointments?status=PENDIENTE` (CLIENTE own = `GET /api/appointments?status=PENDIENTE`). Both routes share `querySchema` (`PENDIENTE` needs no `include*` flag), delegate to single-owner `AppointmentService.listAppointments` (§4.5) which injects `customerId` for CLIENTE and `now`, then calls `findTurnosPaginated` with `inArray(["PENDIENTE"]) AND gt(now)`, shared `whereClause` for count+data, `ORDER BY fechaHoraInicio`, `toTurnoDTO` → `{data,pagination}`. No schema, no alias, no duplication.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Shared `querySchema` (`src/lib/http/appointmentQuery.ts`) vs duplicate per route | Duplicate drifts on enum, `include*` contradiction, `date↔from/to`, `from>to` | **Shared** — single Zod source; `PENDIENTE`/`CONFIRMADO` need no flag, only `CANCELADO`/`RECHAZADO` do (superRefine) |
| `AppointmentService.listAppointments` single owner (§4.5) vs new AdminPendingService | New service duplicates `customerId`+`now`, violates §4.5 | **Single owner** — `CLIENTE` injects `customerId`, `ADMIN` sees all, `now=getNow(deps)` |
| `findTurnosPaginated` additive fields vs new repo method | New method duplicates pagination (`page wins offset`, `limit 1..100`, `sort` whitelist) and count sharing | **Additive** — `status` exact + `gt(now)` conjunctive; `total`/`rows` share `whereClause`; BA `date` via `getBaDayUtcRange` half-open |
| Alias `GET /api/admin/pending` vs filter reuse | Alias duplicates `requireAuth→assertRole→parse→service`, drifts on `page/limit/sort` | **Reject** — H-19 prefers reuse; UI calls `?status=PENDIENTE` directly |

## Data Flow

```
GET /api/admin/appointments?status=PENDIENTE&page=1&limit=20&sort=startAt:asc
  requireAuth ──401
  assertRole(ADMINISTRADOR) ──403 before 400
  parseAppointmentQuery(raw) ──400 (PENDIENTE no flag, include* defaults, ISO+BA DST, limit 1..100)
  listAppointments({db,config,now}, parsed, authUser) // ADMIN no filter, CLIENTE customerId=id, now injected
  findTurnosPaginated(db, {..., now})
    statuses=[PENDIENTE] + gt(fechaHoraInicio, now) + gte/lt date/from/to
    shared whereClause → count(*) total/totalPages + select offset=(page-1)*limit page-wins
  toTurnoDTO → 200 {data: TurnoDTO[], pagination:{page,limit,total,totalPages}}

GET /api/appointments?status=PENDIENTE → same after requireAuth (scoped to customerId)
```

Precedence **401→403→400** holds: missing JWT →401 even with `limit=101`; `CLIENTE` on admin →403 even with invalid query. `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`; `date` → `getBaDayUtcRange` half-open `[00:00 BA,next 00:00 BA)` UTC; `from/to` already UTC; `gt(now)` via `getTime()`. DTO via `toTurnoDTO` (INV-08, no `estado` leak).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | Keep | `querySchema` + `parseAppointmentQuery` already handle `PENDIENTE` without flag |
| `src/db/repositories/turnos.ts` | Keep | `findTurnosPaginated` exact status + shared `whereClause` + pagination/BA DST |
| `src/services/appointmentService.ts` | Keep | `listAppointments` single owner, injection + clock |
| `src/app/api/admin/appointments/route.ts` | Keep | `requireAuth→assertRole→parse→list→200` thin |
| `src/app/api/appointments/route.ts` | Keep | `requireAuth→parse→list→200` |
| `src/app/api/admin/appointments/route.test.ts` | Keep/Optional | Optional named trace `ADMIN pending 200 status=PENDIENTE` + precedence + snake check |
| `openspec/specs/appointment/spec.md` | None | Delta NONE; archive MUST NOT add requirement number |

No migration, no enum change (INV-02 `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO`).

## Interfaces / Contracts

```typescript
// querySchema — no change
querySchema: z.object({
  status: z.enum(["PENDIENTE","CONFIRMADO","CANCELADO","RECHAZADO"]).optional(),
  includeCancelled: booleanQueryParam.default(false),
  includeRejected: booleanQueryParam.default(false),
  from: z.string().regex(isoWithTz).transform(toDate).optional(),
  to: z.string().regex(isoWithTz).transform(toDate).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: numericString(1,1), limit: numericString(1,100,20), offset: numericString(0,optional),
  sort: z.enum(["asc","desc","startAt:asc","startAt:desc"]).default("asc"),
}).superRefine(/* PENDIENTE no flag; CANCELADO→includeCancelled; date↔from/to; from>to */)
parseAppointmentQuery(raw: Record<string,string|undefined>): ParsedAppointmentQuery

// repo — additive only
interface FindTurnosPaginatedQuery { status?: AppointmentStatus; customerId?: string; now?: Date; from?: Date; to?: Date; date?: string; includeCancelled?: boolean; includeRejected?: boolean; page?: number; limit?: number; offset?: number; sort?: string; }

listAppointments(deps:{db,config,now}, query, authUser) => Promise<{data: TurnoDTO[], pagination}>
// response: {data, pagination} + 401/403/400 {error:{code,message}} — camelCase via toTurnoDTO
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | `PENDIENTE` without flag ok; `CANCELADO` without flag →400; `COMPLETADO` →400 | Existing zod tests + one pending trace |
| Repo (mocked DbOrTx) | `inArray(PENDIENTE) AND gt(now)` shared whereClause; `page wins offset` (page2 limit10 offset999→10) | `turnos.query.test.ts` mocked `select({count})` |
| Route (mocked) | ADMIN `?status=PENDIENTE` →200; CLIENTE→403 before 400; 401 before 400; no `estado` leak | `vi.mock(requireAuth/listAppointments)` assert `listMock` args `.status/.role/.sort` |
| Integration | Optional future-only BA `date` half-open | Reuse T-033 mocks, no docker |

Existing suites prove path via `filter passthrough` + `ADMIN 200` + `401 before 400` + BA DST; T-036 adds naming trace only.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure read-filter reuse inside authenticated GET handlers; no new command or file surface.

## Migration / Rollout

No migration. Zero prod/config/data change. Rollback: revert optional test/note. T-033 remains source; deploy docs-only.

## Open Questions

- None — H-19, T-033/T-035 DONE (2026-08-28, #339, 74795b9), INV-02/03/06/08 verified 2026-08-31.
