# Exploration: t044-booking-result — Mostrar resultado de la reserva (FASE 8 UI-05 T-044)

> SDD Explore phase — read-only investigation. No code modified.

## Scope

- **Change:** `t044-booking-result` — FL-01 step 9 final feedback after `POST /api/appointments` (F-04 Solicitud de turno).
- **Depends on:** T-028 atomic creation (`appointmentService.createAppointment` REPEATABLE READ + SELECT FOR UPDATE + EXCLUDE gist) + T-043 booking form (`src/app/(customer)/appointments/new/_components/BookingForm.tsx:153-156` does `router.push("/appointments?confirmed=<id>")` on 201).
- **Out of scope:** T-045 full "Próximos turnos" dashboard (F-06) — T-044 reuses its data layer but does not replace it; admin panel (T-047/T-048); new domain states.

## Current State

### Does `/appointments` page exist? No.

- **Existing route:** only `src/app/(customer)/appointments/new/page.tsx:1-433` (RSC shell for the 4-selection flow: `?serviceId=&date=&slot=&vehicleId=` → `BookingForm` island).
- **Missing route:** `src/app/(customer)/appointments/page.tsx` does **not** exist (verified via `Get-ChildItem src/app/(customer)/appointments -Recurse` — only `new/` subfolder). Visiting `/appointments` today hits Next.js 404 (no `not-found.tsx` in that segment).
- **Consumer contract:** `BookingForm.tsx:153` hardcodes `router.push("/appointments?confirmed=${dto.id}", {scroll:false})` as the success target. T-043 spec (`openspec/changes/archive/2026-09-01-t043-booking-form/spec.md:53`) and proposal chain handoff both note "201 → ?confirmed= for T-044" — the navigation is shipped, the target page is not.
- **T-043 error envelope (already shipped):** `BookingForm.tsx:158-236` maps 409 `APPOINTMENT_NOT_AVAILABLE` → inline `role="alert"` + `router.refresh()`, 403 `FORBIDDEN` → banner + `params.delete("vehicleId")` + `router.refresh()`, 422 `INVALID_SERVICE` → banner + delete serviceId + push `/services`, 401 → `window.location.assign(buildLoginNext(...))`. The phrase "El horario dejó de estar disponible" is **already handled inline in BookingForm** — T-044 must not duplicate the race banner on `/appointments`.

### How `GET /api/appointments` works today

- **Route:** `src/app/api/appointments/route.ts:118-167` — thin handler: `requireAuth(req)` (401) → `parseAppointmentQuery(raw)` (400) → `getWorkshopConfig(db)` per-request (no global cache, T-036b invariant) → `listAppointments({db,config,now}, parsed, authUser)` → `NextResponse.json({data, pagination}, 200)`.
- **Query parser:** `src/lib/http/appointmentQuery.ts:100-168` — Zod `querySchema` with `status?`, `includeCancelled`/`includeRejected` (booleanQueryParam, default false), `from`/`to` (ISO 8601 with TZ), `date` (YYYY-MM-DD calendar-valid), `page`/`limit`/`offset`/`sort`. SuperRefine guards: `date` vs `from/to` mutual exclusion, `status=CANCELADO` requires `includeCancelled=true`, `status=RECHAZADO` requires `includeRejected=true`, `from <= to`.
- **Service/Repo:** `src/services/appointmentService.ts:259-276` `listAppointments` — injects `customerId=authUser.id` for `CLIENTE` (ADMIN sees all), injects `now` if missing, delegates to `src/db/repositories/turnos.ts:248-398` `findTurnosPaginated`. RN-04 defaults: only `PENDIENTE|CONFIRMADO` with `fechaHoraInicio > now`, flags opt-in add `CANCELADO`/`RECHAZADO`. Pagination `limit 1..100 default 20`, `sort asc|desc|startAt:asc|desc`.
- **Ownership enforcement:** `appointmentService.getAppointmentById:249-257` calls `loadOr404 → assertOwnership(turno.customerId, authUser)` (ADMIN bypass, CLIENTE exact match → else `ForbiddenError` 403). `listAppointments` does **not** call `assertOwnership` per-row — it scopes via `WHERE clienteId = authUser.id` for CLIENTE. Repo itself has no auth concept.
- **DTO mapping (INV-08):** `src/db/mappers/turno.ts:22-34` `toTurnoDTO` renames `clienteId→customerId`, `vehiculoId→vehicleId`, `servicioId→serviceId`, `fechaHoraInicio→startDateTime`, `fechaHoraFin→endDateTime`, `estado→status`. Route test at `src/app/api/appointments/route.test.ts:275-289,322-326` asserts no `estado`/`fecha_hora_inicio`/`cliente_id` leak. T-044 must preserve same mapper if it fetches a single turno.
- **States (INV-02):** `src/domain/appointmentStateMachine.ts:9-14` `AppointmentStatus = PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO`, Zod enum, `canTransition` matrix lines 31-45, terminal guard. `TurnoDTO.status` is `string` in mapper but validated via Zod on write.
- **Timezone (INV-06):** DB `TIMESTAMPTZ` UTC; API accepts `Z|[+-]HH:MM` (`route.ts:27` regex + `Zod.transform(Date)`). Booking helper `src/lib/api/appointments.ts:182-186` builds `${date}T${slot}:00-03:00` BA fixed (Law 26.474), server `Date.parse` → UTC. `findTurnosPaginated` uses UTC `now` comparison only.
- **Dashboard prior art (not yet built):** T-045 (`implementation-plan.md:1249-1265`) will consume same `GET /api/appointments` for the full list (fecha, horario, servicio, vehículo, estado). Today there is **no** `/appointments/page.tsx` — T-045 is unimplemented, so T-044 is the first consumer of that route on the frontend.

