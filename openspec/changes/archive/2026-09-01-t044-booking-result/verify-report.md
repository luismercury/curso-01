```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:839dfa9cffcba03e2fc0dd15f06cd433e8f37edca8bcbaa71e1d59b9e1c9081d
verdict: pass
blockers: 0
critical_findings: 0
requirements: 3/3
scenarios: 11/11
test_command: pnpm vitest run --project node --project jsdom src/lib/validators/confirmedId.test.ts src/domain/__tests__/appointmentStateMachine.test.ts "src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx" "src/app/(customer)/appointments/page.test.tsx"
test_exit_code: 0
test_output_hash: sha256:5ae32e9ae86661297aab1450c9786d5c93fa775a2f0200ef7a764bd33dc91040
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:838450ad78e68a4ab2cc7047ba35a5bdd6dd01d8dc871a2e4e730a9058ec4836
```

> Hybrid artifact (Engram + filesystem). Per-cycle independent verification
> of the SDD change at HEAD of master (= `44a58f8`).
> Hybrid topic key `sdd/t044-booking-result/verify-report`.
>
> Commit under verify: `44a58f8 feat(booking-result): merge T-044 — 3 ADDED 11 GWT PASS`
> (merge of feature `cae2e8e feat(appointments): T-044 booking result banner + list
> (RSC + ownership 404 + Suspense dismiss)`).
> Master baseline: `bde0321` (T-043 booking form).
> Spec: `openspec/changes/t044-booking-result/spec.md` (canonical pointer to
> `openspec/specs/booking-result/spec.md` created at archive time) — 3 ADDED
> requirements, 11 GWT scenarios.
> Design: `openspec/changes/t044-booking-result/design.md` — 11 architecture
> decisions (D1–D11).
> Tasks: `openspec/changes/t044-booking-result/tasks.md` — 10 tasks across
> 3 phases (Phase 1 prod = 6, Phase 2 tests = 2, Phase 3 verify+archive = 2).
> All `1.x` and `2.x` marked `[x]`; `3.1` is this report's deliverable.
> Apply-progress: `openspec/changes/t044-booking-result/apply-progress.md`
> (single work-unit commit, 397 prod+test insertions, RDD receipt burned
> via lineage `review-bb827ad9d168cb8e`).

`gentle-ai sdd-verify-validate --requirements 3 --scenarios 11` admits the
envelope above as `valid: true`, `verdict: pass`. The `evidence_revision`
is the SHA-256 of the merge commit SHA
`44a58f89da8321708d9a98c7ca71fcee52b820e2`.

## Verdict

**pass** — T-044 closes FASE 8 UI-05 (FL-01 step 9 — booking result
feedback) and consumes the URL-canonical `?confirmed=<id>` handoff from
T-043. All 3 ADDED requirements and all 11 GWT scenarios are covered with
explicit per-scenario test evidence. INV-02 / INV-03 / INV-06 / INV-08
all hold. The Next.js `useSearchParams` CSR-bailout threat is mitigated
by `<Suspense fallback={null}>` wrapping the `BookingConfirmation` client
island. Five threat-matrix rows are addressed with RED tests.

| Dimension | Result |
| --- | --- |
| Spec coverage | 3/3 ADDED requirements, 11/11 GWT scenarios |
| Tasks completion | 8/8 production + test tasks (1.1–1.6, 2.1–2.2); 3.1 is this report |
| T-044 vitest (targeted) | 4 files / 63 tests PASS |
| TypeScript (`tsc --noEmit`) | 0 errors across the project |
| Next.js build | `ƒ /appointments` Dynamic (force-dynamic + revalidate=0 honored) |
| ESLint | 21 problems (2 errors, 19 warnings) — **0 from T-044 files** (baseline identical) |
| Full repo vitest | 50 fail / 1229 pass / 2 skipped — all 50 pre-existing DB integration failures (`ECONNREFUSED ::1:5432`), identical to master baseline |
| INV-02 / 03 / 06 / 08 + Suspense | All pass with explicit per-invariant evidence |
| RDD receipt | burned: lineage `review-bb827ad9d168cb8e` (4 advisory informational only) |
| Final verdict | **PASS** |

