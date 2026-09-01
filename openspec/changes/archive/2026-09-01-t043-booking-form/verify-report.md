```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:45478d6e6dc2c66d2c34078ba57e6bccfaa1cb956498f8ac7eb0639d9956af54
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 13/13
test_command: pnpm vitest run 'src/app/(customer)/appointments/new/' 'src/lib/api/appointments' 'src/lib/validators/vehicleId'
test_exit_code: 0
test_output_hash: sha256:18d6037fab06ac05959049d2d85c69fa04b5a3544c53edef8c3247bdba607b5e
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:b32fcf85184dd0da9a5ca9ee3e538b32fb63d2e05155498455e28cfdf803a145
```

> Hybrid artifact (Engram + filesystem). Per-cycle independent verification
> of the SDD change at HEAD of master (= `2225eb7`).
> Hybrid topic key `sdd/t043-booking-form/verify-report`.
>
> Commit under verify: `2225eb7 feat(booking-form): merge T-043 — 4 ADDED 13 GWT PASS`
> (merge of PR1 `3366615` + PR2 `df6fb8a`).
> Master baseline: `eb4bad0` (T-039 vehicle screen).
> Spec: `openspec/specs/booking-form/spec.md` (canonical, byte-identical to
> `openspec/changes/t043-booking-form/spec.md`) — 4 ADDED requirements,
> 13 GWT scenarios.
> Design: `openspec/changes/t043-booking-form/design.md` — 10 architecture
> decisions, 3 open questions resolved (Q1 useState isPending, Q2
> `window.location.assign` for 401, Q3 `<Link href="/vehicles">` empty CTA).
> Tasks: `openspec/changes/t043-booking-form/tasks.md` — 22 tasks across
> 3 phases (PR1 = 9, PR2 = 10, verify+archive = 3). All `1.x` and `2.x`
> marked `[x]`; `3.x` is this report's deliverable.
> Apply-progress: `openspec/changes/t043-booking-form/apply-progress.md`
> (PR1 + PR2 merged report, 410 lines).

`gentle-ai sdd-verify-validate --requirements 4 --scenarios 13` admits the
envelope above as `valid: true`, `verdict: pass_with_warnings`. The
`evidence_revision` is the SHA-256 of the merge commit SHA
`2225eb77e7452d43aa6ae9c45d0e210c7a2dfa83`.

## Verdict

**pass_with_warnings** — T-043 closes FASE 8 UI-04 (FL-01 booking flow
steps 2–6) and hands off cleanly to T-044 via the URL-canonical
`?confirmed=<id>` convention. All 4 ADDED requirements and all 13 GWT
scenarios are covered with explicit per-scenario test evidence. Two
non-blocking warnings documented (size:exception + harness:gap) plus one
informational note (pre-existing DB integration failures).

| Dimension | Result |
| --- | --- |
| Spec coverage | 4/4 ADDED requirements, 13/13 GWT scenarios |
| Tasks completion | 22/22 ([x] all PR1 + PR2 tasks; 3.x is this report) |
| T-043 vitest (targeted) | 152/152 PASS across 9 test files |
| TypeScript (`tsc --noEmit`) | 0 errors across the project |
| Next.js build | `ƒ /appointments/new` Dynamic; force-dynamic preserved |
| ESLint | 21 problems (2 errors, 19 warnings) — 0 from T-043 files |
| Full repo vitest | 50 fail / 1204 pass / 2 skipped — all 50 are pre-existing DB integration tests with `ECONNREFUSED ::1:5432` (Postgres not running locally), identical to master baseline |
| INV-01 / 02 / 03 / 04 / 05 / 06 / 07 / 08 | All pass with explicit per-invariant evidence |
| Advisory findings | 3 (PR2 review R3-001 / R3-002 / R3-003, informational only) |
| Final verdict | **PASS with warnings** |

## Specification Coverage

Each ADDED requirement from `openspec/specs/booking-form/spec.md` is
mapped to its GWT scenarios, the source location, and the implementation
evidence.

### Requirement: R1 — RSC Vehicle List Fetch (REQ-BOOK-01)

