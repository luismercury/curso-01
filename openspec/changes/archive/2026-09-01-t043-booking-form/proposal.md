# Proposal: T-043 Crear formulario de reserva

## Intent

Complete the 4-selection booking form on `/appointments/new` with submit. Adds `<VehicleSelector>` + `<BookingForm>` compounds so that `?serviceId=&date=&slot=&vehicleId=` valid → `POST /api/appointments` (T-039 `route.ts:42-91`). Bridges F-04 (`Functional-Spec.md:164-173`, FL-01 steps 2-9) and T-042 `?slot=` → T-044 result feedback. No new API; reuses `appointmentService.ts:69-152` atomic `REPEATABLE READ` + `EXCLUDE gist`.

## Scope

### In Scope
- `<VehicleSelector>` compound (List + SelectedBanner + Clear + Empty CTA) on `/appointments/new`, `?vehicleId=` canonical.
- `<BookingForm>` submit compound (Summary card + Confirm button + pending + inline error banners) via `fetch POST`.
- `lib/api/appointments.ts` client helper (`credentials:include`, `isErrorBody` envelope `lib/http/errors.ts:10-42`).
- `submitBooking()` → `POST /api/appointments` `{vehicleId,serviceId,startDateTime}` ISO 8601 with TZ.
- TZ reconstruction `${date}T${slot}:00-03:00` BA fixed (`Law 26.474`, no DST since 2009) documented with `TODO(DST)` escape to `slotGenerator.ts:45-96`.
- Edge cases: 0 vehicles CTA → `/vehicles`, 409 `APPOINTMENT_NOT_AVAILABLE` banner + `router.refresh()`, 403 `FORBIDDEN` banner + clear `?vehicleId=`, 401 → `/login`.
- Tests: `page.test` (RSC), `VehicleSelector.test`, `BookingForm.test`, `lib/api/appointments.test`.
- CSS tokens: vehicle card/selected, summary, submit pending, error banner (`appointments.module.css`).

### Out of Scope
- T-044 success/error full screen (separate change, owns `/appointments?confirmed=`).
- T-045+ dashboard/upcoming, admin confirm/reject (T-033 done).
- Vehicle CRUD on `/appointments/new` (redirects to `/vehicles`; `VehicleProvider.tsx:1-100` not reused).
- Any non-BA timezone (INV-06 `America/Argentina/Buenos_Aires` only).

## Capabilities

### New Capabilities
- `booking-form`: 4-selection form on `/appointments/new` with vehicle selection + submit via `POST /api/appointments` (F-04, RN-01/03).

### Modified Capabilities
- `availability-display`: `page.tsx` composes 4th compound + submit branch after `selectedSlot` valid (`availability-display/spec.md:25-38`).
- `date-selection`: same page composition extends past T-042 (`date-selection/spec.md` — no spec delta, composition only).

## Approach

**Option (a) — VehicleSelector + BookingForm via `fetch POST`** mirroring `ServiceSelector.tsx:1-134`.

```mermaid
flowchart LR
  URL[?serviceId+?date+?slot+?vehicleId]-->RSC[page.tsx auth+validation]
  RSC-->CFG[Promise.all config+services]
  RSC-->VEH[listVehiclesByCustomer db authId]
  CFG-->SVC[getAvailableSlotsForDate noon T12:00Z]
  SVC-->FMT[formatSlotsAsHHmm]
  FMT-->UI[AvailabilitySlots]
  UI-->VEHSEL[VehicleSelector ?vehicleId]
  VEHSEL-->FORM[BookingForm Summary+Submit]
  FORM-->|POST|API[/api/appointments route.ts:30-40]
  API-->SVC2[appointmentService REPEATABLE READ]
  SVC2-->|201|NAV[/appointments?confirmed=id T-044]
  SVC2-->|409/403|BAN[inline banner + refresh/clear]
```