## Specification Coverage

Each ADDED requirement from `openspec/changes/t044-booking-result/spec.md`
is mapped to its GWT scenarios, the source location, and the
implementation evidence. The canonical spec
`openspec/specs/booking-result/spec.md` does not yet exist — it is
created at `sdd-archive` time per the SDD lifecycle.

### Requirement: R1 — RSC Confirmed Param Parsing and Ownership-Scoped Fetch

**Source:** `openspec/changes/t044-booking-result/spec.md` → Requirement:
RSC Confirmed Param Parsing and Ownership-Scoped Fetch.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| R1.1 — Valid owned UUID fetches turno | GIVEN `auth` ok, `?confirmed=<own-uuid>` valid, turno `PENDIENTE` owned → RSC resolves → `TurnoDTOJson` camelCase/ISO available; no `estado`/`fecha_hora_inicio` leak | PASS | `page.test.tsx:43-50` "valid owned → banner + Suspense + no snake (R1.1, R3.4)" asserts `BookingConfirmationImpl` composed, `Suspense` token present, ISO `2026-09-10T12:30:00.000Z` in tree, and SNAKE constant absent. `page.tsx:39-56` `await searchParams` + `parseConfirmedId` + `Promise.all` + `getAppointmentById`. `page.tsx:21-27` `toJson` maps `TurnoDTO` → `TurnoDTOJson` (camelCase + ISO). `appointmentService.ts:249-257` `getAppointmentById` calls `loadOr404` + `assertOwnership` (requireAuth.ts:84-87). |
| R1.2 — Invalid UUID skips fetch | GIVEN `?confirmed=not-a-uuid` or XSS payload → `safeParse` fails → no DB call, no banner, no throw, plain text only | PASS | `page.test.tsx:52-58` it.each `['not-a-uuid', '<script>alert(1)</script>']` asserts `getAppointmentById` (`B`) not called, no `BookingConfirmationImpl`, list still rendered. `confirmedId.test.ts:7-14` it.each validates UUID accept / non-UUID reject / empty reject / XSS reject. `confirmedId.test.ts:26-28` `parseConfirmedId(42 as never)` never throws. `confirmedId.ts:5-12` `parseConfirmedId` returns `null` on non-string / empty / failed `safeParse` without throwing. |
| R1.3 — Foreign UUID maps 403→404 generic | GIVEN `?confirmed=<other-user-uuid>` valid but `assertOwnership` throws `ForbiddenError` → caught → neutral "Turno no disponible", no 403 body, no `customerId` echo | PASS | `page.test.tsx:60-65` "foreign UUID + error → banner absent, no leak (R1.3)" asserts no `BookingConfirmationImpl` and asserts the foreign UUID string `FR` not present in the tree (no `customerId` echo). `page.tsx:34-37` `fetchConfirmed` isolated `try { getAppointmentById } catch { return null }` maps both `ForbiddenError` and any other throw to `null` (404 semantics). `requireAuth.ts:32-39` `ForbiddenError` with `status = 403, code = "FORBIDDEN"`. |
| R1.4 — Unknown UUID maps 404 generic | GIVEN `?confirmed=<unknown-uuid>` valid but `findTurnoById` null → `AppointmentNotFoundError` → caught → same neutral outcome | PASS | `page.test.tsx:67-72` "unknown UUID → banner absent (R1.4)" asserts no banner and unknown UUID `UN` not present. Same `fetchConfirmed` try/catch at `page.tsx:34-37` maps `AppointmentNotFoundError` (errors.ts:127-139, `code: "APPOINTMENT_NOT_FOUND"`) to `null`. |

