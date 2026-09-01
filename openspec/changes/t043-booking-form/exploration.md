# Exploration: T-043 Crear formulario de reserva

## 1. Current State

### RSC shell — `src/app/(customer)/appointments/new/page.tsx:31-261`
RSC `force-dynamic` (`:59-60`). Flow: `auth()` → `redirect("/login")` (INV-03) → `Promise.all([getWorkshopConfig(db), listServices(db,{includeInactive:false})])` (:99-102) → `serviceIdSchema.safeParse` + `services.some(active)` → `selectedService` (:106-115) → `dateSchema.safeParse` + `isPastBa` + `addBaDays(60)` + `getBaDayUtcRange` overflow → `selectedDate` (:118-140) → `deriveClosedDows` from `config.operatingHours` (:78-87) → CTA branch when `!selectedService` (:147-173) → `vehicleId = params.vehicleId` preserved but **not consumed** (:175-176) → conditional `getAvailableSlotsForDate({date: noonDate, durationMinutes, config, fetchActiveTurnos})` + `formatSlotsAsHHmm(slots, tz)` only when `selectedService && selectedDate` (:185-205) → renders `DateSelector` (:224-236) and `AvailabilitySlots` (:243-258) compounds. Both islands own URL writes via `useSearchParams`+`router.push({scroll:false})` with sibling preservation. `?slot=` not yet validated on page but validated inside island.

### Compounds — established pattern (T-040/T-041/T-042)

* `src/app/(customer)/services/_components/ServiceSelector.tsx:1-134` — canonical: `createContext` + `use(ctx)` (React 19) + `useSearchParams().get` + `serviceIdSchema.safeParse` + `services.some(active)` defense-in-depth + `useMemo(selected)` + `useCallback(router.push(?serviceId=))` + `SelectedBanner` guard. Boundary: `ServiceDTOJson[]` (`:29-37` in `lib/api/services.ts` — camelCase + ISO strings, INV-08).
* `src/app/(customer)/appointments/new/_components/DateSelector.tsx:1-390` — `resolveDate()` (:103-114) mirrors RSC checks; `getBaDow()` noon-UTC + `Intl.DateTimeFormat("en-US",{timeZone,weekday})` (:120-134); `selectDate()` preserves siblings via `new URLSearchParams(searchParams.toString())` (:196-212); `key={date}` re-mount trick (:279). Props are primitives only (INV-08).
* `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx:1-315` — `slotSchema.safeParse` + `slots.includes` (:142-147) → `selectedSlot`; `selectSlot()` same sibling pattern (:149-165); `Grid` as `radiogroup/radio` `aria-checked` (:202-241); `Empty` distinguishes closed vs booked via `getBaDow`+`closedDows.includes` (:248-268). Only `string[]` HH:mm crosses (INV-06).
* `loading.tsx:1-48` / `error.tsx:1-92` — segment boundaries: shimmer `aria-busy` and `classify(unauthorized|other)` + `router.push("/login")` or `reset()`.

### Vehicle domain already exists