### Existing UI patterns to reuse

- **RSC page pattern:** `src/app/(customer)/services/page.tsx:34-111` and `src/app/(customer)/vehicles/page.tsx:64-106` both: `auth() → redirect("/login")` (INV-03), `Promise.all` parallel fetches, `searchParams: Promise<...>` (Next 15 async), `dynamic="force-dynamic" revalidate=0`, `ServiceDTOJson`/`VehicleDTOJson` ISO strings across boundary. `appointments/new/page.tsx` adds the `getAvailableSlotsForDate` bulk fetch.
- **Compound islands:** `VehicleSelector.tsx`, `AvailabilitySlots.tsx`, `ServiceSelector.tsx` all use `createContext + use(Context)` (React 19 `use`), `useSearchParams` canonical, `router.push({scroll:false})`, `URLSearchParams(searchParams.toString())` sibling preservation. T-044 confirmation UI should follow same composition rule (`BookingConfirmation` compound with `Banner`/`Details`/`Dismiss` statics, no boolean prop).
- **CSS tokens:** `src/app/(customer)/appointments/new/appointments.module.css:325-445` owns `.bookingSection`, `.summary`, `.errorBannerDestructive`. T-044 should extend same file or create `src/app/(customer)/appointments/appointments.module.css` sharing tokens (`--color-success`, `--color-danger-fg`, `--space-*`) — no Tailwind.

## Affected Areas

