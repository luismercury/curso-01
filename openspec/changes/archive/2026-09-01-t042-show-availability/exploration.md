# Exploration: t042-show-availability — Mostrar disponibilidad

> FASE 8 UI-03 T-042 | Chain: T-025 (GET /api/availability) + T-041 (date-selection) → T-042 → T-043 (form) → T-044 (result)
> Master baseline: 3c4fb7f (T-041 merged, 5 ADDED 10/10 PASS archived) | Review budget: 400 lines | Delivery: auto-chain feature-branch-chain

## Scope

**Goal (T-042 one-liner):** "La interfaz deberá solicitar la disponibilidad al backend y mostrar únicamente los horarios disponibles." UI slice only — reads validated `?date=` + `?serviceId=` server-side, delegates to availability domain, renders only slots that survive `durationMinutes` + `fechaHoraFin <= finIntervaloOperativo` + `count < capacityPerSlot` + closed-day `[]` filters. No booking mutation (T-043 owns `POST /api/appointments`).

**In scope (T-042 only):**
- RSC reads `searchParams.date` + `searchParams.serviceId` (already validated in `page.tsx` per T-041) and conditionally fetches available slots.
- Renders slot grid/list with selection that writes `?slot=HH:mm` (or `?time=`) preserving `serviceId/date/vehicleId` siblings for T-043.
- Empty/closed/inactive/error states (EC-02: "no hay disponibilidad", closed DOW `200 []`, tampered date fallback `null`).
- Styling via `appointments.module.css` tokens, loading/error boundaries reuse, no Tailwind.

**Out of scope (deferred):**
- T-043: vehicle selector + `POST /api/appointments` form + conflict toast (`APPOINTMENT_NOT_AVAILABLE`).
- T-044: creation result banner + retry.
- New API: reuses `T-025 GET /api/availability` — no new route.

## Current State

### Dependencies VERIFIED DONE

| Dependency | Evidence | Status |
|---|---|---|
| **T-025 `GET /api/availability?date=&serviceId=`** | `src/app/api/availability/route.ts:24-124` — `querySchema.strict({date: /^\d{4}-\d{2}-\d{2}$/, serviceId: uuid})`, `requireAuth` 401/403, `getWorkshopConfig(db)` per-request (T-036b), `getBaDayUtcRange(dateStr, tz)` + noon overflow check (`2026-02-30 → VALIDATION_ERROR`), `getServiceById` + `!dto.active → INVALID_SERVICE 400`, `getAvailableSlotsForDate({date: noonDate, durationMinutes, config, fetchActiveTurnos: (r)=>findActiveTurnosByDateRange(db,r)})` → `formatSlotsAsHHmm(slots,tz)` → `{date, availableSlots: string[]}` | **DONE — consumable** |
| **Availability domain (pure core)** | `src/services/availability/availabilityService.ts:57-157` — `getBaDayUtcRange(string|Date)` DST via `baWallTimeToUtcDate`, `getAvailableSlots({date, durationMinutes, config, existingTurnos})` pure filter via `isSlotAvailable(count < capacityPerSlot half-open)`, `getAvailableSlotsForDate` single bulk fetch (BA day `[00:00, next 00:00)`).<br>`src/services/availability/slotGenerator.ts:45-136` — `baWallTimeToUtcDate` Intl offset delta, `generateSlotsForDate` loops `interval[ startMin, endMin )` step `slotStepMinutes=30`, `toHHmm` + `calculateEndAndValidate` filters `fechaHoraFin <= finIntervaloOperativo`. `src/config/workshopSchedule.ts:68-106` — `getOperatingIntervalsForDate` DOW via `en-CA` BA formatter; `DEFAULT_OPERATING_INTERVALS 09:00-12:00/14:00-18:00` Mon-Fri fallback, Sat/Sun `[]`. `src/config/workshopConfig.ts:118-120` — `getWorkshopConfig(db)` DI, `WORKSHOP_TIMEZONE=America/Argentina/Buenos_Aires`, `capacityPerSlot=1 motion`, `slotStepMinutes=30`, `operatingHours: WeeklySchedule`. `src/db/repositories/turnos.ts:406-431` — `findActiveTurnosByDateRange` bulk `tstzrange(...) &&` + `ACTIVE_STATUSES IN ('PENDIENTE','CONFIRMADO')`. | **DONE — no new domain** |
| **T-041 date-selection (RSC shell + DateSelector)** | `src/app/(customer)/appointments/new/page.tsx:45-196` — `dynamic="force-dynamic" revalidate=0`, `auth()→redirect('/login')`, `Promise.all([getWorkshopConfig(db), listServices(db,{includeInactive:false})])` parallel, `serviceIdSchema.safeParse + active find` → `selectedService|null`, `dateSchema.safeParse + isPastBa + addBaDays max 60 + getBaDayUtcRange overflow` → `selectedDate|null`, `deriveClosedDows` `[0,6]` for Mon-Fri example, CTA guard `!selectedService → /services`, props `{date, min, max, closedDows, timezone, serviceId, vehicleId}` to `<DateSelector>` compound, sibling `vehicleId` preserved.<br>`_components/DateSelector.tsx:1-390` — `"use client"` compound `createContext + use()`, `useSearchParams` + `router.push` sibling-preserving writes, native `<input type="date" min max>` uncontrolled `defaultValue+key`, `SelectedBanner` + `ClearButton`, `resolveDate` pure helper.<br>`src/lib/validators/date.ts:1-221` — `dateSchema` regex+superRefine noon round-trip, `getTodayBaYmd(tz,ref)`, `addBaDays`, `isPastBa`, `getBaDayUtcRange` pure, `DATE_MAX_DAYS=60`, `baWallTimeToUtcDate` Intl offset delta.<br>`appointments.module.css:1-129` — tokens `field/input/hint/banner/cta`, `loading.tsx` shimmer `aria-busy`, `error.tsx` 401→`/login` / retry. | **DONE — pattern to extend, no overwrite** |
| **Auth (INV-03)** | `middleware.ts` (`jose` verify on `/api/:path*`), `src/lib/auth/requireAuth.ts` + `src/lib/auth/auth.ts` (NextAuth 5 JWT httpOnly), `(customer)/layout.tsx` RSC `auth()` guard. `/api/availability` already `requireAuth` | **DONE** |
| **No slot UI exists** | `page.tsx:181-194` renders only `<DateSelector><Input/><ClearButton/><SelectedBanner/></>` — no slot island. T-042 is greenfield inside the `selectedService && selectedDate` branch. | **Greenfield for slots** |

