# Design: t044-booking-result — Mostrar resultado de la reserva

## Technical Approach

RSC `appointments/page.tsx` (`force-dynamic`, `searchParams Promise`) fetches `?confirmed=` via `getAppointmentById` + list via `listAppointments` in `Promise.all` (direct service DI, no fetch hop). Valid owned `PENDIENTE|CONFIRMADO` → `role="status"` banner with `Intl` TZ; else neutral. Dismiss is a tiny client island (`router.replace` stripping only `confirmed`) in `<Suspense>`. Reuses `new/page.tsx` and `services/vehicles/page.tsx` precedents. No API/migration.

## Architecture Decisions

| # | Decision | Options | Tradeoff | Choice |
|---|----------|---------|----------|--------|
| D1 | RSC direct calls | A: service DI parallel · B: `fetch /api` | B adds RTT/flash, breaks precedent, needs new `GET /:id` | **A** `Promise.all([getWorkshopConfig, getAppointmentById?, listAppointments])` |
| D2 | File layout | New segment vs reuse `new/` | Reuse conflates builder/result, breaks isolation | **Create** `page.tsx` + `_components/BookingConfirmation.tsx` + `appointments.module.css` |
| D3 | Compound pattern | Boolean props vs compound + `createContext`+`use()` | Booleans exponential (rule 1.1) | **B** `BookingConfirmation[.Banner/.Details/.Dismiss]` React 19 |
| D4 | Validation | `z.uuid().safeParse` + `superRefine` status guard | `parse()` noisy; regex incomplete | **safeParse** early: invalid/XSS → no DB, plain text |
| D5 | Ownership | `auth()`+`assertOwnership` → `Forbidden→404` | 403 leaks existence | **Map 403/404→404** neutral, ADMIN bypass, list scoped by `customerId` |
| D6 | Timezone | `Intl.DateTimeFormat(timeZone: config.timezone)` vs `-03:00` slice | Hardcode drifts, violates INV-06 | **Intl** `America/Argentina/Buenos_Aires`, ISO DTO across boundary |
| D7 | Dismiss | `URLSearchParams(toString())` + `router.replace({scroll:false})` in Suspense | `push` pollutes history; reload loses page | **replace** strips only `confirmed`, preserves `page`/`limit`, PRG |
| D8 | List coexistence | Reuse `listAppointments` RN-04 | Custom query duplicates RN-04; T-045 out of scope | **Reuse** `limit 20`/`page 1`/`asc`, `PENDIENTE|CONFIRMADO && start>now` |
| D9 | Error boundaries | Isolated `try/catch` on `getAppointmentById` only | Banner failure must not break list | **Isolated**; `CANCELADO|RECHAZADO` → neutral guard |
| D10 | Styling tokens | Mirror `errorBannerDestructive` as `successBanner` | Tailwind diverges; inline breaks contrast | **CSS module** `--color-success`, `radius`/`space`, `role=status` a11y |
| D11 | No new API | Reuse `appointmentService`/`turnos`/`workshopConfig` | New route doubles auth surface | **Zero contracts**; rollback = delete 3 files |

## Data Flow

```
BookingForm 201 ──► ?confirmed=<uuid> ──► RSC page.tsx (auth guard, await searchParams)
                                        ├─► getWorkshopConfig(db) ─► DB
                                        ├─► safeParse(uuid) ─► getAppointmentById ─► toTurnoDTO (INV-08)
                                        └─► listAppointments RN-04 ─► {data, pagination}
                                        ▼
                                  <BookingConfirmation> (RSC→island, TurnoDTOJson ISO)
                                    Banner role=status + Intl TZ + Dismiss (Suspense, router.replace)
                                  + appointments.module.css
```

```
page.tsx (RSC)
├── BookingConfirmation.Banner/Details/Dismiss (client, Suspense)
└── UpcomingList (RSC, listAppointments)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(customer)/appointments/page.tsx` | Create | RSC `auth`, `Promise.all`, `safeParse`, `403→404`, RN-04, `Intl` |
| `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` | Create | `createContext`+`use()` `Banner/Details/Dismiss` |
| `src/app/(customer)/appointments/appointments.module.css` | Create | `.successBanner` mirroring `errorBannerDestructive` |
| `src/services/appointmentService.ts` | Read | `getAppointmentById`/`listAppointments` |
| `src/db/repositories/turnos.ts` | Read | `findTurnoById`/`findTurnosPaginated` |
| `src/lib/auth/requireAuth.ts` | Read | `assertOwnership` |
| `src/config/workshopConfig.ts` | Read | `getWorkshopConfig(db)` |

## Invariant Compliance

| INV | Rule | Enforcement |
|-----|------|-------------|
| INV-02 | `PENDIENTE/CONFIRMADO/RECHAZADO/CANCELADO` | `isBannerEligible` guard; no `COMPLETADO` |
| INV-03 | JWT + `clienteId==authUser.id` | `auth→redirect`, `assertOwnership`, `403→404`, scoped list |
| INV-06 | `TIMESTAMPTZ` UTC, `America/Argentina/Buenos_Aires` | `Intl` with `config.timezone` |
| INV-08 | `snake_case`→`camelCase` DTO | `toTurnoDTO` ISO, no `estado` leak |

## Interfaces / Contracts

No new API. Reused shape:

```ts
type TurnoDTOJson = { id:string; customerId:string; vehicleId:string; serviceId:string;
  startDateTime:string; endDateTime:string; status:string; createdAt:string; updatedAt:string; };
const confirmedSchema = z.string().uuid();
const isBannerEligible = (s:string) => s==="PENDIENTE"||s==="CONFIRMADO";
```

Compound: `BookingConfirmation` + `Banner` + `Details({turno,timezone})` + `Dismiss` (reads `useSearchParams`, `router.replace`).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `safeParse` invalid/XSS | Vitest `success===false` |
| Unit | `Intl` BA `12:30Z`→`09:30` | Vitest fixed date |
| jsdom | Banner vs neutral | variants `role=status` |
| jsdom | Dismiss preserves siblings | mock `replace` `scroll:false` |
| Integration | `403→404`/`404`/`ADMIN` | service auth fixtures |
| Integration | RN-04 list | repo `limit 20` `totalPages` |
| E2E | 201→banner→dismiss; 401→login | Playwright |

## Threat Matrix

| Threat | Applicable | Mitigation | RED Test |
|--------|------------|------------|----------|
| UUID enumeration | Yes | `403→404` | Foreign → neutral |
| XSS `?confirmed=` | Yes | `safeParse` plain text | `<script>` → no banner |
| Stale `CANCELADO` | Yes | `PENDIENTE|CONFIRMADO` only | Cancelled → neutral |
| CSR bailout | Yes | `<Suspense>` | Build ok |
| Auth bypass | Yes | `auth→redirect` | Unauth → 307 |

N/A: shell/subprocess/VCS/PR/executable/process integration.

## Migration / Rollout

No migration. Single PR <400 lines → staging verify → prod. Rollback: delete 3 files → 404; hotfix `?confirmed=`→`/appointments/new`.

## Open Questions

- [ ] T-045 `?page=` coexistence — defer.
- [ ] Labels `serviceName`/`vehicleLabel` — fetch in `Promise.all` or IDs?