| Path | Why it's affected | Effort if touched |
|------|-------------------|-------------------|
| `src/app/(customer)/appointments/page.tsx` **(NEW)** | T-044 owns this file — RSC shell that reads `?confirmed=` + renders confirmation banner + appointments list. Does not exist today. | New ~120 LOC |
| `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` **(NEW)** | Client island for the `?confirmed=` banner: renders DTO details, a11y `role="status"`/`aria-live="polite"`, dismiss button that does `router.replace("/appointments", {scroll:false})` to strip the param (PRG hygiene). Variant: pure RSC banner is possible but client is needed for dismiss without full reload. | New ~80 LOC |
| `src/app/(customer)/appointments/appointments.module.css` **(NEW or extend new/page.tsx CSS)** | Success banner tokens (`.successBanner`, `.successBannerDismiss`) — mirrors `.errorBannerDestructive` but green. Keep consistent radius/spacing. | New ~30 LOC |
| `src/services/appointmentService.ts:249-257` `getAppointmentById` | Read-only reuse — RSC will call it directly (DI `{db,config}`) to fetch the confirmed turno for banner details. No change, but T-044 must pass `authUser` from `auth()`. | Read |
| `src/db/repositories/turnos.ts:157-163` `findTurnoById` | Read-only reuse inside `getAppointmentById`. No change. | Read |
| `src/lib/auth/requireAuth.ts:84-87` `assertOwnership` | Ownership check for banner fetch; T-044 must surface `FORBIDDEN` as 404 (privacy) not 403. | Read / decision |
| `src/app/api/appointments/route.ts:118-167` GET handler | Not modified by T-044, but the future T-045 list will share it. T-044's RSC bypasses HTTP and calls service directly (design D1) — avoids internal fetch hop. | Read |
| `src/app/(customer)/appointments/new/_components/BookingForm.tsx:153-156` | Already pushes `?confirmed=` — no change, but T-044 must document the contract and handle tampered/foreign/stale ids. | Read |
| `src/config/workshopConfig.ts` | Needed for `getWorkshopConfig(db)` DI in new RSC page (timezone for display formatting). | Read |
| `src/domain/appointmentStateMachine.ts` | Display of `status` badge in banner (PENDIENTE yellow, CONFIRMADO green). No logic change. | Read |
| `openspec/specs/booking-result/spec.md` **(NEW canonical)** | New capability spec — mirrors `booking-form/spec.md` structure. | New |
| `openspec/changes/t044-booking-result/{proposal,design,tasks}.md` | SDD artifacts for the change. | New |

No migration, no schema change, no new API route.

## Approaches

| # | Approach | Description | Pros | Cons | Effort |
|---|----------|-------------|------|------|--------|
| **A** | **RSC server fetch of turno by id + banner (recommended)** | `appointments/page.tsx` is an RSC `async function({searchParams: Promise<{confirmed?, page?, status?}>})`. Parse `confirmed` via `z.string().uuid().safeParse`. If valid, `await getAppointmentById({db, config: await getWorkshopConfig(db)}, confirmed, authUser)` inside `try/catch`. On success render `<BookingConfirmation turno={dto}>` banner (data: `startDateTime` formatted via `Intl.DateTimeFormat({timeZone: config.timezone})`, vehicle/service labels). On `ForbiddenError` or `AppointmentNotFoundError` render **silent fallback** — no banner (or generic "Turno no encontrado" with 404 semantics, no owner leak). Dismiss is a tiny client island (`"use client"` with `useRouter().replace("/appointments",{scroll:false})`) that strips `?confirmed=` without reload. The rest of the page renders the upcoming list via `listAppointments` (same RSC). All data via direct service calls (no `fetch("/api/...")` hop). | - Zero waterfall: `Promise.all([getWorkshopConfig, getAppointmentById?, listAppointments])` parallel. <br>- Ownership enforced server-side before any HTML ships (INV-03). <br>- No extra round-trip, no client fetch race, no flash of empty. <br>- Keeps RSC → client boundary to primitives (INV-08) — banner receives `TurnoDTOJson` with ISO strings. <br>- Refresh/back/share safe: `?confirmed=` is URL-canonical, RSC re-resolves on each navigation. <br>- Follows `services/page.tsx` / `vehicles/page.tsx` precedent exactly. | - Banner fetch adds one DB query per page load with `?confirmed=` (negligible). <br>- Need small client component just for dismiss (otherwise pure RSC `Link` would also work — minor tradeoff). | **Low** (~180 LOC prod + ~60 test) |
| **B** | Client `useSearchParams` + `fetch GET /api/appointments/:id` | New `/appointments/page.tsx` is a client-heavy page that reads `useSearchParams().get("confirmed")` and `fetch("/api/appointments/<id>")` (requires new `GET /api/appointments/:id` route — does not exist today). Success renders banner, error renders fallback. | - Pure client simplicity. <br>- Can animate with `useTransition`. | - Requires **new API route** `GET /api/appointments/:id` (extra contract, extra auth test surface). <br>- Client fetch is after hydration → flash, extra RTT, needs Suspense boundary ( `useSearchParams` CSR bailout per `next-best-practices:Suspense Boundaries`). <br>- Breaks D1 precedent (RSCs call services directly, no internal HTTP hop — see `appointments/new/page.tsx:124-128`). <br>- Harder to keep URL as source of truth on SSR first paint. | **Medium** (~200 LOC + new route + tests) |
| **C** | Middleware flash / cookie | `BookingForm` sets a `Set-Cookie: booking_confirmed=<id>; Path=/appointments; HttpOnly; Max-Age=30` on 201 response; middleware or `appointments/page.tsx` reads cookie, renders banner, then clears cookie. No `?confirmed=` in URL. | - No URL pollution. <br>- Banner is one-shot (auto-clears). | - Breaks shareability/refresh (cookie gone on refresh → banner lost if user refreshes before seeing). <br>- Needs cookie plumbing through `POST /api/appointments` route (adds coupling). <br>- Inconsistent with prior T-043 decision to use URL canonical (`BookingForm:153` explicitly chose `?confirmed=`). <br>- Harder to test, edge runtime `middleware.ts` already owns auth — overloading it. | **Medium** |
| **D** | Toast-only (no page, no `?confirmed=`) | `BookingForm` shows a `sonner`/`useToast` toast on 201 and does **not** navigate. Stays on `/appointments/new`. | - Minimal code. | - User stays on stale form with 4 selections still in URL — confusion, double-submit risk. <br>- Violates FL-01 step 9 "inform if solicitud fue creada" as a **navigated result** (spec expects result on `/appointments`). <br>- Toast auto-dismisses, not auditable, not shareable, a11y weaker (`role="alert"` banner is required). | **Low** but **incorrect** |

