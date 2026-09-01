# Proposal: t041-date-selection — Fecha (H-25)

## Intent
Cliente elige fecha FL-01 step4 F-03/RN-05 como `?date=YYYY-MM-DD` BA → `GET /api/availability?date=&serviceId=`. Cubre hueco T-040→T-042. Sin API nueva.

## Scope
### In Scope
- RSC `appointments/new/page.tsx`: `auth()` INV-03, `getWorkshopConfig`→`closedDows`/`tz` INV-06, valida `?serviceId`+`?date`, `min=today` `max=+60d`
- Island `DateSelector` compound native `<input type=date>` URL `router.push(?date=&serviceId=)` preserva siblings
- `lib/validators/date.ts` Zod `dateSchema`+`getTodayBaYmd`/`addBaDays`/`isPastBa` sin `toISOString`
- `appointments.module.css`+`loading.tsx`/`error.tsx`
- Guard `!serviceId`→CTA `/services`; tampered `?date`→`null` no 500
### Out of Scope
- T-042 fetch `availableSlots` (INV-01/05 filtrado `capacity`/`fechaHoraFin<=finIntervalo`)
- T-043 `POST /appointments`+T-044, holidays, `maxAdvanceDays`, grid custom

## Capabilities
### New Capabilities
- `date-selection`: fecha BA validada, URL canónica, hint cerrado, min/max — `specs/date-selection/spec.md`
### Modified Capabilities
- None

## Approach
**A LOCKED — RSC + URL island:** `auth()+getWorkshopConfig+listServices` `force-dynamic`, pasa `date|min|max|closedDows|tz`. Cliente `dateSchema`→`URLSearchParams`. Pros: SSR deep-link DST BA reusa T-040 <400L.

**B SPA client `useEffect`+`localStorage`:** waterfall no SSR pierde refresh/share rompe `?date=`. Rechazado viola `server-serialization`.

**C Server Actions `selectDate→redirect`:** POST lectura sin `onChange` instant sin `min/max` inline. Rechazado indirección.

### Locked Decomposition
- `page.tsx`~80L: `force-dynamic`, `auth→redirect`, `getWorkshopConfig→closedDows`, `listServices→selectedService`, `safeParse+getBaDayUtcRange`→`selectedDate|null`, `min/max`
- `DateSelector.tsx`~100L: `"use client"` `useSearchParams`/`useRouter`, `selectDate` preserva `serviceId`/`vehicleId`, `<input min max>`, hint `closedDows`, `SelectedBanner` `href="?serviceId=&date="`
- `validators/date.ts`~40L: `DATE_MAX_DAYS=60`, `dateSchema` regex+`superRefine` noon round-trip, helpers puros
- `appointments.module.css`+`loading.tsx`+`error.tsx`

### Chain Handoff T-042
T-042 lee `searchParams.date/serviceId` server-side igual validación → `getAvailableSlotsForDate({date:noonDate,duration,config})` → `{availableSlots}`. Sin drilling, auth resuelto, duración vía `serviceId` INV-05/08.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `appointments/new/page.tsx` | New | RSC BA min/max validación |
| `appointments/new/_components/DateSelector.tsx` | New | Compound URL write |
| `lib/validators/date.ts` | New | Zod BA helpers |
| `appointments/new/appointments.module.css` | New | Tokens |
| `appointments/new/loading.tsx` | New | Skeleton |
| `appointments/new/error.tsx` | New | 401→/login |
| `(customer)/layout.tsx` | Mod | Nav Book |
| `config/workshop*`/`services/availability/*` | Read | INV-06 BA param |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| BA drift `toISOString` | High | `Intl en-CA {timeZone}` nunca UTC |
| Tampered `?date`/`?serviceId` | High | `safeParse`+`find(active)`+overflow→`null`+banner |
| Día cerrado | Med | `closedDows` hint; vacío es T-042 `200 []` |
| `serviceId` faltante | Med | CTA `/services` bloquea huérfana |
| >400L | Low | A ~280L |

## Rollback Plan
Sin migración. Borrar `appointments/new/*`+`validators/date.ts` revert nav. `git revert`.

## Dependencies
Done: T-025 availability BA DST, T-040 `?serviceId`, T-039, WorkshopConfig param INV-06/08/03. Feeds T-042(`?date=&serviceId=`)/T-043/T-044. T-041 bloquea T-042 DAG acíclico.

## Success Criteria
- [ ] `?date` canónico preserva `serviceId` refresh/share sin `localStorage`
- [ ] `min=today`/`max=+60d` BA Intl rechaza pasado/overflow sin drift
- [ ] Tampered/faltante→fallback sin 500 hint cerrado
- [ ] `loading`+`error` 401→/login sin leak `fecha` INV-08 INV-03
- [ ] Tests jsdom RSC+DateSelector min/max push fallback
- [ ] Hybrid persisted
