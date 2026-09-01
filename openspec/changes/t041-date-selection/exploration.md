# Exploration: t041-date-selection — Flujo de selección de fecha (H-25)

> FASE 8 UI-03 T-041 | Chain: T-025 (availability API) + T-040 (service-selection) → T-042 → T-043 → T-044

## Scope

**Goal:** El cliente debe poder seleccionar una fecha como paso 4 de FL-01 (Functional-Spec § FL-01 step 4, F-03). La selección de fecha es el parámetro `date` de `GET /api/availability?date=YYYY-MM-DD&serviceId=` (Technical-spec §8.3) y alimenta T-042 (mostrar disponibilidad) y T-043 (formulario reserva: vehículo+servicio+fecha+horario).

**In scope (T-041 only):**
- UI para elegir una fecha calendario (BA timezone `America/Argentina/Buenos_Aires`).
- Validación client + server de `date` (`YYYY-MM-DD`, no pasado, calendario válido, sin overflow `2026-02-30`).
- Persistencia URL-canonical `?date=YYYY-MM-DD` encadenada con `?serviceId=` (y futuro `?vehicleId=`), preservando deep-link/refresh/share.
- Auth guard (INV-03) — página dentro de `(customer)` hereda `layout.tsx` `auth() → redirect('/login')`.
- Paso de `durationMinutes` implícito vía `serviceId` (no recalcular `fechaHoraFin` client-side, INV-05).

**Out of scope (deferred):**
- T-042: fetch y render de `availableSlots` (`GET /api/availability`), filtrado `fechaHoraFin <= finIntervaloOperativo`, capacity `count < capacityPerSlot`, estados `PENDIENTE|CONFIRMADO`.
- T-043/T-044: formulario completo y resultado de reserva.

## Current State

### Dependencies VERIFIED DONE

| Dependency | Evidence | Status |
|---|---|---|
| **T-025 `GET /api/availability?date=&serviceId=`** | `src/app/api/availability/route.ts:24-124` — strict `z.object({date: /^\d{4}-\d{2}-\d{2}$/, serviceId: uuid}).strict()`, `requireAuth` (401/403), `getWorkshopConfig(db)` per-request (no cache, T-036b), `getBaDayUtcRange(dateStr, config.timezone)` + noon overflow check (`2026-02-30→rejected`), `getServiceById` + `dto.active` guard (→ `INVALID_SERVICE`), `getAvailableSlotsForDate({date: noonDate, durationMinutes, config, fetchActiveTurnos})` → `formatSlotsAsHHmm(slots, config.timezone)` → `{date, availableSlots}` | **DONE — API ready to consume** |
| **Availability domain** | `src/services/availability/availabilityService.ts:57-157` (`getBaDayUtcRange` DST-aware via `baWallTimeToUtcDate`, `getAvailableSlots` pure core, `getAvailableSlotsForDate` single bulk fetch), `src/services/availability/slotGenerator.ts` (`baWallTimeToUtcDate` Intl offset delta, `generateSlotsForDate` step `slotStepMinutes=30`, `calculateEndAndValidate` → filter `fechaHoraFin <= finIntervalo`), `src/config/workshopSchedule.ts` (`getOperatingIntervalsForDate` DOW via BA `en-CA` formatter, `DEFAULT_OPERATING_INTERVALS 09:00-12:00/14:00-18:00` Mon-Fri fallback, Sat/Sun `[]`), `src/config/workshopConfig.ts` (`getWorkshopConfig(db)` DI, `WORKSHOP_TIMEZONE = America/Argentina/Buenos_Aires`, `capacityPerSlot=1`, `slotStepMinutes=30`) | **DONE — no new domain needed** |
| **T-040 service-selection** | `src/app/(customer)/services/page.tsx:41-99` RSC shell (`auth()`→`listServices(db,{includeInactive:false})`→`toJson(Date→ISO)`→`ServiceSelector`), `_components/ServiceSelector.tsx` compound (`useSearchParams`+`router.push(?serviceId=)`, `serviceIdSchema.safeParse`+`active` guard), `ServiceList/Card/SelectedBanner`, `services.module.css`, `lib/validators/service.ts` (`serviceIdSchema`, `formatDuration`), `lib/api/services.ts` thin helper | **DONE — pattern to replicate** |
| **T-039 vehicle-screen** | `src/app/(customer)/vehicles/page.tsx` RSC shell + `VehicleProvider` compound, `lib/validators/vehicle.ts`, `vehicles.module.css`, `loading.tsx`/`error.tsx`, `(customer)/layout.tsx:40-42` shared auth guard + nav | **DONE — golden precedent** |
| **Auth (INV-03)** | `middleware.ts` (`jose` verify on `/api/:path*`, whitelist `POST /api/auth/*` + `GET /api/services`), `src/lib/auth/requireAuth.ts` + `src/lib/auth/auth.ts` (NextAuth 5 JWT httpOnly), `(customer)/layout.tsx` RSC `auth()` redirect | **DONE** |
| **No date UI exists** | `Glob src/app/**/(customer)/*` → only `services/` + `vehicles/`; `Glob src/lib/**date*` → zero; `src/lib/validators/service.ts` has no date schema | **Greenfield for date** |

