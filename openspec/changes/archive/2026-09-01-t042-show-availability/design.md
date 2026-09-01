# Design: T-042 Mostrar disponibilidad

## Technical Approach

RSC server-direct (A) + grid compound (C1) per explore #452. Keep `dynamic="force-dynamic" revalidate=0` and `Promise.all([getWorkshopConfig(db), listServices(active)])` parallel. After T-041 validation (`serviceIdSchema` uuid+active, `dateSchema` + `getBaDayUtcRange` + `isPastBa` + `addBaDays(60)`), branch `if (selectedService && selectedDate)` calls `getAvailableSlotsForDate` with `noonDate=new Date(date+"T12:00:00.000Z")` and `findActiveTurnosByDateRange` adapter (identical `route.ts:96-97`), then `formatSlotsAsHHmm(slots, tz)` → `availableSlots: string[]|null`. Only `string[]` HH:mm primitives cross to client `AvailabilitySlots` writing `?slot=HH:mm` with sibling preservation. No new API/domain.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Fetch location | A server-direct vs B `fetch("/api/availability")` | A: SSR no waterfall/flicker, same BA offset delta, auth via session. B: `credentials:include`, `no-store`, dedup, hydration mismatch | **A** |
| Timing | Conditional vs always | Always wastes DB on tampered URL | **Conditional `selectedService&&selectedDate` else `null` 200** |
| Parallelism | Extend `Promise.all` vs sequence | Slots need `duration+config` cannot parallelize | **Keep `Promise.all` for config+services, sequence slots** |
| Slot UI | C1 grid vs C2 `select` vs C3 RSC `a` | C2 hides scan, C3 full nav loses `scroll:false` | **C1 compound `radiogroup` mirrors `DateSelector`** |
| Boundary | `server-only` leak vs primitives | Leak breaks client bundle | **Only `string[]` crosses (INV-06)** |
| Config | `getWorkshopConfig(db)` vs frozen | Frozen drifts after admin PATCH | **Per-request DI `capacity1 step30 tz BA`** |

A+C1 keeps `force-dynamic`, `auth()→redirect("/login")`, BA noon `T12:00Z`+`Intl en-CA` DST-safe, URL-canonical for T-043 `?serviceId=&date=&slot=&vehicleId=`.

## Data Flow

```mermaid
flowchart LR
  URL["?serviceId & ?date & ?slot & ?vehicleId"] --> AUTH["auth()"]
  AUTH --> PAR["Promise.all(config,services)"]
  PAR --> VAL["validate uuid/active + BA date"]
  VAL -->|valid| NOON["noon T12:00Z"]
  NOON --> FETCH["getAvailableSlotsForDate(duration,config,fetchActiveTurnos)"]
  FETCH --> RNG["getBaDayUtcRange [00:00,next 00:00) bulk ACTIVE"]
  RNG --> GEN["generateSlots step30 + fechaHoraFin<=finIntervalo"]
  GEN --> CAP["isSlotAvailable count<capacity half-open"]
  CAP --> FMT["formatSlotsAsHHmm → string[]"]
  FMT --> PROPS["AvailabilitySlots props primitives"]
  PROPS --> GRID["Grid radiogroup → router.push ?slot siblings {scroll:false}"]
  VAL -->|tampered| NULL["null hint no 500"]
  GEN -->|closed []| EC1["[] Closed"]
  CAP -->|booked| EC2["[] EC-02"]
```

Sibling preservation via `new URLSearchParams(searchParams.toString())`.

## File Changes

| File | Action | Description | LOC |
|------|--------|-------------|-----|
| `src/app/(customer)/appointments/new/page.tsx` | Modify | Add conditional `availableSlots` fetch + render branch; imports `getAvailableSlotsForDate`, `formatSlotsAsHHmm`, `findActiveTurnosByDateRange` | +40 |
| `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx` | Create | `"use client"` compound `Grid/Empty/SelectedBanner`; `createContext`+`use()`+`useSearchParams`+`router.push`; `slotSchema`+`includes` guard `radiogroup/radio` | ~105 |
| `src/app/(customer)/appointments/new/appointments.module.css` | Modify | `.slotGrid` `.slotButton` `.slotSelected` `.slotEmpty` tokens | ~50 |
| `src/lib/validators/slot.ts` | Create | `slotSchema /^(?:[01]\d|2[0-3]):(?:00|30)$/` | ~8 |
| `loading.tsx`/`error.tsx` | Read-only | Reuse `aria-busy` shimmer / retry boundary | 0 |
| `services/availability/*` `config/workshop*` `db/repositories/turnos.ts` | Read-only | Reuse DI `capacity1 step30` `operatingHours` | 0 |

**Total ~203 + tests ~80 = ~283 <400** `feature-branch-chain` single PR.

## Interfaces / Contracts

```ts
type SearchParams = { serviceId?: string; date?: string; slot?: string; vehicleId?: string };
serviceId: z.string().uuid() + services.find(active)
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).superRefine noon round-trip
slot: z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/) // INV-05 step 30
WorkshopConfig = { timezone:"America/Argentina/Buenos_Aires", operatingHours: Record<number,TimeInterval[]>, capacityPerSlot:1, slotStepMinutes:30 }
type FetchActiveTurnos = (r:{fromUtc:Date,toUtc:Date})=>Promise<ExistingEntry[]>
function getAvailableSlotsForDate(a:{date:Date,durationMinutes:number,config:Pick<WorkshopConfig,"timezone"|"slotStepMinutes"|"capacityPerSlot"|"operatingHours">,fetchActiveTurnos:FetchActiveTurnos}):Promise<Slot[]>
function formatSlotsAsHHmm(s:Slot[], tz:string): string[]
type AvailabilitySlotsProps = { slots:string[]|null, date:string|null, serviceId:string|null, vehicleId:string|null, closedDows:number[], timezone:string }
```

Reuse: same adapter `route.ts:96-97`, same helpers `dateSchema/getBaDayUtcRange/isPastBa/addBaDays`, same tokens, same `loading/error`. BA: noon `T12:00Z`+`Intl en-CA`, bulk `getBaDayUtcRange`, duration `calculateEndAndValidate` filters `11:30+90 >12:00 → skip`. Null=`hint`, `[]`=`Empty` closed (`closedDows.includes(getBaDow)`) vs booked EC-02.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | duration `fechaHoraFin<=finIntervalo`, `count<1` half-open, `formatSlotsAsHHmm`, `selectSlot` siblings + `includes` | Vitest + `userEvent.click` assert `router.push` |
| Integration | RSC mocks `findActiveTurnosByDateRange` → `null` tampered, `[]` closed, `[]` booked, `["09:00"]` valid | `page.test.tsx` HTML asserts |
| E2E | deep-link `?serviceId=&date=` → grid, click → `?slot=09%3A30` siblings, banner, clear `delete(slot)` | Playwright |

## Threat Matrix

N/A — no shell/subprocess/VCS/PR/executable classification/process-integration. RSC pure + `router.push`; no command construction or subprocess.

## Migration / Rollout

No migration. Additive branch `selectedService&&selectedDate`; T-041 CTA/hint unchanged. Rollback revert commit. No DB change, no flag, `force-dynamic` per-request freshness.

## Open Questions

- [ ] Canonical `?slot=` vs `?time=` confirm pre T-043
- [ ] `<noscript>` `<a href="?slot=">` fallback in C1?
- [ ] Copy: "Closed on Sundays" vs "No availability — try another date"
