# Proposal: t045-appointments-screen — Upcoming Appointments (T-045 UI-04)

## Intent
Deliver readable upcoming list (Fecha/Horario/Servicio/Vehículo/Estado) per FL-03/RN-04/H-11. Current `page.tsx` (T-044) shows raw `serviceId`+`toISOString()` only — no names, formatting, pagination UI, a11y. Preserve INV-02/03/06/08.

## Scope
### In Scope
- Enrich: Servicio name + Vehículo plate via single query (no N+1)
- Format Fecha/Horario via `Intl` + `config.timezone` (BA), ISO `toJson` RSC→client
- Estado badge (PENDIENTE/CONFIRMADO), empty state, pagination `?page&limit`, a11y
- Compound `AppointmentList` → `Card`/`StatusBadge`/`Pagination`

### Out of Scope
- T-046 cancel; admin T-047..T-049; CANCELADO/RECHAZADO toggles beyond RN-04 defaults

## Capabilities
### New Capabilities
- `appointments-screen`: upcoming list — RSC page + AppointmentList compound + enriched DTO + pagination + a11y

### Modified Capabilities
- `appointment`: `EnrichedTurnoDTOJson { serviceName, vehicleLabel }` (docs only)

## Approach
**Approach 1 + Phase 1b JOIN — per exploration #491.**
- RSC: keep `auth()`+`getWorkshopConfig(db)`+`Promise.all(confirmed,list)`+`force-dynamic`
- Repo `findTurnosPaginatedEnriched` in `turnos.ts`: `LEFT JOIN servicios/vehiculos` single query; fallback Map+`inArray`
- Mapper `toEnrichedDTO` → `EnrichedTurnoDTOJson`; Zod strict; INV-08 no snake leak
- Compound `List/Card/Badge/Empty/Pagination` — children composition, no boolean props, `use()` for context
- Pagination URL-driven `?page&limit` (limit≤100, `startAt:asc`); timezone prop → `Intl`; `Suspense` boundaries
- Rejected Approach 3 client fetch — RSC anti-pattern

## Decisions
1. Approach 1+JOIN over client fetch
2. `EnrichedTurnoDTOJson` + Zod + ISO serialization
3. LEFT JOIN primary, Map+WHERE IN fallback
4. Compound, no boolean props
5. URL pagination, RN-04 `PENDIENTE|CONFIRMADO start>now`
6. `Intl` with `timeZone` + `suppressHydrationWarning`
7. Single PR <400 lines; split `t045a`/`t045b` if exceeded

## Affected Areas
| Area | Impact | Desc |
|------|--------|------|
| `appointments/page.tsx` | Modified | RSC enrichment, pagination, Suspense |
| `appointments/_components/AppointmentList.tsx` | New | Compound components |
| `db/repositories/turnos.ts` | Modified | `findTurnosPaginatedEnriched` |
| `db/mappers/turno.ts` | Modified | `toEnrichedDTO` |
| `lib/api/appointments.ts` | Modified | `EnrichedTurnoDTOJson`+Zod |

## Risks
| Risk | Like | Mitigation |
|------|------|------------|
| N+1 | Med | Single JOIN / bulk Map; test 1 query |
| Hydration mismatch | Med | ISO+`Intl` explicit tz |
| IDOR | Low | `listAppointments` injects `customerId` (INV-03) |
| >400 lines | Low | ask-on-risk split |

## Rollback Plan
Revert commit(s). No migration. Falls back to T-044 raw list.

## Dependencies
T-033 `listAppointments`, T-044 skeleton, `WorkshopConfig.timezone`

## Success Criteria
- [ ] Shows Fecha/Horario (Intl BA), Servicio, Vehículo, badge
- [ ] Empty `data-testid="appointments-empty"`; no `fecha_hora_inicio` leak
- [ ] Pagination `?page&limit` works, limit≤100, excludes CANCELADO/RECHAZADO
- [ ] Tests green: RSC+enrichment+Intl+badge+pagination
- [ ] <400 lines or clean split; no RSC violation