* `src/app/(customer)/vehicles/page.tsx:64-105` — RSC shell: `auth()` → `session.user.id` as `customerId` (INV-03, never from URL) → `maxYear=currentYear+1` (hydration-safe) → `listVehiclesByCustomer(db,customerId)` server-direct (no HTTP hop, design D1) → `toJson(dto)` → `VehicleDTOJson[]` (:51-62) → `VehicleProvider` compound.
* `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:1-100` — CRUD compound (mutation-owned): `createVehicle` via `POST /api/customers/{customerId}/vehicles` (`:69`), state `vehicles/useState(initial)+useEffect reconcile`, `isPending/error` banner kinds, throws `ApiError` for `400/409` field mapping.
* `VehicleList.tsx:18-32` / `VehicleForm.tsx:41-137` — presentation details; plate `normalizePatente` dual-defense.
* `src/services/vehicleService.ts:1-117` — `vehicleCreateInputSchema` (English camelCase, `customerId: uuid`, plate `transform(normalizePatente).pipe(regex 6-7)`, year 1900..nextYear) (:25-47); `listVehiclesByCustomer`, `getVehicleById`, `findVehicleByPlate` (normalize idempotent).
* `src/db/mappers/vehiculo.ts:1-31` — `VehiculoDTO` fully English: `clienteId→customerId`, `marca→brand`, `modelo→model`, `anio→year`, `patente→plate`, `createdAt/updatedAt: Date` (INV-08).
* `src/lib/api/vehicles.ts:1-112` + `src/lib/api/services.ts:1-116` — client helpers: `fetch(…,{credentials:"include",cache:"no-store"})`, `isErrorBody` envelope `{error:{code,message,issues}}` (Technical-spec §12, `lib/http/errors.ts:10-42`), `ApiError` throw on non-2xx, `VehicleDTOJson` shape with ISO strings.

### Booking contract

* `src/app/api/appointments/route.ts:26-116` — `POST /api/appointments` `bodySchema` `vehicleId:uuid + serviceId:uuid + startDateTime: regex ISO-with-TZ → transform Date` (`:30-40`, INV-06 `Z|[+-]HH:MM`); order: `requireAuth` (401) → `req.json()` → `Zod parse` → `getWorkshopConfig(db)` per-request DI → `createAppointment({db,config},{vehicleId,serviceId,startDateTime,authUser})` → `201 TurnoDTO` or `409 APPOINTMENT_NOT_AVAILABLE` / `400 INVALID_SERVICE` / `403 FORBIDDEN` / `400 VALIDATION_ERROR` envelope (`lib/http/errors.ts:58-69`).
* `src/services/appointmentService.ts:69-152` — `createAppointment` atomic: `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` → ownership `findVehiculoById` + `assertOwnership(customerId, authUser)` → `findServicioById` + `active` guard (`InvalidServiceError`) → `calculateEndAndValidate` (`start+duration`, `end <= finIntervaloOperativo`) → `countActiveOverlappingForUpdate(tx,{fromUtc: start, toUtc: end})` (`tstzrange && WHERE estado IN (PENDIENTE,CONFIRMADO) FOR UPDATE`) + `capacityPerSlot` check → `turnoInputSchema.parse` → `INSERT … RETURNING → toTurnoDTO`. Catches `23505` exclusion violation → `AppointmentNotAvailableError`.
* `src/services/availability/slotGenerator.ts:45-96` — `baWallTimeToUtcDate(baYmd, hhmm, tz)` via `Intl.DateTimeFormat` offset-delta (handles DST), `formatSlotsAsHHmm(slots,tz)` via `Intl en-GB {timeZone}`.
* `src/lib/validators/date.ts:60-221` — `dateSchema` regex + noon round-trip, `getTodayBaYmd(tz)` `Intl en-CA`, `addBaDays` noon anchor, `getBaDayUtcRange` via `baWallTimeToUtcDate`, DST-safe.

### Invariants relevant

* INV-01 capacity 1 count-based `tstzrange &&` (AGENTS.md:10, Technical-spec §6.4/§10).
* INV-03 Auth.js JWT httpOnly, `vehiculo.clienteId==authUser.id`, `POST /api/appointments` requires `requireAuth` (Functional-spec §6.3).
* INV-06 DB TIMESTAMPTZ UTC, API ISO8601 with TZ, `WorkshopConfig.timezone=America/Argentina/Buenos_Aires`, never naive TIMESTAMP.
* INV-08 DB snake/ES → API camel/EN mappers mandatory (`vehiculo.ts:20-30`).
* INV-05 slotStep 30 filtered by `durationMinutes`, `fechaHoraFin <= finIntervaloOperativo`.

---

## 2. Approaches Compared

