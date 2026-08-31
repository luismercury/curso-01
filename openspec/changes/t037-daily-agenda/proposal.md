# Proposal: t037-daily-agenda — Daily Agenda via Date Filter Reuse (FASE 7 T-037)

## Intent

Lock T-037 as shipped by T-033. Agenda = `?date=YYYY-MM-DD` BA half-open `[00:00, next 00:00)` UTC + `gt(now)` RN-04 + `include*` false (H-11) + H-28 pagination. 0 LOC, H-19 single-owner `AppointmentService`.

## Scope

### In Scope
- Note: `date=YYYY-MM-DD` is daily agenda (F-08/H-27)
- Optional named test `?date=&page=&limit=&sort=startAt:asc` for traceability
- Hybrid persist

### Out of Scope
- Alias `GET /api/admin/agenda?date=` build (deferred thin forward per §8.5; T-036 precedent delta NONE)
- New service/repo/migration, prod code, duplication (§4.5)

## Capabilities

> Contract for sdd-spec. `appointment/spec.md` `Query — Date Filter` covers agenda.

### New Capabilities
- None

### Modified Capabilities
- `appointment`: note-only or **NONE** — `GET /api/appointments?date=` (CLIENTE own) + `GET /api/admin/appointments?date=&includeCancelled=&includeRejected=&page=&limit=&sort=startAt:asc` (ADMIN all). No new SHALL; delta NONE per T-036.

## Approach

**Pure reuse — 0 LOC (explore Approach 1):**

- `querySchema` validates `date` `YYYY-MM-DD`, `date` vs `from/to` 400, `status` vs `include*` 400, `limit<=100`, `sort` whitelist, `include*` default false
- `listAppointments` single owner: CLIENTE injects `customerId`, ADMIN sees all
- `findTurnosPaginated` via `getBaDayUtcRange(timezone)` half-open `gte/lt` + `gt(now)` + `orderBy fechaHoraInicio`, shared `whereClause`, `page` wins `offset`, `toTurnoDTO`
- Routes: `requireAuth→[assertRole]→parse→list→200 {data,pagination}` `401→403→400`

**Alias:** `GET /api/admin/agenda?date=` documented per §8.5 not built in v1; if needed `src/app/api/admin/agenda/route.ts` one-line forward. T-036 rejected `/pending` alias — same drift risk.

**Rejected:** Duplication violates §4.5.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | None | Validates `date`/pagination/sort |
| `src/db/repositories/turnos.ts` | None | `getBaDayUtcRange` + `gt(now)` |
| `src/services/appointmentService.ts` | None | Single owner |
| `src/services/availability/availabilityService.ts` | None | DST oracle reused |
| `src/app/api/appointments/route.ts` + `src/app/api/admin/appointments/route.ts` | None | `?date=` agenda |
| `src/app/api/.../route.test.ts` | Modified | Optional trace only |
| `openspec/specs/appointment/spec.md` | None/Note | Date Filter covers; delta NONE |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Alias flagged incomplete | Med | Cite §8.5 + T-036 archive 2026-08-31 NONE |
| `401→403→400` regression | Low | Keep auth→role→parse order |
| `asc` vs `startAt:asc` wording | Low | Doc `asc` alias |
| INV-08 snake leak | Low | `toTurnoDTO` check |

## Rollback Plan

No prod code — no rollback. Revert optional test/note only. No migration.

## Dependencies

- **T-033 DONE** — `2026-08-28` (6 ADDED, 19/19 GWT, 62 tests, `74795b9`)
- **T-035 DONE** — `requireAuth`/`assertRole` (`ADMIN 200`/`CLIENTE 403`)
- `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`

## Success Criteria

- [x] H-19 cited; T-033/T-035 DONE with evidence
- [x] 0 LOC prod; no alias/duplication; single owner preserved
- [x] Agenda trace `?date=` → `200 {data,pagination}` `startAt:asc`
- [x] `401→403→400` + INV-08 + BA half-open + `gt(now)` preserved
- [x] <400 lines, <450 words, hybrid persisted