### Requirement: R2 — Success Banner Rendering and Dismiss

**Source:** `openspec/changes/t044-booking-result/spec.md` → Requirement:
Success Banner Rendering and Dismiss.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| R2.1 — PENDIENTE/CONFIRMADO shows success with TZ | GIVEN owned `PENDIENTE` (or `CONFIRMADO` post-admin) `startDateTime="2026-09-10T12:30:00.000Z"` UTC → banner renders with `config.timezone` → shows `09:30` BA via `Intl`, `role="status"` `aria-live="polite"` present | PASS | `BookingConfirmation.test.tsx:41-47` "PENDIENTE → role=status + aria-live + Intl BA 09:30" asserts `role="status"`, `aria-live="polite"`, and `09:30` / `9:30` regex match in details text content. `BookingConfirmation.tsx:18-21` `new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" })` uses `timezone` prop. `BookingConfirmation.tsx:30` banner renders `<section role="status" aria-live="polite" data-testid="booking-confirmation-banner">`. `page.tsx:65` `timezone={config.timezone}` from `getWorkshopConfig(db)`. `page.tsx:21-27` `toJson` emits ISO across boundary. |
| R2.2 — Dismiss strips only confirmed | GIVEN `/appointments?confirmed=<uuid>&page=2&limit=20` → click dismiss → `router.replace("/appointments?page=2&limit=20",{scroll:false})`, siblings intact | PASS | `BookingConfirmation.test.tsx:60-65` "strips only `confirmed`, keeps page/limit" sets `mockSearch = URLSearchParams("confirmed=<uuid>&page=2&limit=20")`, clicks Dismiss, asserts `replace` called with `/appointments?page=2&limit=20` (siblings preserved, `confirmed` stripped) and `{ scroll: false }`. `BookingConfirmation.tsx:46-58` `URLSearchParams(sp.toString())` clones, `.delete("confirmed")`, then `router.replace(q.length > 0 ? "/appointments?" + q : "/appointments", { scroll: false })`. |
| R2.3 — Unauthenticated redirects | GIVEN `auth()` null → RSC resolves `/appointments?confirmed=<uuid>` → `redirect("/login")`, no service call | PASS | `page.test.tsx:37-41` "null session → redirect, no service calls" mocks `auth()` to `null`, asserts `NEXT_REDIRECT:/login` thrown, asserts `B` (getAppointmentById) and `L` (listAppointments) **never** called. `page.tsx:40-41` `const session = await auth(); if (!session?.user?.id) redirect("/login");` runs BEFORE the `Promise.all` (line 50), so no service call fires. |

### Requirement: R3 — Fallback Neutral State and List Coexistence

**Source:** `openspec/changes/t044-booking-result/spec.md` → Requirement:
Fallback Neutral State and List Coexistence.

