# Proposal: T-033 Appointment Query — RN-04 / H-28 / H-11

## Intent

Single-owner paginated query for turno lifecycle with RN-04 próximos (`PENDIENTE|CONFIRMADO` `start>now` UTC, `includeCancelled`/`includeRejected` opt-in) + H-28 pagination. Thin HTTP layer reuses `AppointmentService.listAppointments`; satisfies T-036 ADMIN reuse.

## Scope

### In Scope
- `GET /api/appointments` CLIENTE scoped, `GET /api/admin/appointments` ADMIN (`assertRole`)
- Shared Zod `querySchema`: `status?`, `includeCancelled/includeRejected` `false`, `from/to` ISO, `date` `YYYY-MM-DD`, `page>=1`/`limit 1..100`/`offset>=0` (page wins), `sort` whitelist
- Repo `findTurnosPaginated`: add `status/from/to/date/offset`, keep `gt(now)`, `date` via `getBaDayUtcRange`
- Validation `400`: `date` vs `from/to` mutual exclusion, `status` vs `include*` contradiction, `from<=to`
- Response `200 { data, pagination }` via `toTurnoDTO` (INV-08), UTC (INV-06), `401→400→403`

### Out of Scope
- Transitions `canTransition`, slot generation, capacity `tstzrange &&`/`FOR UPDATE`/`EXCLUDE`, new invariants

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: extend query with `status/from/to/date/offset`, RN-04 + pagination envelope

## Approach

**Opt 1 Thin GET→Service (recommended):** `requireAuth→Zod→listAppointments→{data,pagination}`. ADMIN adds `assertRole`. Single owner §4.5.

**Opt 2 Direct Repo:** manual `customerId`. Rejected: duplicates ownership, violates §4.5.

**Opt 3 Helper:** Rejected: premature, hides `server-only`.

Pick Opt 1 — lowest risk, <400 lines.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | New | Shared `querySchema` |
| `src/app/api/appointments/route.ts` | Modified | Add `GET` (POST untouched) |
| `src/app/api/admin/appointments/route.ts` | New | ADMIN `GET` + `assertRole` |
| `src/db/repositories/turnos.ts` | Modified | Extend query + `findTurnosPaginated` |
| `src/services/appointmentService.ts` | Reuse | `listAppointments` passthrough |
| `src/config/workshopConfig.ts` | Reuse | `timezone` for BA range |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auth leak | High | Delegate to service; assert `customerId`+`403` |
| `gt(now)` off-by-one | Med | Strict `gt`; `getNow(deps)` |
| `status` vs `include*` | Med | `400` on contradiction |
| `date` vs `from/to` | Med | `400`; `getBaDayUtcRange` |
| `limit/sort` injection | Low | Zod `1..100`, whitelist |
| `total` drift | Low | Reuse `whereClause` |
| `401 before 400` | Low | `requireAuth` before Zod |

## Rollback Plan

Delete admin route + `appointmentQuery.ts`, revert `route.ts` GET and `turnos.ts`. No migration → `404`. Zero data impact.

## Dependencies

- T-027 `list` done; T-028–032 done; T-051/T-035 auth done; `getBaDayUtcRange`/`toTurnoDTO`/`toErrorBody` ready
- No new infra; `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`

## Success Criteria

- [ ] Default hides `CANCELADO`/`RECHAZADO`; `include*` opt-in; `status` filter with contradiction `400`
- [ ] `date` BA UTC range; `from/to` ISO; mutual exclusion `400`
- [ ] Pagination `limit:101`→`400`, bad `sort`→`400`, envelope always, `page` over `offset`
- [ ] CLIENTE own only; ADMIN all; `401` before `400`, admin CLIENTE→`403`
- [ ] `toTurnoDTO` camelCase, no snake leak; <400 lines, no `FOR UPDATE` in diff
