# Proposal: t036-admin-pending-query — Admin Pending Query

## Intent

Lock T-036 as **already shipped by T-033** via filter reuse. H-19: *"si T-036 es solo query con filtro, reutiliza T-033 con param role=ADMIN ... No duplica lógica; delega lectura a AppointmentService.query"*. Admin pending = `GET /api/admin/appointments?status=PENDIENTE` (CLIENTE own = `GET /api/appointments?status=PENDIENTE`). No new endpoint, single owner.

## Scope

### In Scope
- Docs/spec note linking `status=PENDIENTE` to H-19 pending view
- Optional named test `ADMIN pending view — status=PENDIENTE 200` for traceability

### Out of Scope
- Alias `/pending`, new service/repo, schema/migration, capacity/slot/timezone logic
- Hardcoded `WorkshopConfig` values

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `appointment`: note-only — `status=PENDIENTE` via `GET /api/admin/appointments?status=PENDIENTE` is the pending view; no new requirement (T-033 covers RN-04/status exact/pagination/role gating). Strict alternative: delta NONE, evidence in explore/proposal.

## Approach

**Recommended — Pure Reuse (0 LOC):** Reuse `querySchema` + `listAppointments` → `findTurnosPaginated`. `PENDIENTE` needs no `include*` flag. Pagination/range/BA `gt(now)` inherited.

**Rejected — Alias `/pending`:** Duplicates `requireAuth→assertRole→parse→service`, second URL drifts, violates H-19 single-owner.

**Rejected — Duplication:** Reimplements `inArray(estado,["PENDIENTE"]) AND gt(now)`, violates `Technical-spec §4.5`, adds drift/cost.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/http/appointmentQuery.ts` | None | Already validates `PENDIENTE` without flags |
| `src/db/repositories/turnos.ts` | None | `findTurnosPaginated` exact status + shared `whereClause` |
| `src/services/appointmentService.ts` | None | Single owner; CLIENTE scopes, ADMIN sees all |
| `src/app/api/admin/appointments/route.ts` | None | `assertRole` → `parse` → `list` |
| `src/app/api/admin/appointments/route.test.ts` | Modified | Optional pending test |
| `openspec/specs/appointment/spec.md` | Modified/None | Note-only or NONE |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Alias expectation (`/pending`) flagged incomplete | Med | Cite H-19 + T-033 archive `2026-08-28` (19/19 GWT, 62 tests, merged `74795b9`) |
| 401→403→400 precedence regression | Low | Keep `requireAuth→assertRole→parse` order; existing `401 before 400` tests |
| INV-08 snake leak (`estado`) | Low | Keep `toTurnoDTO` + `not.toHaveProperty("estado")` |
| `total`/`data` whereClause drift | Low | Zero new query path; reuse shared clause |

## Rollback Plan

No prod code → no rollback; revert optional test/note only. No migration, zero data impact. T-033 remains source.

## Dependencies

- **T-033 DONE** — archived `2026-08-28` (6 ADDED, 19/19, 62 tests, `74795b9`, delta #339)
- **T-035 DONE** — `requireAuth`/`assertRole(ADMINISTRADOR)` proven (`ADMIN 200`/`CLIENTE 403`)
- `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, `strict_tdd=false` (no TDD gate)

## Success Criteria

- [ ] H-19 quote cited; T-033/T-035 declared DONE with evidence
- [ ] 0 LOC prod; no alias/duplication; single owner preserved
- [ ] Pending trace via named test or doc note (`GET /api/admin/appointments?status=PENDIENTE` → `200 {data,pagination}`)
- [ ] 401→403→400 + INV-08 camelCase preserved
- [ ] <400 lines, <450 words, hybrid persisted