| Scenario | Spec text (summary) | Status | Evidence |
| --- | --- | --- | --- |
| R3.1 — CANCELADO/RECHAZADO shows neutral | GIVEN owned turno `status=CANCELADO` (or `RECHAZADO`) with `?confirmed=<uuid>` → guard evaluates → no success banner, neutral or no banner, no success leak | PASS | `page.test.tsx:74-79` it.each `['CANCELADO', 'RECHAZADO']` asserts no `BookingConfirmationImpl` and the status string not present. `BookingConfirmation.test.tsx:48-51` "CANCELADO → no banner (neutral)" asserts `queryByTestId('booking-confirmation-banner')` is null. `appointmentStateMachine.ts:54-56` `isBannerEligible(status) = status === "PENDIENTE" || status === "CONFIRMADO"`. `page.tsx:55-56` `turnoJson = confirmedTurno !== null && isBannerEligible(confirmedTurno.status) ? toJson(confirmedTurno) : null`. `BookingConfirmation.tsx:28,35,50` re-applies the same guard at each static (defense in depth). |
| R3.2 — Invalid still renders list RN-04 defaults | GIVEN `?confirmed=garbage` + 25 future `PENDIENTE\|CONFIRMADO`, 3 past, 2 `CANCELADO` future → `listAppointments` with `now` UTC, no flags → `data` max 20 future `PENDIENTE\|CONFIRMADO` only, `pagination` correct, no `CANCELADO`/past | PASS | `page.test.tsx:52-58` it.each invalid UUIDs asserts `appointments-list` testid present (list still renders). `page.tsx:46-53` parses `page` and `limit` (defaults 1 / 20), calls `listAppointments({db,config}, {page, limit}, authUser)` in `Promise.all`. `appointmentService.ts:259-275` `listAppointments` injects `customerId=authUser.id` for CLIENTE and `now` if missing; delegates to `findTurnosPaginated` which enforces RN-04 (`PENDIENTE\|CONFIRMADO && startDateTime>now` default, plus `limit 1..100`, `sort asc`, `totalPages`). `page.tsx:73-81` renders `<ol data-testid="appointments-list">` with `serviceId` + `startDateTime.toISOString()` or `<p data-testid="appointments-empty">`. |
| R3.3 — Coexistence preserves both params | GIVEN `/appointments?confirmed=<own-uuid>&page=2` → banner + list page 2 (`offset=20`) visible, then dismiss → after dismiss URL `?page=2` list remains, XSS never executed | PASS | `page.tsx:46-47` parses `page=2` and `limit=20` from `searchParams` alongside `confirmed`. `page.test.tsx:43-50` (R1.1) renders banner + list together. `BookingConfirmation.test.tsx:60-65` (R2.2) confirms dismiss strips only `confirmed` and leaves `page=2&limit=20`. `page.tsx:64-70` `<Suspense fallback={null}>` wraps `BookingConfirmation` so `useSearchParams` in `Dismiss` does not trigger a CSR bailout. `confirmedId.test.ts:11` + `BookingConfirmation.test.tsx:52-56` prove `<script>` payload is rejected at parse and rendered as `&lt;script&gt;` (plain text). |
| R3.4 — DTO shape camelCase ISO | GIVEN row `fecha_hora_inicio` TIMESTAMPTZ `estado=PENDIENTE` → `toTurnoDTO` maps → JSON has `startDateTime`/`endDateTime`/`status`, no `fecha_hora_inicio`/`estado`/`cliente_id` | PASS | `page.test.tsx:24` SNAKE constant lists `cliente_id vehiculo_id servicio_id fecha_hora_inicio fecha_hora_fin estado created_at updated_at fechaHoraInicio fechaHoraFin marca modelo anio patente`. `page.test.tsx:49` `for (const s of SNAKE) expect(j).not.toContain(s)` proves no Spanish / snake_case leak. `page.tsx:21-27` `toJson` emits `TurnoDTOJson` with `id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status, createdAt, updatedAt` all camelCase and `Date.toISOString()`. `db/mappers/turno.ts:22-34` `toTurnoDTO` upstream mapping (untouched by T-044) is the source of those camelCase names. |

## Gate Results

All four required gates executed against master tip `44a58f8`. Targeted
vitest covers the T-044 scope; full-repo vitest is the regression smoke.