### How date currently flows (without T-041)

```
User selects service → ?serviceId=<uuid> in URL (T-040)
        ↓
/appointments/new?serviceId=<uuid> (SelectedBanner continueHref)
        ↓
T-042 will need: GET /api/availability?date=YYYY-MM-DD&serviceId=<uuid>
        ↑
     MISSING: ?date= has no producer — T-041 fills this gap
```

Server already validates `date` strictly; UI has no way to produce a valid `YYYY-MM-DD`.

## Questions to Answer (from brief)

### 1. Open decisions — calendar widget vs native input vs custom grid, min/max, past-date blocking (RN-05), weekends/holidays, timezone (INV-06)

| Decision | Options | Analysis |
|---|---|---|
| **Widget choice** | (A) Native `<input type="date">` (B) Custom grid calendar (C) Headless lib (`react-day-picker`) | **A: native** — zero deps (current `package.json` has no date lib), built-in `min`/`max`, a11y, mobile pickers, keyboard, locale-aware. Con: styling limited, browser variance. **B: custom grid** — full styling control, can disable closed days visually, but must reimplement keyboard, ARIA `grid`, `aria-selected`, focus management, month navigation — review budget ~400 lines exceeded easily (T-039 `vehicles.module.css` is 0 Tailwind, CSS Modules only). **C: lib** — adds bundle + dep, not in stack, no prior precedent (T-039/T-040 use CSS Modules, no headless UI). **Verdict: A native input + lightweight CSS wrapper** is lowest risk for T-041; custom grid is deferred to polish if UX demands it — proposal locks native. |
| **Min date (past blocking)** | `min = today BA` vs `min = tomorrow BA` | RN-05: `now < fechaHoraInicio` allows today if future slot remains (e.g. now 08:00, slot 09:00 today is valid). Blocking today entirely would be over-restrictive. Server `getBaDayUtcRange` + `generateSlotsForDate` already returns future slots only — past slots today are filtered by `isSlotAvailable` indirectly but not blocked at date level. **UI should set `min = today BA`** (derived via `Intl.DateTimeFormat` with `WORKSHOP_TIMEZONE`, not `new Date().toISOString().slice(0,10)` which is UTC). Explicitly document `min` is today, not tomorrow. |
| **Max date** | No spec max; options: none / +60d / +90d / configurable | No `WorkshopConfig.maxAdvanceDays` exists. Technical-spec §7 says intervals parametrizable but not horizon. **Proposal: `max = today + 60 days` (BA)** as sensible default, documented as `DATE_SELECTION_MAX_DAYS = 60` constant in `src/lib/validators/date.ts` (not WorkshopConfig yet). Rationale: prevents far-future abuse, keeps `GET /api/availability` load predictable, matches typical booking windows. Future `WorkshopConfig.maxAdvanceDays` can override without UI change. If no max, leave `max` prop undefined. |
| **Weekends / holidays** | Disable Sat/Sun? Disable holidays? | `getOperatingIntervalsForDate` returns `[]` for Sat/Sun (defaults) → `generateSlotsForDate` returns `[]` → availability empty. Patch `PATCH /api/admin/schedule` can set any `dayOfWeek` to `[]` (closed). **UI should disable dates where `operatingHours[dow]` is empty** (closed). But that requires knowing `WeeklySchedule` client-side. Options: (a) fetch `GET /api/admin/schedule` or `GET /api/workshop-config` client-side, (b) derive closed days from `getWorkshopConfig` server-side and pass `closedDows: number[]` to client, (c) defer to T-042 (show "No availability" after selection). **Proposal: (b) — RSC passes `closedDows` (e.g. `[0,6]` for Sat/Sun) derived server-side from `getWorkshopConfig(db).operatingHours`**. No extra fetch. Holidays not in spec → no holiday blocking in T-041 (could be future `WorkshopConfig.holidays`). Document as out-of-scope. |
| **Timezone (INV-06)** | How to compute `today` / `min` / `max` without drift | DB `TIMESTAMPTZ` UTC; API `date` is `YYYY-MM-DD` BA calendar day. Server converts via `baWallTimeToUtcDate(baYmd, "00:00", timezone)` + DST-aware `getBaDayUtcRange`. **Client MUST NOT use `new Date().toISOString().slice(0,10)` (UTC date, off by 1 day for BA evenings)**. Must derive BA ymd via `Intl.DateTimeFormat("en-CA", {timeZone: WORKSHOP_TIMEZONE})`. Extract helper `getTodayBaYmd(timezone)` pure, tested. `min`/`max` attrs and validation use that BA ymd. Server re-validates with same logic, so client drift is caught. |