| Approach | Description | Pros | Cons | Alignment | Effort |
|----------|-------------|------|------|-----------|--------|
| **(a) VehicleSelector + BookingForm (fetch)** — RECOMMENDED | RSC `listVehiclesByCustomer(db,authId)` → `VehicleDTOJson[]` → client `VehicleSelector` compound (read/write `?vehicleId=` like ServiceSelector, `useSearchParams+router.push`, `vehicleIdSchema`+`vehicles.some` guard). Separate `BookingForm/SubmitSection` compound: derives `startDateTime` from `?date+?slot`, `POST /api/appointments` via `fetch({credentials:"include"})`, parses `lib/http/errors` envelope, inline banners for 409/403/400/401, `pending` disable, calls `router.push` to T-044 on 201. Summary card as third island or inside SubmitSection. | Mirrors T-040/T-041/T-042 exactly (URL-canonical, no SWR, no Server Actions, no form post). INV-03 ownership stays server (server re-checks). INV-08 `VehicleDTOJson` already established. Deep-link/share/refresh free. Test surface matches existing compound tests. | One extra RSC query (`listVehiclesByCustomer`) — parallel with config+services, no waterfall. | Perfect — same `createContext+use+URLSearchParams` lineage. Canonical `?serviceId=&date=&slot=&vehicleId=` ready for T-044. | Low/Med — ~105 VehicleSelector + ~90 BookingForm + ~25 Summary + page wiring + CSS |
| (b) Same selector + plain `<form action="/api/appointments" method="post">` | Selector as (a) but submit is native form POST. | Zero JS for submit. | Breaks established SPA pattern: full navigation, loses `scroll:false`, leaks `clienteId` handling, file-style form cannot preserve `searchParams` siblings cleanly, needs CSRF consideration, bypasses `credentials:include` JSON envelope handling, mixes `application/x-www-form-urlencoded` with JSON contract (`route.ts:58 bodySchema` expects JSON). Requires route to accept form data or redirect dance. Violates D1 JSON contract. | Poor — diverges from T-040/T-041/T-042 `router.push` idiom. | Low but wrong abstraction |
| (c) Same selector + Server Action | Submit calls `createAppointment` directly via Server Action instead of `fetch POST`. | Colocates DB call, skips HTTP round-trip. | Server Actions are Next.js-specific, couple UI to server module, bypass the tested `route.ts:42-116` JSON contract and its envelope (`ERROR_CODES.APPOINTMENT_NOT_AVAILABLE` etc.). Auth via action context vs `requireAuth(req)` diverges. Harder to assert T-044 URL-canonical result (action redirect vs API JSON). INV-03/INV-08 still enforced but via different path — doubles validation surface. Testing needs action mock vs fetch mock (less reuse of `lib/http/errors` helpers). | Medium — sane but splits source of truth (route vs action). | Med — action wiring + duplicate error mapping |
| (d) Reuse `VehicleProvider` directly on `/appointments/new` | Import `VehicleProvider` (with `VehicleList`+`VehicleForm`) onto booking page. | Reuses CRUD UI verbatim. | `VehicleProvider` owns mutation state (`isPending`, `createVehicle`, `vehicles/useState`, `router.refresh`) and renders a creation form — heavy for a pure **selection** task. Its `VehicleList` has no selection semantics (no `?vehicleId=` URL write, no `selectedId` guard, no `includes` check). Pulls creation concerns (plate validation, 409 plate-taken) into booking flow. Couples booking page to vehicles CRUD lifecycle and its local `vehicles` state vs RSC `VehicleDTOJson[]`. | Low — selection ≠ management; confuses responsibilities. | Med/High — would still need a selector wrapper around it |