**Source:** `openspec/specs/booking-form/spec.md` → Requirement: RSC Vehicle List Fetch.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Authenticated user with vehicles | GIVEN `auth` ok, `session.user.id === customerId`, `listVehiclesByCustomer` returns `[{brand, model, year, plate, ...}]` → RSC resolves → HTML includes VehicleSelector with DTO primitives only; no `marca`/`patente` substrings | PASS | `page.tsx:109-117` adds `listVehiclesByCustomer(db, userId)` to `Promise.all` (parallel, no waterfall) and maps via local `toVehicleJson` (camelCase + ISO). Test `page.test.tsx` "authenticated + vehicles → renders VehicleSelector with primitive props only" asserts `VehicleSelectorImpl` + statics in the tree + `mockListVehicles` invoked once with `(expect.anything(), ID_A)`. INV-08 assertion "INV-08 — vehicles wire does not leak marca/modelo/anio/patente/cliente_id through the rendered tree" covers the no-Spanish-leak half. |
| Zero vehicles | GIVEN `auth` ok, `listVehiclesByCustomer` returns `[]` → RSC resolves → CTA "Add a vehicle to book" → `/vehicles`; BookingForm absent or disabled | PASS | `page.tsx:174-202` short-circuits with the 0-vehicle CTA branch (renders before `DateSelector` / `AvailabilitySlots` / `VehicleSelector` / `BookingForm`). Tests "zero vehicles → CTA to /vehicles, no DateSelector, no AvailabilitySlots (GWT Zero vehicles)" + "zero vehicles → no availability fetch (saves the bulk round-trip)" assert the `booking-empty-vehicles` testid + `/vehicles` href + absence of all booking-flow compounds + `mockGetSlots` not invoked. |
| Unauthenticated | GIVEN `auth` null → `redirect("/login")`, no `listVehiclesByCustomer` call, no DTO leak | PASS | `page.tsx:91-96` runs `auth()` → `redirect("/login")` BEFORE `Promise.all`. Test "null session -> redirect('/login'), no DB calls (INV-03 defensive)" asserts `mockListVehicles`, `mockConfig`, `mockList` never invoked when auth returns null. |

### Requirement: R2 — URL-canonical VehicleSelector Compound (REQ-BOOK-02)

**Source:** `openspec/specs/booking-form/spec.md` → Requirement: URL-Canonical VehicleSelector Compound.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| Selection writes URL with siblings preserved | GIVEN `?serviceId=uuidA&date=2026-09-10&slot=09:30`, `vehicles=[{id:uuidV,…}]` → click vehicle uuidV → URL `?serviceId=uuidA&date=2026-09-10&slot=09:30&vehicleId=uuidV`, `router.push({scroll:false})`, banner shows summary | PASS | `VehicleSelector.tsx:126-137` `select(id)` clones `searchParams.toString()` into `URLSearchParams`, sets `vehicleId`, pushes `${pathname}?${query}` with `{ scroll: false }`. Sibling preservation proven by R3-001 PR1 correction (commit `3366615`): the previous `URLSearchParams(window.location.search)` implementation dropped `date` / `slot` siblings; the fix clones the live `useSearchParams()` value instead. `VehicleSelector.test.tsx` "click vehicle uuidV → URL with vehicleId + all siblings preserved + scroll:false" exercises the path. |
| Clear deletes vehicleId sibling | GIVEN `?vehicleId=uuidV`, banner rendered → click Clear → `params.delete("vehicleId")`, banner hidden, sibling params intact | PASS | `VehicleSelector.tsx:139-149` `clear()` clones `searchParams.toString()` into `URLSearchParams`, deletes `vehicleId`, pushes `${pathname}?${query}` with `{ scroll: false }`. `SelectedBanner` (lines 254-275) and `ClearButton` (lines 281-292) both early-return `null` when `selected` is null / no `selectedId`, so the banner hides automatically once the URL drops `vehicleId`. `VehicleSelector.test.tsx` "click Clear → URL without vehicleId + all siblings preserved" covers the path. |
| Tampered / foreign vehicle | GIVEN `?vehicleId=uuidV-other-user` or `?vehicleId=garbage` → guard `vehicles.some(...)` fails → no `aria-checked=true`, banner hidden, no 500 | PASS | `VehicleSelector.tsx:108-122` double-guard `vehicleIdSchema.safeParse` + `vehicles.some(v => v.id === candidate && v.customerId === userId)`. `vehicleId.test.ts` covers the schema layer (UUID accept/reject/empty/non-throwing; `isOwner` true/false). `VehicleSelector.test.tsx` "URL ?vehicleId=garbage → no aria-checked, banner hidden, no 500" + "URL ?vehicleId=<foreign-uuid> → no aria-checked, banner hidden, no 500" cover the island layer. `page.test.tsx` "foreign ?vehicleId= → BookingForm NOT composed (isOwner fails)" covers the page-layer guard. |

### Requirement: R3 — Confirm/Submit Compound + POST /api/appointments (REQ-BOOK-03)