- **VehicleSelector** mirrors `ServiceSelector` exactly: `createContext` + `use(ctx)` (React 19) + `useSearchParams().get("vehicleId")` + `z.string().uuid()` + `vehicles.some(v=>v.id===candidate)` defense-in-depth + `useMemo(selected)` + `useCallback(router.push(?vehicleId=))` + `URLSearchParams(searchParams.toString())` sibling preservation + `router.push({scroll:false})`. RSC feeds `listVehiclesByCustomer(db, authId)` → `VehicleDTOJson[]` via `vehiculo.ts:20-30` mapper (INV-08, D1 no HTTP hop, same as `vehicles/page.tsx:51-62`, `services/vehicleService.ts:1-117`).
- **BookingForm/SubmitSection** posts JSON `POST /api/appointments` via `lib/api/appointments.ts` helper (`fetch {credentials:"include", cache:"no-store"}`, `isErrorBody` envelope). Derives `startDateTime = date+"T"+slot+":00-03:00"` (BA fixed; server `Date.parse` → `TIMESTAMPTZ` UTC, INV-06). No Server Action (bypasses `route.ts` envelope), no plain `<form>` (breaks `req.json()` contract).
- **Error handling inline** (no full nav): 409 → `role="alert"` "El horario seleccionado ya no se encuentra disponible." + `router.refresh()` to re-run RSC `getAvailableSlotsForDate`; 403 → banner + `params.delete("vehicleId")` + CTA `/vehicles`; 400 `VALIDATION_ERROR/INVALID_SERVICE` → banner; 401 → `router.push("/login")`. Keeps 4 URL params intact for re-pick.
- **Idempotency**: `useTransition`/`useState isPending` → `button disabled={isPending}` + `aria-busy` + `pointer-events:none` on selectors mid-flight.
- **Empty vehicles**: `vehicles.length===0` → block CTA `<Link href="/vehicles">` + `data-testid="booking-empty-vehicles"`, Confirm `disabled`+`aria-disabled`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(customer)/appointments/new/page.tsx` | Modified | Extend `Promise.all` to include `listVehiclesByCustomer` + thread `vehicles: VehicleDTOJson[]` + render `VehicleSelector` + `BookingForm` branch (`:31-261` +45 LOC) |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx` | New | Compound Provider/List/SelectedBanner/Clear/Empty (~105 LOC) |
| `src/app/(customer)/appointments/new/_components/BookingForm.tsx` | New | Compound Summary/Submit/ErrorBanner + `fetch POST` (~70 LOC) |
| `src/app/(customer)/appointments/new/_components/VehicleCard.tsx` | New | Atomic radio card `brand model (year) — plate` |
| `src/app/(customer)/appointments/new/_components/SummaryCard.tsx` | New | 4-row summary (foldable into BookingForm if LOC tight) (~25 LOC) |
| `src/app/(customer)/appointments/new/appointments.module.css` | Modified | `+.vehicleList/.vehicleCard/.vehicleSelected/.summary/.submit/.errorBanner/.pending` (~45 LOC) |
| `src/lib/api/appointments.ts` | New | Client helper `createAppointment` mirroring `lib/api/vehicles.ts:1-112` (~25 LOC) |
| `src/lib/validators/vehicle.ts` | Read-only | `vehicleIdSchema` guard reuse (`z.string().uuid()`) |
| `src/lib/http/errors.ts` | Read-only | `ErrorEnvelope` + `ERROR_CODES` (`:10-42`, `:58-69`) |
| `services/vehicleService.ts` + `services/appointmentService.ts` | Read-only | RSC DI + atomic transaction (`:69-152`) |
| `src/db/mappers/vehiculo.ts` | Read-only | `VehiculoDTO` → `VehicleDTOJson` (INV-08) |
| `loading.tsx` + `error.tsx` | Read-only | Segment boundaries reused (`:1-48`, `:1-92`) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| BA DST drift (hardcode `-03:00`) | Low (no DST since 2009, IANA stable) | Hardcode + unit test via `Intl`; `TODO(DST)` escape to `slotGenerator.baWallTimeToUtcDate`; server `calculateEndAndValidate` DST-aware via `WorkshopConfig.timezone` |
| 409 race (EC-01, capacity=1) | High | `useTransition` pending disable + inline `APPOINTMENT_NOT_AVAILABLE` banner + `router.refresh()`; keep URL state |
| Ownership tamper `?vehicleId=` | Med | Client guard `vehicles.some(v=>v.id===candidate&&v.customerId===userId)` → `null` + server `assertOwnership` (`appointmentService.ts:93`); banner + clear + CTA |
| LOC budget (~440) | Med | Fold Summary into BookingForm (~360 prod) or `feature-branch-chain` split (see Review Budget) |
| 0 vehicles | Med | CTA `/vehicles` + Confirm disabled; no inline `VehicleForm` |