### How availability currently flows (without T-042)

```
User at /services → picks service → ?serviceId= persists (T-040)
  → /appointments/new?serviceId=<uuid> → DateSelector → ?date=YYYY-MM-DD BA (T-041)
      → T-042 NEEDED: reads (?date=&?serviceId=), delegates to domain, renders slots
          → T-043 NEEDED: user picks slot HH:mm (→ ?slot=) + vehicle → POST /api/appointments
```

Server validates `date`+`serviceId` strictly; UI already produces valid pair but has no consumer that shows `availableSlots`. `GET /api/availability` is proven via `T-026` critical tests (EC-02 empty, capacity count, duration + cruce cierre).

## Affected Areas

- `src/app/(customer)/appointments/new/page.tsx` — **modify** (add conditional `availableSlots` fetch + render branch; keep `force-dynamic`, parallel fetch, tampered fallback, CTA guard).
- `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx` — **new** (proposed) client compound or RSC leaf that renders the slot set. Alternative: `_components/AvailabilitySection.tsx` compound owning selection + sibling preservation.
- `src/app/(customer)/appointments/new/appointments.module.css` — **modify** (add `.slotGrid`, `.slotButton`, `.slotSelected`, `.slotEmpty`, `.slotSkeleton` tokens; reuse existing input/banner tokens; no Tailwind).
- `src/app/(customer)/appointments/new/loading.tsx` + `error.tsx` — **read-only** but constraining (segment-level Suspense/ boundary already wraps page; slot-specific fallback may be a nested `Suspense` or inline skeleton).
- `src/services/availability/availabilityService.ts` + `slotGenerator.ts` + `src/config/workshopSchedule.ts` + `src/config/workshopConfig.ts` — **read-only** but constraining (timezone, capacity, step, operatingHours, `getBaDayUtcRange`, `formatSlotsAsHHmm`).
- `src/db/repositories/turnos.ts` — **read-only** (`findActiveTurnosByDateRange` adapter reused).
- `src/lib/validators/date.ts` + `src/lib/validators/service.ts` + `src/lib/api/services.ts` — **read-only** (validation reuse, no new schema except optional `slotSchema` `HH:mm`).
- `openspec/specs/date-selection/spec.md` — **read-only** reused pattern (RSC shell, URL-canonical compound, BA helpers, DTO mapping). T-042 will add a sibling spec delta `availability-display`.