**Recommendation: (a)**. It is the only option that preserves the invariant chain: RSC server-direct list (no internal HTTP hop per `vehicles/page.tsx:74-76` D1) → `VehicleDTOJson[]` primitives across boundary (INV-08) → client compound validating `?vehicleId=` with `uuid + vehicles.some` (defense in depth, mirrors `ServiceSelector.tsx:83-91`) → URL-canonical state for T-044 to read. Submit via `fetch POST /api/appointments` reuses the already-tested `route.ts:30-40` strict JSON contract and `lib/http/errors.ts` envelope, keeping auth/ownership/capacity checks single-sourced in `appointmentService.ts:84-138`. (b) breaks JSON contract; (c) forks it; (d) overloads selection with CRUD.

---

## 3. Technical Decisions

### Vehicle DTO vs JSON shape
**Decision: `VehicleDTOJson[]` from RSC, mirror `ServiceSelector`.**
Page already does `dtos.map(toJson)` for services (`page.tsx:104,263-273`). Do identical `VehiculoDTO → VehicleDTOJson` mapping (use `vehicles/page.tsx:51-62` `toJson` verbatim). No SWR/fetch inside island — island stays synchronous, derives `selectedId` from `searchParams.get("vehicleId")` + `uuid` + `some`. This keeps `server-only` out of the client bundle and matches `AvailabilitySlots`/`DateSelector` "only primitives cross" rule. `lib/api/vehicles.ts` stays mutation-only (POST create), not list.

### TZ reconstruction of `startDateTime`
**BA offset: `-03:00` fixed since 2009-12 (Law 26.474 abolished DST; IANA tzdb `America/Argentina/Buenos_Aires` has no DST transitions since 2009-10-18). Assumption verified — `Intl.DateTimeFormat` with `timeZone: America/Argentina/Buenos_Aires` in repo already returns `-03:00` year-round.**

Recommended client snippet (inline in `BookingForm`, no new dep):

```ts
// date = "2026-09-10" (YYYY-MM-DD), slot = "09:30" (HH:mm), both validated
// BA is -03:00 no DST — hardcode is intentional, documented, and matches server's
// Date.parse → TIMESTAMPTZ UTC conversion. If DST returns, swap to baWallTimeToUtcDate.
const startDateTime = `${date}T${slot}:00-03:00`; // ISO 8601 with TZ, INV-06
// POST body: { vehicleId, serviceId, startDateTime }
```

Why not `Intl` offset derivation client-side: `baWallTimeToUtcDate` (`slotGenerator.ts:45-85`) is `server-only`; replicating its `formatToParts` offset-delta client-side works but adds ~30 LOC and a formatter per submit for no functional gain while BA stays `-03:00`. Keep the Intl derivation as the **server** authority (`calculateEndAndValidate` already handles DST via `WorkshopConfig.timezone`), document the hardcode with a `TODO(DST)` comment referencing `slotGenerator.baWallTimeToUtcDate`. Alternative `new Date(\`${date}T${slot}:00\`).toISOString()` is **rejected** — uses host TZ, violates INV-06 (BA evenings drift).

The page's existing `noonDate = new Date(\`${selectedDate}T12:00:00.000Z\`)` (:187) invariant is orthogonal — it dodges DST midnight shifts for **availability** bulk fetch (`getBaDayUtcRange`). Submit path does not need noon anchoring; it needs a wall-clock → UTC mapping, hence the explicit `-03:00`.

### Empty vehicles edge case
If RSC returns `vehicles.length===0`: render a block-level CTA (`<Link href="/vehicles">`) with copy "No vehicles yet — add one to book" and `data-testid="booking-empty-vehicles"`. Disable the Confirm button (`disabled` + `aria-disabled`) until a `?vehicleId=` resolves. Do **not** inline the `VehicleForm` here — keeps booking page focused on selection (F-04 requires *a* vehicle, CU-01 precondition). Creation stays on `/vehicles`.