**Source:** `openspec/specs/booking-form/spec.md` → Requirement: Confirm/Submit Compound + POST /api/appointments.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| All 4 valid → submit → 201 → navigate to T-044 | GIVEN valid `serviceId`+`date`+`slot`+`vehicleId` → click Confirm → fetch POST 201 TurnoDTO → `router.push("/appointments?confirmed="+dto.id,{scroll:false})`, `aria-busy=true` during flight | PASS | `BookingForm.tsx:90-148` `handleSubmit` calls `submitBooking({vehicleId, serviceId, startDateTime: buildBookingStartDateTime(date, slot)})` → on 201 `router.push(`/appointments?confirmed=${dto.id}`, { scroll: false })`. `appointments.ts:112-156` `submitBooking` POSTs JSON with `credentials:"include"`, `cache:"no-store"`, `Content-Type:"application/json"` and parses `TurnoDTOJson` (camelCase + ISO). `BookingForm.tsx:213-232` Submit renders `<button type="button" disabled={isPending} aria-busy={isPending}>`. Tests `BookingForm.test.tsx` "click → submitBooking called with TZ-corrected startDateTime" + "201 → router.push('/appointments?confirmed=' + id, scroll:false)" + "Submit enabled + aria-busy=false default" cover the happy path. `appointments.test.ts` "POSTs to /api/appointments with credentials+no-store+JSON content-type" + "returns parsed TurnoDTOJson on 201 — camelCase + ISO, no Spanish leak" cover the helper. |
| 0 vehicles → Confirm disabled + CTA | GIVEN `vehicles.length===0` → Submit absent or `disabled`, CTA "Add a vehicle to book" → `/vehicles` | PASS | `page.tsx:174-202` short-circuits BEFORE rendering `BookingForm` — when `vehicles.length === 0` the CTA branch returns with only the `booking-empty-vehicles` Link. `BookingForm` is never composed, so the Submit button never renders. Tests "zero vehicles → CTA to /vehicles, no DateSelector, no AvailabilitySlots" + "zero vehicles → no availability fetch" confirm. |
| 409 race → inline banner + refetch slots | GIVEN server returns 409 `APPOINTMENT_NOT_AVAILABLE` → fetch rejects `ApiError {code: APPOINTMENT_NOT_AVAILABLE}` → `ErrorBanner` `role="alert"` "El horario seleccionado ya no se encuentra disponible", `router.refresh()` re-runs T-042 fetch, siblings intact | PASS | `BookingForm.tsx:97-103` handles `case "APPOINTMENT_NOT_AVAILABLE"` with `setError("El horario seleccionado ya no se encuentra disponible")` + `router.refresh()`. `ErrorBanner` (lines 238-258) renders `role="alert"`. `appointments.ts:87-95` maps 409 → `CONFLICT` when no envelope; the server route `src/app/api/appointments/route.ts:93-97` returns `APPOINTMENT_NOT_AVAILABLE` when `AppointmentNotAvailableError` is thrown. `BookingForm.test.tsx` "409 → Spanish banner + router.refresh() (no navigation)" asserts the mapping. `appointments.test.ts` "409 APPOINTMENT_NOT_AVAILABLE — slot was taken in a race" covers the helper. |
| 403 ownership → clear ?vehicleId= + banner | GIVEN server returns 403 (vehicle tampered between SSR and submit) → fetch rejects `ApiError {code: FORBIDDEN}` → `ErrorBanner` "Vehicle not found or not owned", `params.delete("vehicleId")`, VehicleSelector re-renders unselected, siblings preserved | PASS | `BookingForm.tsx:104-118` handles `case "FORBIDDEN"` with `setError("Vehicle not found or not owned")` + `params.delete("vehicleId")` + `router.push(...?{query}, {scroll:false})` + `router.refresh()`. Sibling preservation: `params.delete` only drops `vehicleId`; `serviceId`, `date`, `slot` survive in the URL. `BookingForm.test.tsx` "403 → banner + delete vehicleId + refresh" covers the path. `appointments.test.ts` "403 FORBIDDEN — vehicleId not owned by session user" covers the helper. |
| Idempotent submit | GIVEN user double-clicks Confirm rapidly → first click in flight → button `disabled`+`aria-busy=true`; second click no-op; only 1 INSERT (server REPEATABLE READ + EXCLUDE gist also guards) | PASS | `BookingForm.tsx:88-89` early-return `if (isPending) return;` belt-and-suspenders (React state update vs. second click race). `BookingForm.tsx:221` `disabled={ctx.isPending}` + `aria-busy={ctx.isPending}` is the UX half. Server `appointmentService.createAppointment` enforces `REPEATABLE READ` + `EXCLUDE gist` (INV-04) — untouched by T-043. `BookingForm.test.tsx` "double-click during pending → only 1 submitBooking call (idempotency via disabled+aria-busy + handler early-return)" covers the path. |

### Requirement: R4 — BA Timezone Reconstruction + INV Compliance (REQ-BOOK-04)