### Recommendation

**Option A — RSC server fetch with client dismiss.**

Reasoning:

1. **Precedent fit:** Every customer RSC (`services/page.tsx`, `vehicles/page.tsx`, `appointments/new/page.tsx`) calls services directly via DI `getWorkshopConfig(db) + listServices/listVehiclesByCustomer/findTurnoById` — never an internal `fetch`. Option B would create the only `fetch("/api/...")` hop in a (customer) RSC, breaking the established D1 pattern and adding an `api` round-trip that the watcher already avoids.
2. **Security by default:** Ownership is checked before markup ships. A client fetch (B) would expose the turno id to the browser before the check, and a cookie flash (C) would hide the id but still need a read path. With A, a foreign `?confirmed=<other-user-id>` returns `ForbiddenError` → rendered as generic "Turno no encontrado" (404 semantics), never leaking existence — matching `requireAuth` defense-in-depth.
3. **INV-06/INV-08 hygiene:** Server formatting via `Intl.DateTimeFormat` with `WorkshopConfig.timezone` keeps TZ display correct (BA `-03:00`). Primitives (`TurnoDTOJson` ISO strings) cross the RSC boundary already mapped — reuse `toTurnoDTO` pattern, no snake leak.
4. **Next.js 15 correctness:** `searchParams` is `Promise<...>` in Next 15 (async API per `next-best-practices:Async Patterns`). RSC `await searchParams` + `z.string().uuid().safeParse` handles tampered/garbage without `try/catch` noise. Client island uses `useSearchParams` only for dismiss — wrapped in `<Suspense>` per CSR bailout rule.
5. **Scope boundary stays clean:** 409 `APPOINTMENT_NOT_AVAILABLE` stays in `BookingForm` (no duplication). T-044 banner handles only the **success** path plus stale `?confirmed=` edge cases (not found, wrong owner, terminal states `CANCELADO/RECHAZADO` — show neutral "Turno no disponible" without leaking state).
6. **Line budget:** ~180 prod + ~60 test fits the single-PR 400-line budget (`chained-pr` skill). No new API, no migration.

## Detailed answers to traceability questions

### 1. Current state (answered above)

- No `src/app/(customer)/appointments/page.tsx` — confirmed missing.
- Renders today: nothing (404) at `/appointments`; full booking flow at `/appointments/new`.
- `GET /api/appointments` — `route.ts:118-167` thin handler + `appointmentQuery.ts` Zod + `appointmentService.listAppointments` with ownership scoping + `findTurnosPaginated` RN-04 + DTO mapping snake→camel.