### 2. Dependencies — how date chains with availability and service

```
T-025 API exists ✅ — strict querySchema, BA DST range, overflow check, active guard.
T-040 feed: ?serviceId=<uuid> + durationMinutes implicit
        ↓
T-041 produces: ?date=YYYY-MM-DD (BA ymd, regex /^\d{4}-\d{2}-\d{2}$/)
        ↓
Canonical URL: /appointments/new?serviceId=<uuid>&date=YYYY-MM-DD
               └ also preserves ?vehicleId= when that step exists (future T-043)
               └ order irrelevant; URLSearchParams canonical
        ↓
T-042 consumes: GET /api/availability?date=&serviceId=
                → {date, availableSlots: ["09:00", ...]}
                → filtered by durationMinutes + capacityPerSlot (v1=1)
T-043 consumes: vehicleId + serviceId + date + slot → POST /api/appointments
```

**Key chain invariant:** `serviceId` must be present before date selection is meaningful (duration drives slot validity). Date page should require `serviceId` (if missing, redirect or show "Select a service first" CTA to `/services`). `vehicleId` not required at T-041 (T-043 will enforce).

**No new DB or API needed for T-041** — purely UI + URL state. The date value flows as string `YYYY-MM-DD` (INV-08: API `date` is camelCase string, not `startDateTime`).

### 3. Influence of T-040/T-039 patterns — RSC shell + URL-canonical islands

**Must reproduce:**
- **RSC shell** `src/app/(customer)/appointments/new/page.tsx` (or `src/app/(customer)/booking/page.tsx` — route decision below) — `auth()` guard, `getWorkshopConfig(db)` for `closedDows` + `timezone`, `listServices` to validate `serviceId`, `searchParams` validation (`serviceIdSchema` + `dateSchema`), `Date→ISO` not needed for date (string only), `export const dynamic="force-dynamic"` + `revalidate=0`.
- **URL-canonical islands** — compound `DateSelector` reading `useSearchParams().get("date")` + `useSearchParams().get("serviceId")`, writing via `router.push(?serviceId=&date=)` with preservation of sibling params (`vehicleId` etc.) via `new URLSearchParams(searchParams.toString())`.
- **Server serialization** — only primitives cross boundary: `serviceId: string|null`, `date: string|null`, `closedDows: number[]`, `minDate: string` (BA today), `maxDate: string` (BA today+60), `timezone: string`. No `Date` objects.
- **Compound + explicit variants** — `<DateSelector><DateSelector.Input /><DateSelector.SelectedBanner /></DateSelector>` avoiding boolean props, `architecture-compound-components`.
- **CSS Modules** — `src/app/(customer)/appointments/appointments.module.css` (or `booking.module.css`) reusing tokens `--color-* --space-* --radius-*`, semantic `.input`, `.inputInvalid`, `.banner`, `.empty`.
- **loading.tsx / error.tsx** — file-convention Suspense skeleton + error boundary (`unauthorized→/login`, validation → banner).
- **Validation split** — client pure Zod `dateSchema` in `src/lib/validators/date.ts` (no `server-only`), server re-validates same regex + overflow via `getBaDayUtcRange`.
- **No Server Actions** — selection is URL write, not POST; no `revalidatePath` needed.