**Source:** `openspec/specs/booking-form/spec.md` → Requirement: BA Timezone Reconstruction + INV Compliance.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| BA -03:00 wall-clock → UTC | GIVEN `?date=2026-09-10&slot=09:30` → BookingForm builds `startDateTime` → `"2026-09-10T09:30:00-03:00"`; server stores `TIMESTAMPTZ "2026-09-10T12:30:00.000Z"`; not host-TZ derived | PASS | `appointments.ts:182-186` `buildBookingStartDateTime(date, slot)` returns `${date}T${slot}:00-03:00` (BA fixed since Law 26.474, no DST since 2009). `route.ts:27-28` regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$` accepts the form; `bodySchema.transform((val) => new Date(val))` (line 38) parses to UTC `TIMESTAMPTZ`. `appointments.test.ts` "buildBookingStartDateTime → returns `${date}T${slot}:00-03:00` for any (date, slot) pair" + "matches the route.ts:27 regex — Zod accepts the result without 400" + "`Intl` offset-delta confirms BA is UTC-3 today (INV-06 regression guard)" + "BA offset is -03:00 for both winter (Jul) and BA-summer (Jan) anchors" cover the helper + DST safety regression. `BookingForm.test.tsx` "click → submitBooking called with TZ-corrected startDateTime (`2026-09-10T09:30:00-03:00` for date=2026-09-10&slot=09:30)" covers the wire contract. |
| All 4 selections preserved through chain | GIVEN `serviceId`+`date`+`slot`+`vehicleId` all valid → navigating/refreshing/sharing URL → RSC re-resolves all 4; BookingForm enables; primitives only cross server→client | PASS | `page.tsx:245-275` derives `selectedSlot` (slotSchema + `availableSlots.includes`) + `selectedVehicle` (vehicleIdSchema + `isOwner` defense in depth) and only renders `<BookingForm>` when ALL FOUR selections resolve. `BookingForm.tsx:60-67` accepts primitive props only (`serviceId`/`vehicleId`/`date`/`slot` strings + `serviceName`/`vehicleLabel` labels). `page.test.tsx` "all 4 valid (service + date + slot + vehicle) → BookingForm is composed with primitive props" + "missing slot → BookingForm NOT composed (only 3 of 4 resolve)" + "tampered slot (`25:00`) → BookingForm NOT composed (slotSchema rejects)" + "foreign ?vehicleId= → BookingForm NOT composed (isOwner fails)" cover the resolution gate. |

## Gate Results

All four required gates executed against master tip `2225eb7`. Targeted
vitest covers the T-043 scope; full-repo vitest is the regression smoke.

| Gate | Command | Exit | Summary | Evidence hash |
| --- | --- | --- | --- | --- |
| Tests (T-043 scope) | `pnpm vitest run 'src/app/(customer)/appointments/new/' 'src/lib/api/appointments' 'src/lib/validators/vehicleId'` | 0 | 9 files / 152 tests PASS | `sha256:18d6037fab06ac05959049d2d85c69fa04b5a3544c53edef8c3247bdba607b5e` |
| Tests (full repo) | `pnpm vitest run` | 1 | 11 files fail / 71 pass / 1 skipped (83); **50 tests fail / 1204 pass / 2 skipped (1256)**. All 50 failures are pre-existing DB integration tests with `connect ECONNREFUSED ::1:5432` / `127.0.0.1:5432` (Postgres not running locally) under `src/db/__tests__/{vehiculos,turnos,t015}.integration.test.ts` + `tests/integration/*.test.ts`. Zero regressions introduced by T-043 — baseline identical to PR1 `3366615` and PR2 `df6fb8a` per `apply-progress.md:227-241`. | `sha256:e20010708711504896f2e5c335fa65a5fbaa3c2466e9833dac68c9028dae1688` |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`) | 0 | 0 errors across the project. `tsconfig.json` excludes `tests/e2e/**` per T-042 precedent. | `sha256:98438138113107a4b7b997d7015ae152f5b0b4b09ee1e6d809c6eebb3f29f010` |
| Build | `pnpm build` | 0 | Next.js 16.3.2 (Turbopack) Compiled successfully; TypeScript 4.6s; 11 static pages generated; `/appointments/new` listed as `ƒ` (Dynamic, server-rendered on demand — `force-dynamic` + `revalidate=0` preserved). Route table unchanged from baseline. | `sha256:b32fcf85184dd0da9a5ca9ee3e538b32fb63d2e05155498455e28cfdf803a145` |
| Lint | `pnpm lint` | 1 | **21 problems (2 errors, 19 warnings)** — identical to master baseline `eb4bad0` and to PR1 `3366615` + PR2 `df6fb8a`. The 2 errors are pre-existing: `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:61:21` (`react-hooks/set-state-in-effect`, T-039-introduced) + `src/lib/http/appointmentQuery.ts:55:7` (`prefer-const`, master baseline). **Zero new errors or warnings introduced by T-043** (verified via `pnpm lint 2>&1 | Select-String -Pattern "appointments.ts|BookingForm|SummaryCard|appointments/new/page|vehicleId|appointments.module"` → empty result). | `sha256:3d92e0f56bfb4c2b86bd28ae1a00a5a26a15015a26172035b4a949881d738f53` |

### T-043 test breakdown (152/152)

- `src/lib/validators/vehicleId.test.ts` — **11 tests** (UUID accept canonical / accept different UUIDs / reject garbage / reject empty / reject no-dashes / `safeParse` never throws on weird inputs (3) — total 6 schema + 5 ownership).
- `src/lib/api/appointments.test.ts` — **18 tests** (happy path 2 — POST shape + parsed `TurnoDTOJson` no-leak; envelope mapping 8 — 409/403/422/401/400 + 409 no-body CONFLICT + 422 no-body INVALID_SERVICE + 5xx no-body UNKNOWN_ERROR; network 1; `buildBookingStartDateTime` 4 — happy paths + regex + `Intl` regression guard Jan+Jul DST safety; `buildLoginNext` 4 — basic + empty search + no-siblings + slot-colon encoding `09:30` → `09%3A30`).
- `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` — **14 tests** (jsdom + RTL + `userEvent` — radiogroup render + select preserves siblings + clear preserves siblings + tampered UUID + foreign UUID + empty CTA + SelectedBanner self-hiding + ClearButton self-hiding + compound throwaway on use outside provider + others).
- `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` — **19 tests** (jsdom + RTL + `userEvent` — compound statics exposed + Summary 4 rows + Submit enabled default + ErrorBanner absent default + INV-08 no-leak + click → submitBooking TZ-corrected + 201 → navigate + 201 with siblings doesn't leak + 409 Spanish banner + refresh + 403 banner + delete vehicleId + 422 banner + delete serviceId + push /services + 401 → assign login + 400 verbatim + NETWORK_ERROR + unmapped 5xx + double-click only-1-call idempotency + auto-dismiss + dismiss button + throw outside BookingForm).
- `src/app/(customer)/appointments/new/page.test.tsx` — **30 tests** total (T-041 14 + T-042 6 + T-043 PR1 5 + T-043 PR2 5 = 30; full file passes; T-043-specific 10 described inline above). Plus the existing T-041/T-042 blocks continue to pass — no regressions from T-043 page.tsx additions.
- Other files in the `src/app/(customer)/appointments/new/` directory (DateSelector.test.tsx + AvailabilitySlots.test.tsx + loading.test.tsx + error.test.tsx) — all pass; untouched by T-043.

## RDD Receipts

Per RDD contract, PR1 + PR2 both burned receipts before merge.

- **PR1** commit `3366615 fix(appointments): T-043 PR1 R3-001 — VehicleSelector.select preserves URL siblings` — lineage review `201163b3666b54d4` — **APPROVED after R3-001 correction** (VehicleSelector.select used to clone `URLSearchParams(window.location.search)` which dropped `date` / `slot` siblings; fix clones the live `useSearchParams()` value instead — `+8/-2` LOC). The R3-001 correction is the only review-triggered change in the T-043 chain.
- **PR2** commit `df6fb8a feat(appointments): T-043 PR2 booking form (submit + 409/403/422/401)` — lineage review `6c940808be3454be` — **APPROVED with 3 advisory findings**:
  - **R3-001 (WARNING)** — `appointments.ts` `isErrorBody` predicate initially used a locally-inferred type; corrected to import `ApiErrorBody` from `@/lib/validators/service` (mirror of `lib/api/vehicles.ts:42`).
  - **R3-002 (SUGGESTION, informational)** — `BookingForm.test.tsx` could add a `BookingFormSubmit` outside-`<BookingForm>` throw-loud assertion; deferred (compound API contract already enforced by `useBookingContext` throw at `BookingForm.tsx:74-79`).
  - **R3-003 (SUGGESTION, informational)** — `page.tsx:296` derives `vehicleLabel` with `${brand} ${model} (${year}) — ${plate}` inline; could be hoisted to a helper. Deferred (single-use site; not yet worth the indirection).
- **PR3** commit `0111953 chore(docs): commit T-043 PR2 SDD tracker artifacts` — apply-progress + spec + design + tasks + proposal mirrored to `openspec/` and `sdd/` per T-041 / T-042 precedent.
- Receipts burned per RDD contract. All receipts valid.

## Invariant Compliance

| Invariant | Verified | Evidence |
| --- | --- | --- |
| INV-01 capacity 1 | PASS | Server `appointmentService.createAppointment` (untouched by T-043) enforces `REPEATABLE READ` + `EXCLUDE USING gist` count-based capacity check. Client `page.tsx:198` passes `config.capacityPerSlot` through to the availability adapter; never hardcoded in T-043. |
| INV-02 states UPPER_SNAKE | PASS | `appointments.ts:54` declares `status: string` in `TurnoDTOJson`; the only states produced server-side (via `appointmentService`) are `PENDIENTE | CONFIRMADO | RECHAZADO | CANCELADO` (INV-02). Tests assert `status: "PENDIENTE"` literal in the happy-path DTO. No state transitions on the client — submit either succeeds or fails. |
| INV-03 ownership | PASS | Three-layer ownership guard: (a) RSC `page.tsx:109-117` `listVehiclesByCustomer(db, userId)` filters at the DB layer; (b) page derivation `page.tsx:267-275` re-checks `isOwner(v, userId)` so a tampered URL collapses to `null`; (c) island `VehicleSelector.tsx:108-122` re-runs `vehicleIdSchema.safeParse` + `vehicles.some(v => v.id === candidate && v.customerId === userId)`. Server route `src/app/api/appointments/route.ts:42-55` `requireAuth` enforces ownership via `vehiculo.clienteId == authUser.id` regardless. Tests: `vehicleId.test.ts` (11), `VehicleSelector.test.tsx` (tampered + foreign), `page.test.tsx` (foreign ?vehicleId= → BookingForm NOT composed). |
| INV-04 `REPEATABLE READ` + `EXCLUDE USING gist` | PASS | Server `appointmentService.createAppointment` (untouched) enforces. Client idempotency: `BookingForm.tsx:88` early-return `if (isPending) return` + `BookingForm.tsx:221` `disabled={isPending}` + `aria-busy={isPending}`. `BookingForm.test.tsx` "double-click during pending → only 1 submitBooking call" verifies the client gate; server guard is correctness for the actual race. |
| INV-05 slotSchema + duration filter | PASS | `page.tsx:262-265` `selectedSlot = availableSlots !== null && slotSchema.safeParse(candidateSlot).success && availableSlots.includes(candidateSlot) ? candidateSlot : null`. `slotSchema` rejects malformed times (e.g. `25:00` — covered by `page.test.tsx` "tampered slot (`25:00`) → BookingForm NOT composed"). Duration filter: `page.tsx:198` passes `config.slotStepMinutes` and `selectedService.durationMinutes` to `getAvailableSlotsForDate`; domain `calculateEndAndValidate` rejects `fechaHoraFin > finIntervaloOperativo` (already covered by T-042 tests). |
| INV-06 BA -03:00 TZ | PASS | `appointments.ts:182-186` `buildBookingStartDateTime(date, slot) = ${date}T${slot}:00-03:00` (BA fixed since Law 26.474, no DST since 2009). `appointments.test.ts` 4 TZ tests cover happy paths + `route.ts:27` regex match + `Intl` offset-delta regression guard for both Jan and Jul anchors. **Never `new Date(`${date}T${slot}`).toISOString()`** — explicitly forbidden by spec. `TODO(DST)` escape hatch to `slotGenerator.baWallTimeToUtcDate` documented in `appointments.ts:171-175`. |
| INV-07 DAG acyclic | PASS | T-043 sits between T-039/040/041/042 (DONE) and T-044 (successor). No cycle introduced. `tasks.md:96-100` DAG shows acyclic edges `1.9→2.1→…→2.10→3.1→3.2→3.3`. T-044 dependency documented at `tasks.md:103` ("Successor: T-044 reads `?confirmed=<turnoId>` on `/appointments`"). |
| INV-08 camelCase English + ISO + DTO mapping | PASS | `page.tsx:296-307` `toVehicleJson` mapper emits `VehicleDTOJson` (camelCase English + ISO strings); `appointments.ts:45-60` `TurnoDTOJson` is camelCase English + ISO. Forbidden keys asserted absent in `page.test.tsx` (vehicles wire no-leak + BookingForm compose no-leak) and `appointments.test.ts` (201 happy path no-leak): `marca / modelo / anio / patente / cliente_id / vehiculo_id / servicio_id / fecha_hora_inicio / fecha_hora_fin / estado / created_at / updated_at / fechaHoraInicio / fechaHoraFin / nombre / descripcion / duracionMinutos / activo / fecha`. |

## Warnings & Caveats

The verdict is **pass_with_warnings** because three non-blocking gaps
are documented. None block archive.

1. **WARNING — `size:exception` (PR1 1228 + PR2 ~2031 = ~3259 / 400 budget).**
   The realized review budget for the T-043 chain exceeded the 400-line
   single-PR forecast documented in `proposal.md:106-108` and
   `design.md:58-60`. The chain split was applied (PR1 = VehicleSelector +
   page wiring; PR2 = BookingForm + helper + Summary + errors + e2e) per
   `tasks.md:18-23` decision rule, but each individual PR still ran over
   budget when measured in raw `src/` insertions. The T-041 / T-042
   precedent ("chain split not viable atomically when page already
   imports the new compound") was followed — `apply-progress.md:96-104`
   documents PR1's overrun (1228 vs ~290) and `apply-progress.md:278-306`
   documents PR2's overrun (~1050 vs ~280). PR2 ships as one atomic
   commit because splitting the submit pipeline from the helper would
   leave an orphan `BookingForm` import on the page. **Rollback path
   documented**: `git revert 2225eb7` is single-commit, additive branch
   inside the 4-selection `selectedService && selectedDate && selectedSlot
   && selectedVehicle` gate; no DB / API / state-machine change.

2. **WARNING — `harness:gap` (Playwright not provisioned).**
   `tests/e2e/t043-booking-form.spec.ts` (98 lines, 6 specs covering the
   "All 4 selections → 201", "409 race", "403 ownership", "422 service",
   "401 redirect", "Idempotent" scenarios) ships as the design artifact,
   excluded from `vitest.config.ts -> exclude: ["tests/e2e/**"]` and
   `tsconfig.json -> exclude: ["tests/e2e/**"]` per T-042 precedent.
   `pnpm lint` confirms the file does not pollute any gate output. To
   enable the e2e gate: (a) add `@playwright/test` to devDependencies,
   (b) add a `playwright.config.ts` rooted at `tests/e2e/`, (c) drop the
   two exclusion lines.

3. **INFO — pre-existing infra gap (Postgres not running).**
   11 vitest files / 50 tests fail with `connect ECONNREFUSED
   ::1:5432 / 127.0.0.1:5432` (Postgres not running locally). These are
   DB integration tests under `src/db/__tests__/{vehiculos,turnos,t015}`
   and `tests/integration/*`. **Identical to master baseline `eb4bad0`
   and to PR1 `3366615` + PR2 `df6fb8a`** — zero regressions introduced
   by T-043. Out of scope for this verification.

## Files Inspected

| Path | Role | Changed by 2225eb7 |
| --- | --- | --- |
| `src/lib/validators/vehicleId.ts` | Client-safe Zod `vehicleIdSchema = z.string().uuid()` + `isOwner` guard (INV-03) | yes |
| `src/lib/validators/vehicleId.test.ts` | 11 vitest unit tests (UUID accept/reject + isOwner true/false) | yes |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.tsx` | "use client" compound `{Root, List, Card, SelectedBanner, ClearButton, Empty}` mirroring `ServiceSelector` / `AvailabilitySlots` (337 LOC) | yes |
| `src/app/(customer)/appointments/new/_components/VehicleCard.tsx` | Atomic `<button type="button" role="radio" aria-checked>` radio card (66 LOC) | yes |
| `src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx` | 14 jsdom + RTL + `userEvent` tests (270 LOC) | yes |
| `src/app/(customer)/appointments/new/_components/BookingForm.tsx` | "use client" compound `{Root, Summary, Submit, ErrorBanner}` with `isPending` gate + 201/409/403/422/401 envelope (360 LOC) | yes |
| `src/app/(customer)/appointments/new/_components/SummaryCard.tsx` | Atomic 4-row read-only recap (delegated as `<BookingForm.Summary />`, 73 LOC) | yes |
| `src/app/(customer)/appointments/new/_components/BookingForm.test.tsx` | 19 jsdom + RTL + `userEvent` tests (510 LOC) | yes |
| `src/app/(customer)/appointments/new/page.tsx` | RSC shell + Promise.all extends with `listVehiclesByCustomer` + `selectedSlot` / `selectedVehicle` derivation + BookingForm composition when all 4 valid (188 LOC) | yes |
| `src/app/(customer)/appointments/new/page.test.tsx` | RSC integration: 14 T-041 + 6 T-042 + 5 T-043 PR1 + 5 T-043 PR2 (371 LOC; full file 30 tests) | yes |
| `src/app/(customer)/appointments/new/appointments.module.css` | Adds `.vehicleList/.vehicleCard/.vehicleSelected/.vehicleEmpty/.vehicleEmptyCta/.bookingSection/.summary/.summaryList/.summaryRow/.summaryLabel/.summaryValue/.submit/.submitPending/.submit:disabled/.errorBanner/.errorBannerDestructive/.errorBannerBody/.errorBannerDismiss` (247 LOC) | yes |
| `src/lib/api/appointments.ts` | `submitBooking({vehicleId, serviceId, startDateTime})` POST helper + `buildBookingStartDateTime` + `buildLoginNext` (205 LOC) | yes |
| `src/lib/api/appointments.test.ts` | 18 vitest unit tests (201 + 409/403/422/401/400 + network + TZ + login helper) (408 LOC) | yes |
| `tests/e2e/t043-booking-form.spec.ts` | Playwright e2e artifact (excluded per T-042 precedent, 98 LOC) | yes |
| `src/app/api/appointments/route.ts` | Server route (POST + GET) — **UNCHANGED** by T-043 (already exists since T-039) | no (reused) |
| `src/services/appointmentService.ts` | `createAppointment` atomic `REPEATABLE READ` + `EXCLUDE gist` — **UNCHANGED** by T-043 (INV-04 correctness half) | no (reused) |
| `src/services/vehicleService.ts` | `listVehiclesByCustomer` — **UNCHANGED** by T-043 (RSC server-direct DI) | no (reused) |
| `src/db/mappers/vehiculo.ts` | `VehiculoDTO` shape — **UNCHANGED** by T-043 (server DTO) | no (reused) |
| `src/lib/api/vehicles.ts` | `VehicleDTOJson` type — **UNCHANGED** by T-043 (used by `page.tsx:toVehicleJson`) | no (reused) |
| `src/lib/http/errors.ts` | `toErrorBody` + `ERROR_CODES` envelope — **UNCHANGED** by T-043 (consumed by `appointments.ts`) | no (reused) |
| `src/lib/validators/service.ts` | `ApiError` + `ApiErrorBody` — **UNCHANGED** by T-043 (consumed by `appointments.ts:isErrorBody`) | no (reused) |
| `src/services/availability/availabilityService.ts` | `getAvailableSlotsForDate` + `FetchActiveTurnos` — **UNCHANGED** by T-043 (T-042 adapter) | no (reused) |
| `src/services/availability/slotGenerator.ts` | `formatSlotsAsHHmm` + `generateSlotsForDate` — **UNCHANGED** by T-043 (BA wall-clock domain) | no (reused) |
| `src/lib/validators/slot.ts` | `slotSchema` — **UNCHANGED** by T-043 (T-042 schema) | no (reused) |
| `src/lib/validators/date.ts` | `dateSchema` + `getTodayBaYmd` + `isPastBa` + `addBaDays` + `getBaDayUtcRange` — **UNCHANGED** by T-043 (T-041 schema) | no (reused) |
| `src/lib/auth/auth.ts` | `auth()` — **UNCHANGED** by T-043 (INV-03 guard) | no (reused) |
| `src/config/workshopConfig.ts` | `getWorkshopConfig` — **UNCHANGED** by T-043 (DI source) | no (reused) |
| `src/app/(customer)/appointments/new/loading.tsx` + `error.tsx` | Segment boundaries — **UNCHANGED** by T-043 (T-041 reused) | no (reused) |

### Diff stat (2225eb7 vs eb4bad0)

```
 .../changes/t043-booking-form/apply-progress.md    | 410 ++++++++++++++++
 openspec/changes/t043-booking-form/design.md       | 117 +++++
 openspec/changes/t043-booking-form/exploration.md  | 161 ++++++++
 openspec/changes/t043-booking-form/proposal.md     | 118 +++++
 openspec/changes/t043-booking-form/spec.md         | 123 +++++
 openspec/changes/t043-booking-form/tasks.md        | 113 +++++
 openspec/specs/booking-form/spec.md                | 123 +++++
 sdd/t043-booking-form/apply-progress.md            | 464 ++++++++++++++++++++
 src/app/(customer)/appointments/new/_components/BookingForm.test.tsx | 510 ++++++++++++
 src/app/(customer)/appointments/new/_components/BookingForm.tsx   | 360 ++++++++++++++
 src/app/(customer)/appointments/new/_components/SummaryCard.tsx   |  73 ++++
 src/app/(customer)/appointments/new/_components/VehicleCard.tsx   |  66 ++++
 src/app/(customer)/appointments/new/_components/VehicleSelector.test.tsx | 270 ++++++++++
 src/app/(customer)/appointments/new/_components/VehicleSelector.tsx | 337 ++++++++++++++
 src/app/(customer)/appointments/new/appointments.module.css | 247 ++++++++++
 src/app/(customer)/appointments/new/page.test.tsx | 371 +++++++++++++-
 src/app/(customer)/appointments/new/page.tsx      | 188 +++++++-
 src/lib/api/appointments.test.ts                  | 408 ++++++++++++++++++
 src/lib/api/appointments.ts                       | 205 +++++++++
 src/lib/validators/vehicleId.test.ts              |  82 +++++
 src/lib/validators/vehicleId.ts                   |  54 ++++
 tests/e2e/t043-booking-form.spec.ts               |  98 +++++
 22 files changed, 4882 insertions(+), 16 deletions(-)
```

## Recommendation

**PASS — T-043 is ready for archive.**

T-043 closes FASE 8 UI-04 (FL-01 booking flow steps 2–6). The
4-selection booking form on `/appointments/new` resolves URL-canonically
across refresh / back / share, posts `JSON` to `POST /api/appointments`
on Confirm, and navigates to `/appointments?confirmed=<id>` on 201 (T-044
reads the query). INV-03 / INV-04 / INV-05 / INV-06 / INV-08 all hold
with explicit per-invariant test coverage. T-044 is the next dependency
in the DAG and is unblocked.

Next dispatcher hop: `sdd-archive` (sync delta specs to
`openspec/specs/booking-form/spec.md`, move change to
`openspec/changes/archive/2026-09-01-t043-booking-form/`).