## Approaches

### Approach A — Pure RSC server-direct domain call (RECOMMENDED core)

**What:** `page.tsx` RSC, after resolving `selectedService` + `selectedDate` (T-041 validation), conditionally calls the domain directly — no HTTP round-trip:

```ts
// inside page.tsx, after selectedService/selectedDate resolved:
let availableSlots: string[] | null = null; // null = not requested (missing date/service)
if (selectedService && selectedDate) {
  const noonDate = new Date(`${selectedDate}T12:00:00.000Z`); // same sentinel as route.ts:100
  const slots = await getAvailableSlotsForDate({
    date: noonDate,
    durationMinutes: selectedService.durationMinutes,
    config,
    fetchActiveTurnos: (range) => findActiveTurnosByDateRange(db, range),
  });
  availableSlots = formatSlotsAsHHmm(slots, config.timezone); // string[] HH:mm BA
}
```

Then render `<AvailabilitySlots slots={availableSlots} date={selectedDate} serviceId={...} vehicleId={...} />` (or inline grid) in the `selectedService` branch alongside `<DateSelector>`. `availableSlots` is `null` (guard: show "Pick a date first"), `[]` (empty/closed/capacity-full → EC-02 message), or `["09:00",...]`.

**Why "server-direct" over HTTP:** Route `GET /api/availability` does exactly this adapter + `formatSlotsAsHHmm`; RSC calling the service reuses the same pure core and the same `findActiveTurnosByDateRange` bulk fetch, with identical BA semantics (`getBaDayUtcRange`, `calculateEndAndValidate`). HTTP would add:
- base-url resolution (`NEXT_PUBLIC_APP_URL` vs relative fetch) + `cookies()` forwarding + cache `no-store` ceremony,
- auth double-check (RSC already proved `auth()`; route would `requireAuth(req)` again on same edge),
- latency + serialization back to JSON then parse.

Server-direct keeps **single bulk fetch**, **no N+1**, **DI config** (`capacityPerSlot`, `slotStepMinutes`, `timezone`, `operatingHours`), and matches the `Promise.all` parallel precedent (config+services already share the same `db` tx). Testability: `page.test.tsx` can mock `findActiveTurnosByDateRange` + `getAvailableSlotsForDate` thinly; integration tests hit real DB.

- Pros: SSR FCP (no client waterfall), no loading flash for initial slot set, URL is canonical (refresh/deep-link/share works because RSC reads `searchParams`), identical BA/DST behavior to API (same helpers), auth propagates via server session not cookies, closed-day `200 []` handling is naturally `generateSlotsForDate → []`, duration/capacity filtering is server-authoritative, review budget lean (~40 lines added to `page.tsx` + ~80 for leaf component), aligns with `vercel-react-best-practices: server-serialization` (only `string[]` HH:mm crosses boundary, no `Date` objects, INV-06), `server-parallel-fetching` (availability fetch can be parallelized with nothing else, or sequenced after config resolution — still one round to DB).
- Cons: RSC fetch is not cacheable per-slot without a fetch key; page-level `force-dynamic` already opts out of SSG (acceptable). Slight coupling to domain imports in `page.tsx` (`"server-only"` boundary — must not leak `server-only` to client leaf; only primitives cross).
- Effort: **Low** (domain exists; wiring is ~1 adapter function).

### Approach B — Client island `useEffect`/`SWR` fetching `/api/availability` (REJECTED as primary, viable as fallback)

**What:** A `"use client"` island `<AvailabilitySlotsClient date serviceId />` does:

```ts
const [slots, setSlots] = useState<string[]|null>(null);
useEffect(() => {
  if (!date || !serviceId) return;
  fetch(`/api/availability?date=${date}&serviceId=${serviceId}`, { credentials: "include" })
    .then(r => r.json()).then(j => setSlots(j.availableSlots));
}, [date, serviceId]);
```

**Tradeoffs:**
- Pros: Decouples RSC from DB; client can poll/refresh without full navigation; progressive loading (skeleton while fetching) is natural.
- Cons: Anti-pattern per `vercel-react-best-practices: client-swr-dedup` (needs dedup/cache), waterfall (`useEffect` after hydration), SSR mismatch (initial HTML has no slots, then client injects — `rendering-hydration-no-flicker` violation), BA drift if client computed `date` but RSC already validated BA; auth requires cookie forward (works same-origin but extra failure mode), closed-day/empty handling still needs empty UI but now with loading state, URL-canonical property weakened (slots transient, not in HTML for share/crawler), testability needs MSW/fetch mock, review budget similar but 2 states to test (loading+data+error). Serves no need when slots derive purely from URL — RSC already has all inputs.
- Verdict: **Rejected as primary.** Keep availability fetch server-side. Client island is only justified if T-042 later needs live auto-refresh (polling unavailable slots after T-043 booking) — out of scope and undesired for v1.