**Divergence from T-040:** services needed no `date` context; date needs `serviceId` context to be useful. So date page validates `serviceId` first.

### 4. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **UTC vs BA date drift** — client uses UTC `toISOString` for `min`/validation | High if naive | Past dates selectable, server rejects with 400, UX confusion | Pure helper `getTodayBaYmd(timezone)` via `Intl.DateTimeFormat("en-CA", {timeZone})`; never `new Date().toISOString().slice(0,10)` |
| **Tampered `?date=` (garbage, overflow, past)** | High (URL manual edit) | 500 or silent broken banner | RSC validates with `dateSchema.safeParse` + `getBaDayUtcRange` overflow check; tampered falls back to `null` (no selection) with inline banner "Invalid date", same as T-040 `?serviceId=` fallback |
| **Closed-day UX** — user picks Saturday, T-042 shows empty, feels like bug | Med | Confusion | RSC passes `closedDows`; client sets `disabled` logic or helper text "Weekends closed — next available is Monday"; alternatively rely on T-042 empty state but document |
| **Missing `?serviceId=`** | Med | Date without service has no availability | Guard: if `!serviceId` or inactive, render "Select a service first" link to `/services` instead of date input; do not allow date selection orphaned |
| **Capacity/duration leak — date allows date that has zero slots for that service duration** | Low for T-041 (deferred) | User picks valid date but T-042 shows "No availability" | Accept as correct — T-041 only gates calendar validity, not slot existence; T-042 is owner of `fechaHoraFin <= finIntervalo` + `capacityPerSlot` filtering. Document boundary. |
| **Auth bypass** — page outside `(customer)` | Low | Unauth sees booking UI | Place route inside `(customer)` group so `layout.tsx` guard applies; no standalone `/appointments/new` outside group |
| **`maxDate` overfetch** — no horizon allows far-future `GET /api/availability` spam | Low | DB load | `max` attr limits picker; server also validates `date` within horizon if policy added later (future `WorkshopConfig.maxAdvanceDays`) |
| **Styling drift second UI** — new `appointments.module.css` diverges from `services.module.css` | Med | Inconsistent tokens | Reuse `globals.css` custom properties; extract shared `_components/ui` if duplication >30 lines |

### 5. Recommended Approach (ratifiable, feeds T-042)

#### Approach A — RSC server-direct + URL-canonical native date island (RECOMMENDED)

**Route:** `src/app/(customer)/appointments/new/page.tsx` (canonical booking entry). Alias: `/services` remains catalog; `/appointments/new` is the booking flow. `layout.tsx` guard inherited. Alternative considered: `src/app/(customer)/booking/page.tsx` — decision locked as `appointments/new` to match `POST /api/appointments` resource naming and T-040 `continueHref`.

**RSC shell (`page.tsx`):**
```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
auth() → redirect('/login') if null
config = await getWorkshopConfig(db)  // for timezone + operatingHours → closedDows
services = await listServices(db,{includeInactive:false})
selectedService = services.find(s.id===searchParams.serviceId && active) ?? null
// Validate ?date=
dateCandidate = searchParams.date
dateValid = dateSchema.safeParse(dateCandidate).success
           && !isPastBa(dateCandidate, getTodayBaYmd(config.timezone))
           && isValidCalendarDate(dateCandidate) // overflow via getBaDayUtcRange
selectedDate = dateValid ? dateCandidate : null
closedDows = deriveClosedDows(config) // e.g. [0,6] if Sat/Sun empty
minDate = getTodayBaYmd(config.timezone)
maxDate = addBaDays(minDate, 60, config.timezone)
return <DateSelector serviceId={selectedService?.id ?? null} date={selectedDate}
                     minDate={minDate} maxDate={maxDate}
                     closedDows={closedDows} timezone={config.timezone} />
```