### 409 conflict (EC-01 race) — pre-wire for T-044
Server returns `409 {error:{code:"APPOINTMENT_NOT_AVAILABLE"}}` (`route.ts:93-97`). BookingForm must:
* Catch `ApiError` (or `response.json().error.code`) and render an inline banner `role="alert"` with the server message "El horario seleccionado ya no se encuentra disponible."
* Keep all 4 URL params intact so user can re-pick slot without re-entering service/date/vehicle.
* Offer a `Retry` that re-reads `availableSlots` freshness: either `router.refresh()` (re-runs RSC `getAvailableSlotsForDate`) or refetch availability client-side. Prefer `router.refresh()` — single codepath, no duplicate fetch helper.
* **Not** swallow error — T-044 full success/error screen is separate; T-043's job is inline recovery.

### 403 ownership
If `?vehicleId=` does not belong to `authUser.id`, `appointmentService.ts:93` `assertOwnership` throws `ForbiddenError` → `route.ts:105-107` `403 FORBIDDEN`. UI must handle gracefully: banner "Vehicle not found or not owned" + link to `/vehicles`, and clear `?vehicleId=` from URL (`selectVehicle("")` writes `params.delete("vehicleId")`). Also guard client-side: if `!vehicles.some(v=>v.id===candidate)` then `selectedId=null` (same as ServiceSelector tampered fallback).

### Idempotency — double-click guard
Disable Confirm while pending. Use local `isPending` (`useState` or `useTransition`) → `button disabled={isPending}` + `aria-busy`. Do not rely on `router.push` dedup. Pending state also disables `VehicleSelector` and slot grid implicitly via `pointer-events:none` or `disabled` on buttons to prevent mid-flight URL mutation.

---

## 4. LOC Estimate & PR Budget

| Piece | Prod LOC | Test LOC |
|-------|----------|----------|
| `page.tsx` additions: extend `Promise.all` to include `listVehiclesByCustomer`, derive `vehicles: VehicleDTOJson[]`, add `VehicleSelector` + `BookingForm` render branch | ~45 | — |
| `VehicleSelector.tsx` (new compound: Provider + `List` radios + `Empty` CTA) | ~105 | ~65 |
| `BookingForm.tsx` + `lib/api/appointments.ts` (`createAppointment` fetch helper mirroring `lib/api/vehicles.ts`) | ~95 (70+25 helper) | ~55 |
| `BookingSummary.tsx` (optional small card showing 4 picks) or folded into BookingForm | ~25 | — |
| `appointments.module.css` additions (`.vehicleGrid`, `.vehicleCard`, `.vehicleSelected`, `.submit`, `.bannerError`, `.summary`) | ~45 | — |
| `lib/validators/vehicleId.ts` or reuse `z.string().uuid()` inline | ~5 | — |

**Total prod ~320 + test ~120 = ~440** — borderline over single-PR 400. Viable single PR if Summary is folded into BookingForm and CSS is trimmed (target ~360 prod). Otherwise split `feature-branch-chain`:
* PR1: `VehicleSelector` + page wiring + empty CTA (no submit) — ~160 prod
* PR2: `BookingForm` + `lib/api/appointments.ts` + 409/403 banners + pending + Summary — ~160 prod
Both under 400. Single PR acceptable if kept dense; chain preferred if Summary is a separate compound.

No migration, no config change, no new route.

---

## 5. DAG & Dependencies

```
T-039 vehicle-screen ✓  ──┐
T-040 service-selection ✓ ─┤
T-041 date-selection ✓    ─┤→ T-042 availability ✓ ─→ T-043 booking-form (THIS) → T-044 result
T-025 availability API ✓ ─┘                         ↗ (needs POST /api/appointments from T-028)
                                                     T-028/T-029 atomic booking already DONE (route + service + EXCLUDE gist)
```

T-043 has **no unfinished predecessors**. All deps (`T-039`+`T-040`+`T-042`+`POST /api/appointments` T-028) are on `master` (`eb4bad0`). After T-043, remaining UI chain is `T-044 result screen → T-045/T-046 upcoming+cancel → T-047-049 admin`.

---