### Approach C — Slot UI variants (compares rendering/compound choices; orthogonal to A/B fetch)

All three assume Approach A fetch. Comparison is about how the slot set is presented and how selection is captured for T-043:

| Variant | Description | Pros | Cons | INV/Coupling |
|---|---|---|---|---|
| **C1: Button grid island (`AvailabilitySlots` compound) — RECOMMENDED** | Client compound `AvailabilitySlots` (or `AvailabilitySection`) reusing `DateSelector` pattern: `createContext` + `useSearchParams` + `router.push` preserving siblings. Renders `<fieldset role="radiogroup">` with `<button type="button" aria-pressed>` or `<input type="radio">` per `HH:mm`. `selectSlot(hhmm)` writes `?slot=HH:mm` (or `?time=`) alongside `serviceId/date/vehicleId`. Includes `EmptyState` (`"No availability for 2026-09-06 — closed or fully booked"`), `SelectedSlotBanner`. CSS `.slotGrid` (CSS grid 2-4 cols) + `.slotButton` + `.slotSelected` tokens. | Mirrors T-040/T-041 compound precedent `architecture-compound-components`, `architecture-avoid-boolean-props`; composition `<AvailabilitySlots><Grid/><Empty/><SelectedBanner/></>` no boolean sprawl; URL-canonical (refresh keeps slot), a11y (`radiogroup`+`radio`), testable with `userEvent.click` asserting `router.push` URL; feeds T-043 verbatim (T-043 reads `searchParams.slot` server-side). | Client JS required for selection (no-JS fallback needs `<a href="?slot=">` variant). Grid needs responsive tuning. | INV-05/01 stay server-side; INV-06 string `HH:mm` BA (from `formatSlotsAsHHmm`); INV-08 camelCase (`availableSlots`); review ~100 lines (compound + styles). |
| **C2: Native `<select>` dropdown** | Single `<select value={slot} onChange={e=>selectSlot(e.target.value)}>` with `<option>` per `HH:mm`, plus empty placeholder `— Pick a time —`. | Smallest CSS/JS, native keyboard/a11y, low review budget. | Weak affordance for scanning many slots (12+ options hidden), no grid scan, styling severely limited, harder to show disabled vs unavailable distinction (all options are available by construction — no disabled state needed, but grid better conveys "only available shown"). Precedent T-039/T-040 use cards/grid not selects. | Same invariants; a11y strong but UX weaker; **acceptable fallback but not preferred**. |
| **C3: Pure RSC link list (no client island)** | Each slot rendered as `<a href="?serviceId=&date=&slot=HH:mm">HH:mm</a>` — full navigation per selection, zero client JS. | Zero JS, progressive enhancement, server-authoritative. | Full navigation per click (loses `scroll:false` smoothness), can't preserve focus after selection without client, harder to show `aria-selected` state without JS context, diverges from `DateSelector` compound pattern (which uses `router.push` for date). `loading.tsx` skeleton would flash on each slot click due to full RSC re-render. | INV-safe but UX regress vs compound. **Rejected as primary**; could be offered as `noscript` fallback inside C1. |

**C verdict:** **C1 button grid compound** — aligns with `vercel-composition-patterns`, reuses `DateSelector` preservation logic, feeds T-043 with URL-canonical `?slot=`. Optionally include `<noscript>` `<a>` fallback for progressive enhancement. C2 is cheap but mismatched to card/grid precedent; C3 sacrifices interactivity.

## Recommendation

**Approach A (server-direct domain call) + C1 (button-grid compound) — pure RSC fetch with client selection island.**