| Gate | Command | Exit | Summary | Evidence hash |
| --- | --- | --- | --- | --- |
| Tests (T-044 scope) | `pnpm vitest run --project node --project jsdom src/lib/validators/confirmedId.test.ts src/domain/__tests__/appointmentStateMachine.test.ts 'src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx' 'src/app/(customer)/appointments/page.test.tsx'` | 0 | 4 files / **63 tests PASS** | `sha256:5ae32e9ae86661297aab1450c9786d5c93fa775a2f0200ef7a764bd33dc91040` |
| Tests (full repo) | `pnpm vitest run --project node --project jsdom` | 1 | 11 files fail / 74 pass / 1 skipped (86); **50 tests fail / 1229 pass / 2 skipped (1281)**. All 50 failures are pre-existing DB integration tests with `Cannot read properties of undefined (reading 'id')` under `src/db/__tests__/vehiculos.integration.test.ts` (DB singleton not initialized) and Postgres `ECONNREFUSED` across `tests/integration/*`. **Identical to master baseline `bde0321` and to feature `cae2e8e`** — zero regressions introduced by T-044. | (full suite output, not authoritative for T-044 verdict) |
| Typecheck | `pnpm exec tsc --noEmit` | 0 | 0 errors across the project. Empty stdout/stderr (tsc reports only on failure). | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Build | `pnpm build` | 0 | Next.js `Compiled successfully in 3.6s`. Route table shows `/appointments` as **`ƒ Dynamic`** (server-rendered on demand; `force-dynamic` + `revalidate=0` preserved). `next-env.d.ts` updated to `.next/types/...` (auto-managed). | `sha256:838450ad78e68a4ab2cc7047ba35a5bdd6dd01d8dc871a2e4e730a9058ec4836` |
| Lint | `pnpm lint` | 1 | **21 problems (2 errors, 19 warnings)** — identical to master baseline `bde0321` (also 21/2/19). The 2 errors are pre-existing: `src/app/(customer)/vehicles/_components/VehicleProvider.tsx:61:21` (`react-hooks/set-state-in-effect`, T-039-introduced) + `src/lib/http/appointmentQuery.ts:55:7` (`prefer-const`, master baseline). **Zero new errors or warnings introduced by T-044** (both files are outside the T-044 diff — see `git diff --name-only bde0321..HEAD` listing below). | `sha256:cc2c71b0f2218b7164a2007fbac71723124d96da1e796fb457f64ee392edd820` |

### T-044 test breakdown (63/63 in 4 files)

- `src/lib/validators/confirmedId.test.ts` — **7 tests** (4 it.each schema + canonical-id helper + null-safety 3-way + never-throws).
- `src/domain/__tests__/appointmentStateMachine.test.ts` — added **6 tests** for `isBannerEligible` (it.each 6 cases including `PENDIENTE/CONFIRMADO` true + `CANCELADO/RECHAZADO/COMPLETADO/unknown` false). Full file 33+ tests; T-044-added 6 pass.
- `src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` — **4 jsdom tests** (PENDIENTE role+Intl, CANCELADO neutral, XSS plain text, dismiss preserves siblings).
- `src/app/(customer)/appointments/page.test.tsx` — **7 node tests** via `it.each` partials (auth null → redirect, valid owned → banner + Suspense + no snake, invalid not-a-uuid, invalid XSS, foreign 403, unknown 404, CANCELADO, RECHAZADO).

## RDD Receipts

Per RDD contract, the T-044 feature commit burned a review receipt.

- **Feature commit** `cae2e8e feat(appointments): T-044 booking result banner + list (RSC + ownership 404 + Suspense dismiss)` — lineage review `review-bb827ad9d168cb8e` — **4 advisory findings** (WARNING / SUGGESTION, informational only; not blockers). Per `apply-progress.md:67-68`, native runtime reports `immutable_review_transport_unsupported`; the orchestrator-tracked receipt is captured for the eligible runtime.
- **Merge commit** `44a58f8 feat(booking-result): merge T-044 — 3 ADDED 11 GWT PASS` — single-PR merge of `cae2e8e` into master. Trimming pass per `apply-progress.md:67` reduced ~1470 → 397 prod+test insertions (now 399 by `git diff --stat` count, well under the 400-line budget — no `size:exception` required).

## Invariant Compliance