## 6. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | **BA offset drift** — BA reintroduces DST, hardcode `-03:00` wrong | Low (no DST since 2009, IANA stable) | High (`startDateTime` off by 1h, `VALIDATION_ERROR` or wrong UTC slot) | Document `TODO(DST)` + reference `slotGenerator.baWallTimeToUtcDate`; server `calculateEndAndValidate` already DST-aware via `WorkshopConfig.timezone`. If DST returns, swap client to `Intl` `formatToParts` offset-delta (copy pattern from `lib/validators/date.ts:186-221`). Add unit test asserting `-03:00` offset via `Intl`. |
| 2 | **Race 409** — slot booked between availability fetch and submit | High (EC-01, capacity=1) | Med (user sees stale grid) | Inline `APPOINTMENT_NOT_AVAILABLE` banner + `router.refresh()` to re-run `getAvailableSlotsForDate`; keep URL state so only slot needs re-pick. Do not navigate on 409. |
| 3 | **Vehicle ownership tamper** — `?vehicleId=` UUID of another user's vehicle | Med (URL tampering) | Med (403, confusing) | Client guard `vehicles.some(id)` → `null` (defense in depth); server `assertOwnership` authoritative; UI banner + clear `?vehicleId=` + link to `/vehicles`. No 500. |

Blind spot: **slot staleness after long idle** — user sits on page, grid stale. Mitigated by `force-dynamic revalidate=0` + `cache:"no-store"` on `fetch("/api/availability")` path, but RSC grid is SSR-anchored. Acceptable for v1; T-044 success path will show canonical `TurnoDTO` as truth.

---

## 7. Reviewer Focus Areas

* **URL canonical contract**: every compound preserves siblings (`serviceId/date/slot/vehicleId`) via `new URLSearchParams(searchParams.toString())`; `router.push({scroll:false})`. Confirm no `localStorage`/`useEffect` fetch leaks.
* **INV-08**: `VehicleDTOJson` only (brand/model/year/plate/customerId + ISO strings); no `marca/patente/anio` leak.
* **INV-06**: `startDateTime` `${date}T${slot}:00-03:00` regex `Z|[+-]HH:MM` passes `route.ts:27`; server converts to TIMESTAMPTZ UTC.
* **Error envelope**: client helper mirrors `lib/api/vehicles.ts:42-49` `isErrorBody` and `lib/http/errors.ts:10-25` `ERROR_CODES` — 409/403/400/401 each render correct banner, 401 pushes `/login`.
* **Pending/idempotency**: Confirm button `disabled` while `isPending`, no double INSERT.
* **Accessibility**: `VehicleSelector` radio group `role="radiogroup"/"radio"` `aria-checked`, `BookingForm` `role="alert"` banners, `aria-busy` on pending.
* **Empty state**: 0 vehicles → CTA to `/vehicles`, not silent empty form.

---

## 8. Open Questions (non-blocking)

* [ ] Should T-044 consume `?vehicleId=&slot=&date=&serviceId=` from URL or from the `201 TurnoDTO` response? Recommend response DTO as truth, URL as deep-link fallback.
* [ ] Copy: "Vehicle not found or not owned" vs spec "FORBIDDEN" — choose user-facing wording.
* [ ] Should VehicleSelector show `brand model (year) — plate` single line (like `VehicleList.tsx:26`) or richer card? Single line keeps parity.

---

*Sources: Functional-spec.md F-04/FL-01/CU-01, Technical-spec.md §8.4:571-596 §6.4 §10, implementation-plan.md:1212 T-043, AGENTS.md INV-01..08, page.tsx:31-273, ServiceSelector.tsx:1-134, DateSelector.tsx:1-390, AvailabilitySlots.tsx:1-315, VehicleProvider/List/Form, vehicleService.ts:25-47, vehiculo.ts:9-31, route.ts:26-116, appointmentService.ts:69-152, slotGenerator.ts:45-96, workshopConfig.ts:1-120, vehicles.ts/services.ts helpers, date.ts:60-221.*