**Client compound (`_components/DateSelector.tsx`):**
- `"use client"`, `createContext` + `use()` (React 19), `useSearchParams` + `useRouter`.
- `dateSchema` from `src/lib/validators/date.ts` (pure Zod `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` + `superRefine` overflow via `new Date(ymd+"T12:00:00.000Z")` iso round-trip).
- `selectDate(ymd)` → `const p = new URLSearchParams(searchParams.toString()); p.set("date", ymd); router.push("?"+p.toString(), {scroll:false})`. Preserves `serviceId`/`vehicleId`.
- Renders `<input type="date" value={selectedDate ?? ""} min={minDate} max={maxDate} onChange={e=>selectDate(e.target.value)} />` + helper text + `SelectedBanner` (shows `Selected: <service> on <date>` + Continue link to `/appointments/new?serviceId=&date=` that T-042 will read, or to availability step).
- Closed-day guard: if `closedDows.includes(getBaDow(ymd, timezone))` show inline warning (optional, non-blocking).

**Validation module (`src/lib/validators/date.ts`):**
- `dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` + `superRefine` calendar validity.
- `getTodayBaYmd(timezone)` + `addBaDays(ymd, n, timezone)` + `isPastBa(ymd, todayYmd)` + `formatBaDate(ymd)` pure helpers.
- No `server-only`; safe for client bundle.

**Styling:** `appointments.module.css` with `.pageHeader`, `.input`, `.inputInvalid`, `.hint`, `.banner`, reusing tokens.

**Tests:** `page.test.tsx` (RSC shell: null session→redirect, tampered `?date=` fallback, `?serviceId=` missing→CTA, Date→BA not UTC), `_components/DateSelector.test.tsx` (jsdom: valid selection pushes URL, tampered fallback, min/max attrs, closed-day hint).

- Pros: SSR FCP, no extra fetch, URL deep-link/refresh/share, auth server, DST-correct, reuse T-040 precedent verbatim, feeds T-042 without coupling, review <400 lines (RSC ~80 + DateSelector ~100 + validators ~40 + CSS ~60 + tests).
- Cons: Requires `Intl` BA helper (already proven in `slotGenerator.ts`); native input styling variance; two-step mental model RSC+island (already accepted).
- Effort: **Medium** — establishes booking flow shell for T-042-T-044 chain.

#### Approach B — Full client fetch SPA (`"use client"` page with `useEffect` + `useState`)

- Entire `page.tsx` is `"use client"`; `useEffect` fetches `GET /api/workshop-config` for `minDate`, selection kept in `useState<string|null>` + `localStorage`.
- Pros: Simplest mental model, no RSC boundary.
- Cons: Anti-pattern per `vercel-react-best-practices` (`client-swr-dedup` missed, waterfall, no SSR, extra round-trip, `localStorage` lost on refresh, not deep-linkable, duplicates server validation, violates `server-serialization`/`server-parallel-fetching`). Breaks T-042 contract which expects `?date=` in URL. **REJECTED.**

#### Approach C — Server Actions (`"use server"` date handler)

- Catalog RSC + form POST to Server Action `selectDate(formData)` that validates `date` then `redirect('/appointments/new?serviceId=&date=')`.
- Pros: No JS required, server validation before navigation, progressive enhancement.
- Cons: Bypasses URL as instant source of truth, full POST vs instant `onChange`, harder to show inline `min`/`max` feedback, testing Server Actions needs experimental utils, adds indirection for read-only selection that URL already solves. **REJECTED** — only justified if JS-disabled resilience required (not in spec).

## Recommendation

**Approach A** — RSC `src/app/(customer)/appointments/new/page.tsx` + native `<input type="date">` island `DateSelector` with URL-canonical `?date=YYYY-MM-DD` + `?serviceId=` preservation, BA-timezone helpers, `closedDows` from `getWorkshopConfig`, pure `src/lib/validators/date.ts`.

**Why this feeds T-042:** T-042 reads `searchParams.date` + `searchParams.serviceId` server-side, validates same `dateSchema`, calls `GET /api/availability?date=&serviceId=` (or direct `getAvailableSlotsForDate`) and renders `availableSlots`. No prop drilling, no context expiry. Auth already resolved.

## Affected Areas