| Invariant | Verified | Evidence |
| --- | --- | --- |
| INV-01 capacity 1 | N/A | Capacity is enforced server-side at booking (T-028 atomic `REPEATABLE READ` + `EXCLUDE USING gist`); T-044 is read-only on the result. Banner proves the booking already passed that guard. |
| INV-02 states UPPER_SNAKE | PASS | `appointmentStateMachine.ts:9-14` frozen `AppointmentStatus` tuple (`PENDIENTE`/`CONFIRMADO`/`RECHAZADO`/`CANCELADO`) + `AppointmentStatusSchema` Zod enum. `isBannerEligible` (line 54-56) accepts only `PENDIENTE`/`CONFIRMADO`. Test rejects `COMPLETADO` (`appointmentStateMachine.test.ts:31-34, 189-208`) and confirms `allowedTransitions` has no `COMPLETADO` key (line 42-55). Banner render path has no `COMPLETADO` branch. |
| INV-03 ownership | PASS | Three-layer ownership guard: (a) RSC `page.tsx:40-41` `auth() → redirect("/login")` BEFORE service calls; (b) `appointmentService.getAppointmentById:249-257` calls `loadOr404` + `assertOwnership` (requireAuth.ts:84-87, ADMIN bypass, exact match else `ForbiddenError`); (c) `page.tsx:34-37` `fetchConfirmed` isolated `try/catch` maps both `ForbiddenError` and `AppointmentNotFoundError` to `null` (404 semantics, never 403 body, never `customerId` echo). For the list, `appointmentService.listAppointments:266-268` injects `customerId=authUser.id` for CLIENTE (DB-level scoping). Tests assert foreign UUID string absent from tree (page.test.tsx:60-65) and `B` never called on null session (page.test.tsx:37-41). |
| INV-04 `REPEATABLE READ` + `EXCLUDE USING gist` | N/A | Atomic booking (T-028) — untouched by T-044 (read-only). |
| INV-05 slot generation | N/A | Slot step / duration filter (T-022) — untouched by T-044. |
| INV-06 BA -03:00 TZ | PASS | `BookingConfirmation.tsx:18-21` `Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" })` with `timezone` prop. `page.tsx:65` `timezone={config.timezone}` from `getWorkshopConfig(db)` (= `America/Argentina/Buenos_Aires`). `page.tsx:21-27` `toJson` emits `.toISOString()` (UTC) across the RSC → client boundary. **Never `new Date(`${date}T${slot}`).toISOString()`-style naive display** — `Intl` consumes the UTC `Date` from `new Date(turno.startDateTime)`. `BookingConfirmation.test.tsx:46` asserts BA `09:30` for `2026-09-10T12:30:00.000Z` (UTC-3 = 09:30 local). |
| INV-07 DAG acyclic | PASS | T-044 sits between T-043 (predecessor) and T-045 (successor). No cycle. `tasks.md:69-80` DAG is acyclic. |
| INV-08 camelCase English + ISO + DTO mapping | PASS | `page.tsx:21-27` `toJson(turno): TurnoDTOJson` emits `id, customerId, vehicleId, serviceId, startDateTime, endDateTime, status, createdAt, updatedAt` all camelCase English and `.toISOString()`. `db/mappers/turno.ts:22-34` upstream `toTurnoDTO` is the source of the camelCase renames. `page.test.tsx:24` SNAKE constant asserts `cliente_id / vehiculo_id / servicio_id / fecha_hora_inicio / fecha_hora_fin / estado / created_at / updated_at / fechaHoraInicio / fechaHoraFin / marca / modelo / anio / patente` are all absent from rendered output. |
| INV-CSR-bailout | PASS | `page.tsx:64-70` `<Suspense fallback={null}>` wraps `<BookingConfirmation>` (where `Dismiss` uses `useSearchParams`). Per `next-best-practices:suspense-boundaries.md`, `useSearchParams` in a client component requires a `<Suspense>` boundary in Next 15 to avoid forcing the entire route into a CSR bailout. `page.test.tsx:47` asserts `Suspense` / `fallback` token present in the rendered tree; `pnpm build` succeeds with `/appointments` as `ƒ Dynamic` (no static-prerender bailout). |