**Why:**
- No new API, no new domain — reuses `T-025` service verbatim; RSC calls `getAvailableSlotsForDate` with `findActiveTurnosByDateRange` adapter (identical to `route.ts:96-97`), then `formatSlotsAsHHmm` → `string[]`.
- Preserves every invariant: `capacityPerSlot=1` + `slotStepMinutes=30` via `WorkshopConfig` DI (not hardcoded), `durationMinutes` from `selectedService` drives `fechaHoraFin <= finIntervaloOperativo` via `slotGenerator.calculateEndAndValidate`, `TIMESTAMPTZ` UTC / `America/Argentina/Buenos_Aires` via `baWallTimeToUtcDate`/`getBaDayUtcRange` noon anchor (no `toISOString` drift), `INV-03` auth via RSC `auth()` (already gated), `INV-08` only `string[] HH:mm` crosses to client.
- SSR canonical URL (`?serviceId=&date=`) means availability is in initial HTML — no flash, deep-link/share/refresh correct, BA derivation server-authoritative; tampered `?date=`/`?serviceId=` fall back to `null`/CTA (same as T-041) so T-042 never throws 500 and closed days naturally return `200 []` → EC-02 empty state.
- Fits review budget: `page.tsx` delta ~35-45 lines (conditional fetch + prop threading), `AvailabilitySlots.tsx` ~90-110 lines (compound + selection + sibling preservation + empty/selected banners), `appointments.module.css` ~45-60 lines (grid/button/empty tokens), tests ~80-110 lines. Total <320 lines, under 400 cap, consistent with `T-039→T-041` chain `feature-branch-chain` (no PR sprawl).
- Feeds T-043 cleanly: T-043 RSC will read `searchParams.slot` (or `?time=`) alongside `serviceId/date/vehicleId` and call `POST /api/appointments {vehicleId, serviceId, startDateTime: slotAsBAISO}` — availability island owns URL writes preserving siblings via `new URLSearchParams(searchParams.toString())`.

**Concrete shape for proposal to lock:**

```ts
// page.tsx additions (after T-041 validation)
export const dynamic = "force-dynamic"; export const revalidate = 0; // keep
// when selectedService && selectedDate:
const noon = new Date(`${selectedDate}T12:00:00.000Z`);
const rawSlots = await getAvailableSlotsForDate({
  date: noon, durationMinutes: selectedService.durationMinutes,
  config, fetchActiveTurnos: (r) => findActiveTurnosByDateRange(db, r),
});
const availableSlots = formatSlotsAsHHmm(rawSlots, config.timezone); // [] or ["09:00"...]

// render inside selectedService branch, below DateSelector:
{selectedDate ? (
  <AvailabilitySlots
    slots={availableSlots}        // string[] HH:mm BA
    date={selectedDate}
    serviceId={selectedService.id}
    vehicleId={vehicleId}
  >
    <AvailabilitySlots.Grid />
    <AvailabilitySlots.Empty />
    <AvailabilitySlots.SelectedBanner />
  </AvailabilitySlots>
) : (
  <p data-testid="availability-hint">Pick a date to see available times.</p>
)}
```

Client compound mirrors `DateSelector` preservation (`router.push(`${pathname}?${params}`, {scroll:false})`), `slotSchema = z.string().regex(/^\d{2}:\d{2}$/)` optional validation, `selectedSlot = searchParams.get("slot")` with `availableSlots.includes` guard.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **BA drift if client recomputes `date`** | High if naive | Slots computed for wrong BA day → mismatch `GET /api/availability` | RSC is source of truth — client reads `searchParams.get("date")` verbatim, never recomputes BA ymd with `new Date()`; noon sentinel `T12:00:00.000Z` matches route. |
| **Auth propagation to fetch (if HTTP path chosen)** | Med | 401 in client fetch if cookies not forwarded | Avoided by A — auth via RSC session, not fetch. If B ever used, use same-origin `fetch` with `credentials:"include"` and `headers: {cookie: await cookies().toString()}` on RSC. |
| **Closed-day `200 []` confused with error** | High | User sees blank grid, thinks bug | C1 `Empty` island distinguishes: closed (`closedDows.includes(getBaDow(date,tz))`) → "Closed on Saturdays — no slots" vs fully booked → "No availability for 2026-09-10 — try another date" (EC-02). |
| **Tampered `?serviceId=` inactive / non-UUID** | Med | Slot fetch with wrong `durationMinutes` → wrong filtering | RSC guard: `selectedService` null → CTA, no fetch; `getServiceById` active check already proven. |
| **Tampered `?date=` overflow/past/beyond-max** | High (URL hand-edit) | Calendar overflow `2026-02-30→2026-03-02` mismatch | RSC `dateSchema` + `getBaDayUtcRange` + `isPastBa` + `max` guard → `selectedDate=null` → hint, no slot fetch (no 500). |
| **`slotStepMinutes`/`capacityPerSlot` hardcode drift** | Med | Business changes `WorkshopConfig` without UI follow | RSC derives all from `getWorkshopConfig(db)`; never hardcode `09:00-12:00/14:00-18:00`, `30`, `1`. Patch `PATCH /api/admin/schedule` already reflects new intervals next request (no cache). |
| **N+1 or extra DB round-trip** | Low | Availability fetch adds latency | Single `findActiveTurnosByDateRange` bulk fetch per date (already batched); `Promise.all` not needed for slots (slots depends on date), but config+services parallel stays. No per-slot query. |
| **Review budget overrun if nested Suspense per slot** | Med | >400 lines | Keep single availability fetch in `page.tsx`, not per-slot `Suspense`; slot UI is sync client render of `string[]`, no `async` leaf. Loading skeleton is segment `loading.tsx` + optional inline `aria-busy` grid skeleton when `selectedDate` present but before RSC streams (Next.js Suspense fallback). |
| **Testability — RSC `db` mocking** | Med | Page tests brittle if real DB | `page.test.tsx` mocks `findActiveTurnosByDateRange` + domain (`getAvailableSlotsForDate` mocked to return `Slot[]`, asserted `formatSlotsAsHHmm` behavior unit-tested separately); integration test hits real DB for one closed/open/fully-booked case. |
| **Styling drift from `services.module.css`/`vehicles`** | Low | Inconsistent tokens | Reuse `globals.css` custom props `--color-* --space-* --radius-*`; slot grid extends `appointments.module.css` (no Tailwind, no inline styles). |