## Alternatives Considered

- **(b) `<form action="/api/appointments" method="post">`** — breaks JSON contract; `route.ts:58` expects `req.json()`; full navigation loses `{scroll:false}` siblings.
- **(c) Server Action** — couples UI to server module, forks single source of truth (`route.ts:42-116`), bypasses tested envelope (`lib/http/errors.ts`), harder inline 409/403 without nav.
- **(d) Reuse `VehicleProvider`** (`vehicles/_components/VehicleProvider.tsx:1-100`) — overloads selection with CRUD mutation state (`isPending`, `createVehicle`, `router.refresh`); no `?vehicleId=` URL write; couples booking to vehicle admin.

## Rollback Plan

Revert commit: delete `VehicleSelector.tsx` + `BookingForm.tsx` (+ `VehicleCard`/`SummaryCard`) + `lib/api/appointments.ts` + CSS tokens; restore `page.tsx:31-261` T-042 state. No migration, no DB change, `route.ts` unchanged (POST exists since T-039 `eb4bad0`). `git revert <sha>` single commit.

## Dependencies

- DONE: T-025 availability domain, T-039 `POST /api/appointments` (`route.ts:26-116`), T-040 `ServiceSelector`, T-041 `DateSelector`, T-042 `AvailabilitySlots`. Refs `Technical-spec.md:574-596` §8.4, `Functional-Spec.md:164-173` F-04, `implementation-plan.md` T-043.
- Feeds: T-044 Mostrar resultado de la reserva (consumes `201 TurnoDTO` or `?confirmed=`).

## Chain Handoff to T-044

On `201 {id, ...TurnoDTO}` BookingForm does `router.push("/appointments?confirmed="+id)` (T-044 owns result screen as separate page). T-044 reads `?confirmed=turnoId` or the response DTO; URL canonical keeps booking form thin and lets T-044 add success/error without polluting T-043. T-043's job on 409/403 is inline recovery, not full-screen feedback.

## Review Budget

~320 prod + ~120 test = ~440 (page +45, VehicleSelector ~105, BookingForm+helper ~95, Summary ~25, CSS ~45, validator ~5). Borderline 400. **Decision at tasks phase**: single PR folded Summary (~360 prod → `size:exception`) OR `feature-branch-chain` PR1 VehicleSelector + empty CTA + tests (~200) → PR2 BookingForm + Summary + 409/403 + tests (~280). Recommend chain split to keep each PR <400.

## Success Criteria

- [ ] Valid `?serviceId=&date=&slot=` + selected vehicle writes `?vehicleId=` (siblings preserved, `scroll:false`, `radiogroup` a11y).
- [ ] All 4 valid → Confirm enabled; click → `POST /api/appointments` `201` → `router.push("/appointments?confirmed=<id>")` for T-044.
- [ ] 0 vehicles → CTA `/vehicles`, Confirm `disabled`+`aria-disabled`.
- [ ] 409 `APPOINTMENT_NOT_AVAILABLE` → inline `role="alert"` banner + `router.refresh()` re-fetches availability; no nav.
- [ ] 403 tampered `?vehicleId=` → banner + clear `?vehicleId=` + CTA `/vehicles`; no 500.
- [ ] 401 → `/login`; 400 `VALIDATION_ERROR` → banner with `issues`.
- [ ] INV-03 ownership server-side `vehiculo.clienteId==authUser.id`, INV-06 BA `-03:00` → UTC `TIMESTAMPTZ`, INV-08 `brand/model/year/plate/customerId` camelCase only, INV-05 `slotSchema` + `fechaHoraFin<=finIntervaloOperativo`, `force-dynamic revalidate=0` preserved.