- `src/app/(customer)/appointments/new/page.tsx` — **new** RSC shell (canonical booking route, auth guard, `getWorkshopConfig`+`listServices`+`searchParams` validation, `Date→BA` helpers, `dynamic="force-dynamic"`).
- `src/app/(customer)/appointments/new/_components/DateSelector.tsx` — **new** client compound (`useSearchParams`+`router.push` preserving siblings, native date input, `min`/`max` BA, closed-day hint, `SelectedBanner` CTA to T-042).
- `src/lib/validators/date.ts` — **new** pure Zod `dateSchema` + `getTodayBaYmd`/`addBaDays`/`isPastBa` helpers (no `server-only`).
- `src/app/(customer)/appointments/new/appointments.module.css` — **new** CSS Module (tokens reuse, `.input`, `.banner`).
- `src/app/(customer)/appointments/new/loading.tsx` + `error.tsx` — **new** Suspense skeleton + error boundary (same as `services/loading.tsx`).
- `src/app/(customer)/layout.tsx` — **modified** only to add nav link `Book` → `/appointments/new` or `Appointments` if booking entry top-level; else no change.
- `src/config/workshopSchedule.ts` / `src/config/workshopConfig.ts` / `src/services/availability/*` — **read-only** but constraining (timezone, operatingHours, `getBaDayUtcRange`).
- `src/app/(customer)/services/_components/SelectedBanner.tsx` — **read-only**; `continueHref` `/appointments/new?serviceId=` already anticipates date step — verify preservation of `?date=` after T-041.
- `vitest.config.ts` — **no change** (existing jsdom project already includes `src/**/_components/**/*.test.tsx`).

## Risks (summary for proposal gate)

- BA vs UTC drift — mitigated by `Intl` BA helpers, not `toISOString`.
- Tampered `?date=` / `?serviceId=` — mitigated by `safeParse`+`find(active)` fallback to null (no 500).
- Closed-day confusion — mitigated by `closedDows` hint; slot-empty is T-042 ownership.
- Missing `serviceId` — mitigated by CTA to `/services`.
- Review budget — A stays <400 lines; B/C exceed or add debt.

## Ready for Proposal

**Yes.** Scope bounded, dependencies done (T-025 API + T-040 UI + T-036b workshop config), blocking decisions resolved (native input, `min=today BA`, `max=+60d`, `closedDows` via RSC, BA `Intl` helpers, route `appointments/new`). No clarification needed from stakeholders; proposal can lock route, component decomposition, and task breakdown for T-041 PR.

## Skill Resolution

- `vercel-react-best-practices` — **loaded via precedent, APPLICABLE** — rules applied: `server-serialization` (string date only), `server-no-shared-module-state`, `async-suspense-boundaries` (`loading.tsx`), `server-parallel-fetching` (RSC direct `getWorkshopConfig`+`listServices`), `rendering-hydration-no-flicker` (no `new Date()` in client render, BA helpers), `client-swr-dedup` deferred (no client fetch for date).
- `vercel-composition-patterns` — **loaded via precedent, APPLICABLE** — patterns applied: `architecture-compound-components` (`DateSelector.Input/Banner`), `architecture-avoid-boolean-props`, `state-lift-state` + `state-context-interface` (optional context), `patterns-children-over-render-props`.
- `cognitive-doc-design` — **loaded, APPLICABLE** — progressive disclosure (scope→decisions→recommendation), chunking, signposting, tables over prose.

---
*Evidence: `src/app/api/availability/route.ts:24-124`, `src/services/availability/availabilityService.ts:57-157`, `src/services/availability/slotGenerator.ts:42-136`, `src/config/workshopSchedule.ts` (`getBaDayUtcRange`, `getOperatingIntervalsForDate`, `DEFAULT_OPERATING_INTERVALS`), `src/config/workshopConfig.ts:118-120`, `src/app/(customer)/services/page.tsx:41-99`, `src/app/(customer)/services/_components/ServiceSelector.tsx:70-118`, `src/app/(customer)/vehicles/page.tsx:64-105`, `src/app/(customer)/layout.tsx:40-42`, `middleware.ts`, `package.json` (no date lib), `Functional-Spec.md` FL-01 step 4 / F-03 / RN-05 / CA-01, `Technical-spec.md` §8.3 / §8.5 / §7 / INV-01..08, `implementation-plan.md` T-025/T-040/T-041..T-044.*