## Ready for Proposal

**Yes.** Scope is bounded (UI slice only, reuses `T-025` domain + `T-041` RSC/compound precedent), blocking questions are answered (`A+C1` is the proposal lock), invariants are non-negotiable and codified, review budget holds under 400 lines. No stakeholder clarification needed — proposal can lock route `src/app/(customer)/appointments/new/page.tsx` augmentation, new `AvailabilitySlots` compound decomposition, `appointments.module.css` extensions, and task breakdown for T-042.

### What the orchestrator should tell the user

> Exploration complete — recommendation is **RSC server-direct `getAvailableSlotsForDate` + `formatSlotsAsHHmm` + client button-grid compound `AvailabilitySlots`** reusing the `DateSelector` URL-canonical pattern, preserving `serviceId/date/vehicleId/slot` siblings for T-043. Closed-day, tampered date, duration/capacity filtering, and BA drift are all server-authoritative. Artifact saved hybrid (Engram + `openspec/changes/t042-show-availability/exploration.md`). Ready to advance to `sdd-propose` — no open questions.

## Skill Resolution

- `vercel-react-best-practices` — **APPLICABLE** — rules applied: `server-serialization` (only `string[] HH:mm` crosses), `server-parallel-fetching` (config+services parallel; slots sequenced after validation), `async-suspense-boundaries` (`loading.tsx`), `server-no-shared-module-state`, `rendering-hydration-no-flicker` (no `new Date()` in client render), `client-swr-dedup` deferred (no client fetch).
- `vercel-composition-patterns` — **APPLICABLE** — patterns applied: `architecture-compound-components` (`AvailabilitySlots.Grid/Empty/SelectedBanner`), `architecture-avoid-boolean-props` (composition over bag), `state-lift-state` + `state-context-interface` (slot selection context).
- `cognitive-doc-design` — **APPLICABLE** — progressive disclosure (scope→state→approaches→recommendation), decision tables, signposting, concise invariants callout.

---
*Evidence: `src/app/(customer)/appointments/new/page.tsx:45-196`, `src/app/(customer)/appointments/new/_components/DateSelector.tsx:1-390`, `src/app/api/availability/route.ts:24-124`, `src/services/availability/availabilityService.ts:57-157`, `src/services/availability/slotGenerator.ts:45-136`, `src/config/workshopConfig.ts:118-120`, `src/config/workshopSchedule.ts:68-106`, `src/db/repositories/turnos.ts:406-431`, `src/lib/validators/date.ts:1-221`, `src/lib/validators/service.ts:1-82`, `openspec/specs/date-selection/spec.md:1-75`, `openspec/changes/archive/2026-09-01-t041-date-selection/` (precedent), `Functional-Spec.md` F-03/CA-01/EC-02, `Technical-spec.md` §8.3/§4.4/§6.3.1/§10, `implementation-plan.md` T-025/T-041/T-042.*