### 2. Where should `?confirmed=` UI live?

- **Dedicated `src/app/(customer)/appointments/page.tsx`** (new file), not inside `new/page.tsx` and not a shared catch-all component.
- Rationale: `new/` is the 4-selection builder; `appointments/` is the result + list surface (F-06 "Próximos turnos" + FL-01 step 9). Keeping them separate preserves `force-dynamic` segment isolation and lets `new/page.tsx` stay focused on slots/vehicles. The banner itself is a small compound `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` composed inside the RSC page alongside the upcoming list — coexistence is natural: banner at top (`role="status"`), list below (reuse `listAppointments` result). Filters/pagination (`?page=&sort=`) coexist with `?confirmed=` via `URLSearchParams(searchParams.toString())` preservation — dismiss strips only `confirmed`.

### 3. Options table — see above (A/B/C/D). Recommended A.

### 4. Security/ownership

- **Must verify `turno.customerId == authUser.id`** before showing confirmation — even for the success banner. Flow: `auth()` in RSC → `getAppointmentById({db,config}, confirmed, {id: session.user.id, role})` → `assertOwnership` inside service (ADMIN bypass). If `ForbiddenError` → treat as `AppointmentNotFoundError` for response (404 semantics, not 403) to avoid confirming existence to an attacker enumerating UUIDs. Existing `GET /api/appointments` enforces ownership by scoping `WHERE clienteId = authUser.id` for CLIENTE — T-044's single-fetch path should use the stricter `getAppointmentById` + 404 mapping.
- **No service change:** reuse `getAppointmentById` as is; mapping to 404 is a presentation concern in the RSC page.
- **Auth missing:** `(customer)/layout.tsx:40-42` already `redirect("/login")` — defensive second `auth()` check in page matches `services/page.tsx:44-47`.

### 5. Error path "horario dejó de estar disponible" — scope boundary

- **BookingForm is the sole owner** of the 409 race banner (`BookingForm.tsx:160-164`). T-044 does **not** render that copy again.
- **Stale `?confirmed=` edge cases that T-044 does handle (separate concern):**
  - `?confirmed=` not a UUID → `z.string().uuid().safeParse` fails → no banner, just list.
  - UUID not found → `AppointmentNotFoundError` → generic fallback (no banner or neutral "No se encontró el turno").
  - UUID belongs to another user → `ForbiddenError` → same 404 fallback (no 403 leak).
  - Turno exists but is `CANCELADO`/`RECHAZADO` (user navigates with old link after admin reject) → show neutral fallback, not success. The success banner only confirms `PENDIENTE` (or `CONFIRMADO` if admin already confirmed between booking and navigation) — design decision for proposal to lock.
  - Tampered `?confirmed=` with XSS payload → UUID parse fails, no `dangerouslySetInnerHTML`, plain text only.

### 6. Invariants touch

