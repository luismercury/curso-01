# Design: t041-date-selection — Fecha (H-25)

## Overview & Goals

Produce `?date=YYYY-MM-DD` BA alongside `?serviceId=` for `GET /api/availability?date=&serviceId=` (gap T-040→T-042). URL canonical, BA `min=today`/`max=+60d` without drift INV-06, tampered→null no 500, reuse RSC+island T-039/T-040, <400L, no new API.

## Technical Approach

RSC `appointments/new/page.tsx` (`force-dynamic`) `auth()` → `getWorkshopConfig(db)` → `closedDows/tz/min/max` → `listServices` → `date/serviceId` Zod+`getBaDayUtcRange` → primitives to `DateSelector`. Island `URLSearchParams+router.push` preserves siblings. CSS Modules, `loading.tsx`/`error.tsx`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Route | A `appointments/new` / B `booking` | B diverges from `POST /api/appointments` | **A** |
| Shell | A RSC direct / B client fetch | B waterfall loses SSR | **A** |
| State | A `?date=` URL / B useState/localStorage | B breaks deep-link | **A** URL |
| Widget | A native `<input type=date>` / B grid / C lib | B >200L ARIA, C bundle | **A** native |
| Composition | A compound `Input/Banner` / B booleans | B sprawl | **A** compound |
| TZ | A `Intl en-CA {timeZone}` / B `toISOString` | B drift | **A** |

```
[(customer)/layout] auth()→/login INV-03
 → [appointments/new/page.tsx RSC] force-dynamic
   ├─ getWorkshopConfig(db)→{tz,operatingHours}→closedDows[] INV-06
   ├─ listServices→selectedService (uuid safeParse+find(active))
   ├─ dateSchema+getBaDayUtcRange→selectedDate|null, min/max
   ├─ !selectedService→CTA /services
   ├─ loading aria-busy / error 401→/login
   └─► DateSelector ("use client")
        ├─ Input {date,min,max,closedDows,tz} → URLSearchParams set/delete date → router.push
        └─ Banner {serviceId,date} → Continue ?serviceId=&date= → T-042
```
`WorkshopConfig {timezone,operatingHours,slotStepMinutes=30,capacityPerSlot=1}` parametrizable T-036b.

## File Changes

| File | Action | LOC | Description |
|------|--------|-----|-------------|
| `src/app/(customer)/appointments/new/page.tsx` | Create | ~80 | `force-dynamic`, `auth→redirect`, `getWorkshopConfig→closedDows`, `listServices→selectedService`, validate `date`→null |
| `src/app/(customer)/appointments/new/_components/DateSelector.tsx` | Create | ~100 | `"use client"` compound, `useSearchParams+useRouter`, sibling-preserving select |
| `src/lib/validators/date.ts` | Create | ~40 | `DATE_MAX_DAYS=60`, `dateSchema`, `getTodayBaYmd`, `addBaDays`, `isPastBa` |
| `src/app/(customer)/appointments/new/appointments.module.css` | Create | ~60 | tokens `--color- --space- --radius-` |
| `src/app/(customer)/appointments/new/loading.tsx` | Create | ~25 | shimmers `aria-busy` |
| `src/app/(customer)/appointments/new/error.tsx` | Create | ~55 | classify `unauthorized→/login` else retry |
| `src/app/(customer)/layout.tsx` | Modify | ~5 | Nav `Appointments`→`/appointments/new` |
| **Total** | | **~365** | **<400** |

## Interfaces / Contracts