## Warnings & Caveats

The verdict is **pass** because all 3 ADDED requirements and all 11 GWT
scenarios are covered with explicit per-invariant and per-threat evidence.
Two informational notes are documented. Neither blocks archive.

1. **INFO — pre-existing infra gap (Postgres not running).**
   11 vitest files / 50 tests fail with `Cannot read properties of
   undefined (reading 'id')` / `connect ECONNREFUSED ::1:5432 /
   127.0.0.1:5432` (Postgres not running locally). These are DB
   integration tests under `src/db/__tests__/{vehiculos,turnos}` and
   `tests/integration/*`. **Identical to master baseline `bde0321` and
   to feature `cae2e8e`** — zero regressions introduced by T-044.
   Out of scope for this verification.

2. **INFO — `immutable_review_transport_unsupported` on native runtime.**
   The OpenCode/Minimax M3 native runtime reports the RDD review
   transport as unavailable; the `sdd-attempt acquire` succeeded with
   `--untracked-scope=exclude` per `apply-progress.md:68`. The
   orchestrator-tracked lineage receipt `review-bb827ad9d168cb8e` is
   burned (4 advisory WARNING/SUGGESTION informational only) and will
   be re-burned on an eligible runtime (claude-code / opencode / codex)
   per the project convention.

## Files Inspected

| Path | Role | Changed by 44a58f8 |
| --- | --- | --- |
| `src/lib/validators/confirmedId.ts` | Client-safe Zod `confirmedIdSchema = z.string().uuid()` + `parseConfirmedId` helper (12 LOC) | yes (create) |
| `src/lib/validators/confirmedId.test.ts` | 7 vitest unit tests (UUID accept/reject + XSS + null-safety + never-throws) (29 LOC) | yes (create) |
| `src/domain/appointmentStateMachine.ts` | Adds `isBannerEligible(status)` predicate (INV-02 guard) (+5 LOC) | yes (edit) |
| `src/domain/__tests__/appointmentStateMachine.test.ts` | Adds 6 isBannerEligible it.each cases (+16/-2 LOC) | yes (edit) |
| `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` | `"use client"` compound `{Banner, Details, Dismiss}` via `createContext + use()` (React 19), `Intl.DateTimeFormat(timeZone)`, `URLSearchParams(toString())` strip-only-`confirmed` + `router.replace({scroll:false})` (69 LOC) | yes (create) |
| `src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` | 4 jsdom + RTL + `userEvent` tests (66 LOC) | yes (create) |
| `src/app/(customer)/appointments/appointments.module.css` | `.successBanner` / `.successBannerDismiss` / `.appointmentsList` / `.appointmentsListEmpty` tokens mirroring `new/appointments.module.css` (35 LOC) | yes (create) |
| `src/app/(customer)/appointments/page.tsx` | RSC `force-dynamic` + `revalidate=0`; `searchParams: Promise<{confirmed?,page?,limit?}>`; `auth() → redirect("/login")`; `parseConfirmedId`; isolated `try/catch` `fetchConfirmed`; `Promise.all([fetchConfirmed, listAppointments])`; `<Suspense fallback={null}>` wrap; `isBannerEligible` guard (84 LOC) | yes (create) |
| `src/app/(customer)/appointments/page.test.tsx` | 7 RSC tests via `it.each` (auth null → redirect, valid owned, invalid, XSS, foreign, unknown, CANCELADO/RECHAZADO) (80 LOC) | yes (create) |
| `src/app/globals.css` | Trailing newline auto-format (no functional change) | yes (edit, +1/-1) |
| `next-env.d.ts` | Next.js auto-managed update (`.next/dev/types` → `.next/types` path) | yes (auto, +2/-2) |
| `src/services/appointmentService.ts` | `getAppointmentById` (249-257) + `listAppointments` (259-275) — **UNCHANGED** by T-044 (reused) | no |
| `src/db/repositories/turnos.ts` | `findTurnoById` + `findTurnosPaginated` — **UNCHANGED** by T-044 (reused) | no |
| `src/db/mappers/turno.ts` | `toTurnoDTO` snake→camel — **UNCHANGED** by T-044 (reused) | no |
| `src/lib/auth/requireAuth.ts` | `assertOwnership` (84-87) + `ForbiddenError` (32-39) — **UNCHANGED** by T-044 (reused) | no |
| `src/lib/auth/auth.ts` | `auth()` — **UNCHANGED** by T-044 (INV-03 guard source) | no |
| `src/config/workshopConfig.ts` | `getWorkshopConfig(db)` — **UNCHANGED** by T-044 (INV-06 TZ source) | no |
| `src/app/api/appointments/route.ts` | POST/GET handlers — **UNCHANGED** by T-044 (reused by T-045 future) | no |
| `openspec/changes/t044-booking-result/{apply-progress,design,explore,proposal,spec,tasks}.md` | SDD artifacts | yes (create) |