- **INV-02 States:** Only `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` via `appointmentStateMachine.ts:9`. Banner checks `status` for badge color; no `COMPLETADO`.
- **INV-03 Auth:** `auth()` JWT httpOnly + `requireAuth`/`assertOwnership`; `(customer)/layout` gate + page-level `redirect("/login")`.
- **INV-06 Timezone:** DB `TIMESTAMPTZ` UTC; display formats via `Intl` with `WorkshopConfig.timezone = America/Argentina/Buenos_Aires`; never naive `new Date(date+slot).toISOString()` on server (helper `buildBookingStartDateTime` already owns the `-03:00` assumption).
- **INV-08 Naming:** DB `snake_case` never leaks; banner consumes `TurnoDTOJson` camelCase + ISO strings via `toTurnoDTO`/`toJson` mapping.
- **INV-04/INV-05:** Not directly touched (atomic booking and slot `fin <= cierre` belong to T-028/T-022), but banner indirectly proves they executed (201 only happens after those guards pass).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing `/appointments/page.tsx` blocks T-045 list work if T-044 ships incomplete list | Med | Med | Keep T-044's list minimal (upcoming `PENDIENTE|CONFIRMADO` only, no filters beyond `?confirmed=` dismiss). Full T-045 spec is separate change. |
| `?confirmed=` enumeration — attacker probes UUIDs to confirm existence | Low (UUIDv4) but real | Low (no PII beyond own turno) | Map `ForbiddenError` → 404 generic, never echo foreign `customerId`; no 403 body on banner path. |
| Stale `?confirmed=` after turno `CANCELADO`/`RECHAZADO` shows confusing success | Med | Low | Banner guards: only render success for `PENDIENTE`/`CONFIRMADO`; else neutral fallback. Document in spec. |
| `useSearchParams` CSR bailout without `<Suspense>` in Next 15 | High if client dismiss misses boundary | Build break / runtime error | Wrap `BookingConfirmation` client part in `<Suspense fallback={null}>` per `next-best-practices:Suspense Boundaries`. |
| Line budget >400 with list + banner | Low (kept <250 prod) | Med | Fold `BookingConfirmation` into page file if needed; do not pull full `T-045` list — paginate with `limit=20` reuse. |
| Timezone display drift if hardcoded offset used for rendering | Low | Med | Use `Intl.DateTimeFormat(timeZone: config.timezone)` with `Date` UTC, not string slicing of `-03:00`. |

## Ready for Proposal

**Yes.** Scope is bounded, precedent is clear, no open design fork remains.

**Next step for `sdd-propose`:**

- Create `openspec/changes/t044-booking-result/proposal.md` with intent = FL-01 step 9, scope = new `src/app/(customer)/appointments/page.tsx` + `BookingConfirmation` compound + CSS tokens, chain handoff from T-043 `?confirmed=` contract.
- Create `openspec/specs/booking-result/spec.md` canonical with 3 requirements: (1) RSC searchParams `confirmed` UUID parse + `getAppointmentById` + ownership 404, (2) success banner `role="status"` with `startDateTime`/`endDateTime`/`serviceId`/`vehicleId` formatted and dismiss via `router.replace`, (3) stale/foreign/invalid fallback + coexistence with upcoming list (`listAppointments` RN-04 defaults).
- Follow hybrid delivery: single PR (recommended A) under 400 lines; no chained PR needed.

## References

- `src/app/(customer)/appointments/new/page.tsx:1-433` — RSC 4-selection shell, `Promise.all([getWorkshopConfig, listServices, listVehiclesByCustomer])`, `selectedSlot`/`selectedVehicle` guards, `BookingForm` composition.
- `src/app/(customer)/appointments/new/_components/BookingForm.tsx:122-267` — submit island, 201 `router.push(/appointments?confirmed=)`, 409/403/422/401 envelope.
- `src/lib/api/appointments.ts:1-205` — `TurnoDTOJson` DTO, `buildBookingStartDateTime` `-03:00`, `buildLoginNext`.
- `src/app/api/appointments/route.ts:118-167` — GET handler, per-request `getWorkshopConfig(db)`.
- `src/services/appointmentService.ts:249-276` — `getAppointmentById` + `assertOwnership`, `listAppointments` CLIENTE scoping.
- `src/db/repositories/turnos.ts:157-398` — `findTurnoById`, `findTurnosPaginated` RN-04, `toTurnoDTO`.
- `src/db/mappers/turno.ts:22-34` — INV-08 mapping.
- `src/domain/appointmentStateMachine.ts:9-79` — INV-02 `PENDIENTE|CONFIRMADO|RECHAZADO|CANCELADO` + `canTransition`.
- `src/lib/auth/requireAuth.ts:84-91` — `assertOwnership`, `ForbiddenError`.
- `openspec/specs/appointment/spec.md` — state matrix + DTO mapping.
- `implementation-plan.md T-044:1228-1245` — "inform if solicitud fue creada o horario dejó de estar disponible", depends T-028+T-043.
- `Functional-Spec.md F-04:164-173`, `FL-01:249-259` + `FL-01b:265-275` — booking flow.

---
*Generated by sdd-explore for `t044-booking-result` at master bde0321. Read-only; no code modified.*