```ts
type SearchParams = Promise<{ serviceId?: string; date?: string; vehicleId?: string }>
interface DateSelectorProps {
  date: string|null; min:string; max:string; // YYYY-MM-DD BA
  closedDows:number[]; // 0=Sun..6
  serviceId:string|null; vehicleId:string|null;
  timezone:string; // America/Argentina/Buenos_Aires INV-06
}
export const DATE_MAX_DAYS=60;
export const dateSchema: z.ZodString; // regex ^\d{4}-\d{2}-\d{2}$ + superRefine noon round-trip
export function getTodayBaYmd(tz:string):string
export function addBaDays(ymd:string,days:number,tz:string):string
export function isPastBa(ymd:string,todayYmd:string):boolean
export function getBaDow(ymd:string,tz:string):number
export function getBaDayUtcRange(baYmd:string,tz:string):{fromUtc:Date;toUtc:Date}
```
DTO INV-08: `date` camelCase, never `fecha`; primitives only. Noon overflow `new Date(d+"T12:00:00.000Z").toISOString().slice(0,10)===d` catches `2026-02-30`.

## Data Flow

`GET /appointments/new?serviceId=&date=` → `layout auth()` INV-03 → `getWorkshopConfig(db)` → `closedDows+tz+min/max` via `Intl en-CA` → `serviceId z.uuid+find(active)` → `dateSchema+getBaDayUtcRange` + `isPastBa` → `selectedDate` → `<DateSelector>` → `URLSearchParams` set/delete `date` → `router.push` → T-042 same → `getAvailableSlotsForDate` INV-01/05.

## BA Timezone Handling (INV-06)

`getTodayBaYmd(tz)=Intl.DateTimeFormat("en-CA",{timeZone:tz}).format(new Date())`. `addBaDays` noon UTC then BA re-format (DST 23/25h). Never `toISOString`. Server `getBaDayUtcRange` via `baWallTimeToUtcDate` offset delta DST-aware. Parametrizable.

## Auth & Guards (INV-03)

`(customer)/layout auth()→/login` inherited; page re-guards. `!selectedService` → CTA `/services`, island hidden. Tampered `?date=` → `null`, 200 no 500.

## Error / Loading

`loading.tsx` `aria-busy`. `error.tsx` `unauthorized→/login` else `reset()`, `role="alert"`, no `fecha` leak INV-08. Hint `closedDows.includes(getBaDow(d,tz))` → `"Closed"` non-blocking; T-042 `200 []`.

## Chain Handoff to T-042

T-042 reads `searchParams.date/serviceId` same validation → `noonDate=new Date(d+"T12:00:00.000Z")` → `getAvailableSlotsForDate({date:noonDate,duration,config,fetchActiveTurnos})` → `formatSlotsAsHHmm` → `{date,availableSlots}` INV-01/05.

## Alternatives Rejected

B SPA `useEffect+localStorage`: waterfall, no SSR, breaks URL. C Server Actions `selectDate→redirect`: POST for read, no instant `onChange`.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| BA drift `toISOString` | High | `Intl en-CA` helpers + BA tests |
| Tampered `?date/serviceId` 500 | High | `safeParse+find(active)+overflow→null` |
| Closed-day confusion | Med | `closedDows` hint; T-042 `200 []` |
| Missing `serviceId` orphan | Med | CTA guard |
| >400L | Low | ~365L |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit `date.ts` | `getTodayBaYmd` BA vs UTC, `addBaDays` DST, `dateSchema` regex/overflow/past | `vitest` node |
| Component jsdom | push preserves siblings, clear deletes `date`, `min/max`, hint, banner href | RTL mock `next/navigation` |
| RSC | auth null→/login, tampered→null, past/overflow→null, missing service→CTA | RSC mocks |
| Error/loading | `aria-busy`, 401→/login | RTL |

## Threat Matrix

| Area | Applicable | RED Test |
|------|------------|----------|
| Routing `?date/?serviceId` injection | **Applicable** — `safeParse+getBaDayUtcRange` null | tampered `2026-02-30`→null no 500 |
| Shell/subprocess | N/A — no exec | — |
| VCS/PR | N/A | — |
| Executable-file | N/A | — |
| Process integration | N/A | — |

## Migration / Rollout

No migration. Single PR <400L. Rollback `git revert`. T-042 blocked.

## Open Questions

- [ ] `vehicleId` param name for T-043 or implicit via auth?
- [ ] `WorkshopConfig.maxAdvanceDays` replacing `60`?