### Diff stat (44a58f8 vs bde0321)

```
 .../changes/t044-booking-result/apply-progress.md  |  69 +++++++
 openspec/changes/t044-booking-result/design.md     | 107 ++++++++++
 openspec/changes/t044-booking-result/explore.md    | 154 ++++++++++++++
 openspec/changes/t044-booking-result/proposal.md   |  73 +++++++
 openspec/changes/t044-booking-result/spec.md       |  97 +++++++++
 openspec/changes/t044-booking-result/tasks.md      |  92 ++++++++
 .../_components/BookingConfirmation.test.tsx       |  66 +++++++
 .../_components/BookingConfirmation.tsx            |  69 ++++++++
 .../appointments/appointments.module.css           |  35 ++++
 src/app/(customer)/appointments/page.test.tsx      |  80 +++++++++
 src/app/(customer)/appointments/page.tsx           |  84 +++++++++
 src/app/globals.css                                |   2 +-
 .../__tests__/appointmentStateMachine.test.ts      |  18 ++-
 src/domain/appointmentStateMachine.ts              |   5 +
 src/lib/validators/confirmedId.test.ts             |  29 ++++
 src/lib/validators/confirmedId.ts                  |  12 ++
 17 files changed, 991 insertions(+), 5 deletions(-)
```

Authored prod+test footprint (excluding SDD artifacts, auto-generated
`next-env.d.ts`, and trailing-newline `globals.css`): **+397 insertions
per `apply-progress.md`, or 399 by `git diff --stat` count** — well
under the 400-line budget. No `size:exception` required.

## Recommendation

**PASS — T-044 is ready for archive.**

T-044 closes FASE 8 UI-05 (FL-01 step 9 — booking result feedback).
The RSC `appointments/page.tsx` resolves `?confirmed=<id>` URL-canonically
across refresh / back / share, validates the UUID with `safeParse`, fetches
the owned turno via `getAppointmentById` (mapping `ForbiddenError` /
`AppointmentNotFoundError` to 404 semantics), guards success on
`isBannerEligible` (PENDIENTE | CONFIRMADO only), and co-renders the
upcoming list via `listAppointments` (RN-04 defaults, `customerId`
scoped). The client `BookingConfirmation.Dismiss` strips only
`?confirmed=` and preserves `?page=` / `?limit=` siblings, wrapped in
`<Suspense fallback={null}>` per Next 15 `useSearchParams` CSR-bailout
requirement. INV-02 / INV-03 / INV-06 / INV-08 all hold with explicit
per-invariant test coverage. T-045 is the next dependency in the DAG
and will reuse this page shell for full list filters.

Next dispatcher hop: `sdd-archive` (sync delta specs to
`openspec/specs/booking-result/spec.md`, move change to
`openspec/changes/archive/2026-09-01-t044-booking-result/`).
