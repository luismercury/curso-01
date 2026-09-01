# Tasks: t044-booking-result — Mostrar resultado de la reserva

> Single-PR work-unit commits. Delivery: `single-pr` per preflight. Chain strategy: `none`. Budget <400 lines.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280 total: 110 page.tsx + 70 BookingConfirmation.tsx + 25 CSS + 50 page.test.tsx + 45 BookingConfirmation.test.tsx (test stubs + receipts excluded from authored count) |
| 400-line budget risk | Low (<300 prod+test authored) |
| Chained PRs recommended | No |
| Suggested split | Single PR (single work-unit commit `feat(appointments): T-044 booking result banner + list` per `work-unit-commits` skill) |
| Delivery strategy | single-pr |
| Chain strategy | none (single-pr) |
| Decision needed before apply | No (size:exception not needed; <400) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: none
400-line budget risk: Low

> Forecast locked at low risk. If a later task grows (e.g., `serviceName`/`vehicleLabel` join adds >50 LOC), flag `size:exception` and re-check before apply. Do not silently chain — `delivery_strategy=single-pr` blocks split per preflight.

### Suggested Work Units (within the single PR)

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1.1 | `confirmedIdSchema` validator (pure, client-safe) | `pnpm vitest run src/lib/validators/confirmedId.test.ts` | N/A (pure validator) | new file |
| 1.2 | `isBannerEligible(status)` predicate (INV-02 guard) | `pnpm vitest run src/domain/appointmentStateMachine.test.ts` | N/A | extend existing or new file |
| 2.1 | `BookingConfirmation` compound + `.successBanner` CSS | `pnpm vitest run src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` | `pnpm dev` navigate `/appointments?confirmed=<own-uuid>` | new files |
| 2.2 | `appointments/page.tsx` RSC: auth gate, `Promise.all`, UUID `safeParse`, ownership 404, list coexistence | `pnpm vitest run src/app/(customer)/appointments/page.test.tsx` | `pnpm dev` Confirm from T-043 → banner → dismiss | new file |
| 3.1 | RDD receipts + final commit | `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build` | dev-server full chain | — |

## Phase 1: Production (~205 LOC prod, 1 work-unit commit)

Branch: `feature/t044-booking-result` from `master` (single PR base = `master`).

- [x] 1.1 Create `src/lib/validators/confirmedId.ts` — `confirmedIdSchema = z.string().uuid()`; pure, client-safe (no `server-only`); reused by page + tests. Files: `confirmedId.ts`. Deps: none. Est: ~10 LOC. [GWT R1.2 invalid UUID]

- [x] 1.2 Create `src/lib/validators/confirmedId.test.ts` — vitest: uuid accept, `"not-a-uuid"` reject, XSS payload `<script>alert(1)</script>` reject, empty reject, `safeParse` never throws. Files: `confirmedId.test.ts`. Deps: 1.1. Est: ~30 test LOC. [GWT R1.2 XSS, RED threat-matrix XSS row]

- [x] 1.3 Create `src/domain/__tests__/bannerEligibility.test.ts` (or extend `appointmentStateMachine.test.ts`) — `isBannerEligible(status)` returns `true` only for `"PENDIENTE"|"CONFIRMADO"`, `false` for `"CANCELADO"|"RECHAZADO"` and any unknown string (no `COMPLETADO` leak, INV-02). Files: test file. Deps: none. Est: ~15 test LOC. [GWT R3.1 CANCELADO/RECHAZADO neutral, RED threat-matrix stale `CANCELADO` row]

- [x] 1.4 Create `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` — `"use client"`; compound via `createContext + use()` (React 19); static exports `BookingConfirmation`, `BookingConfirmation.Banner` (RSC-safe server element with `role="status"` `aria-live="polite"`), `BookingConfirmation.Details` (renders `startDateTime`/`endDateTime` via `Intl.DateTimeFormat({timeZone: timezone, dateStyle:"full", timeStyle:"short"})`, vehicle/service IDs as plain text — no `dangerouslySetInnerHTML`), `BookingConfirmation.Dismiss` (`useSearchParams()` + `useRouter()`, builds `URLSearchParams(searchParams.toString())`, deletes only `confirmed`, calls `router.replace("/appointments?"+qs.toString(),{scroll:false})`); wrapped in `<Suspense fallback={null}>` per D11/CSR-bailout threat. Receives `turno: TurnoDTOJson` (ISO strings) + `timezone: string` from RSC. Files: `BookingConfirmation.tsx`. Deps: 1.1, 1.3. Est: ~70 prod LOC. [GWT R2.1 PENDIENTE TZ, R2.2 dismiss siblings, R3.3 coexistence, R3.4 DTO shape, RED threat-matrix CSR-bailout row]

- [x] 1.5 Create `src/app/(customer)/appointments/appointments.module.css` — `.successBanner` (`--color-success` token, matches radius/spacing of `new/appointments.module.css` `.errorBannerDestructive`), `.successBannerHeader`, `.successBannerDetails`, `.successBannerDismiss`, `.successBannerDismissIcon`, `.appointmentsList`, `.appointmentsListEmpty`; mirrors existing tokens, no Tailwind. Files: `appointments.module.css`. Deps: none. Est: ~25 prod LOC.

- [x] 1.6 Create `src/app/(customer)/appointments/page.tsx` — RSC `force-dynamic`/`revalidate=0`; `searchParams: Promise<{confirmed?:string; page?:string; limit?:string}>` (Next 15 async, **also accepts `page`/`limit` for RN-04 list coexistence per D8**); `auth() → redirect("/login")` guard (INV-03); `const config = await getWorkshopConfig(db)` per-request (T-036b invariant); parse `confirmed` via `confirmedIdSchema.safeParse(candidate).success` (D4); in isolated `try { const confirmedTurno = valid ? await getAppointmentById({db,config}, candidate, authUser) : null } catch { confirmedTurno = null }` — **D9 isolates banner fetch from list**; in parallel `Promise.all` with `listAppointments({db,config}, {page:Number(page)||1, limit:Number(limit)||20}, authUser)` (RN-04 defaults, CLIENTE scoped `customerId=authUser.id`); render `<BookingConfirmation turno={toJson(confirmedTurno)} timezone={config.timezone} />` only when `confirmedTurno && isBannerEligible(confirmedTurno.status)`; render `<UpcomingList data={list.data} pagination={list.pagination} />` (server, simple `<ol>` with `Intl` formatted dates + `serviceName`/`vehicleLabel` placeholders if T-045 not ready — fall back to IDs gracefully, document as known gap). Auth `null` ⇒ `redirect("/login")` BEFORE any service call (R2.3). Files: `page.tsx`. Deps: 1.1, 1.3, 1.4, 1.5. Est: ~110 prod LOC. [GWT R1.1 valid owned, R1.3 foreign 403→404, R1.4 unknown 404, R3.1 CANCELADO/RECHAZADO, R3.2 RN-04 list, R2.3 unauthenticated redirect, R3.3 coexistence]

## Phase 2: Tests & Verification (~95 LOC test, same commit)

- [x] 2.1 Create `src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` — vitest jsdom + RTL + `userEvent`: render `<BookingConfirmation><BookingConfirmation.Banner turno={ownedJson("PENDIENTE")} tz="America/Argentina/Buenos_Aires" /><BookingConfirmation.Details ... /></BookingConfirmation>` → asserts `role="status"` + `aria-live="polite"`; `startDateTime="2026-09-10T12:30:00.000Z"` formatted via `Intl.DateTimeFormat` shows `"09:30"` BA (R2.1); render with `status="CANCELADO"` → banner `null`, only details neutral (R3.1); click Dismiss → `router.replace` called with `/appointments?page=2&limit=20` (siblings preserved, `scroll:false`, only `confirmed` stripped) (R2.2); render with XSS payload as `vehicleId="<script>alert(1)</script>"` → no `<script>` in output, plain text only (RED XSS threat); render Dismiss without `<Suspense>` parent → still works (Suspense boundary is in page.tsx, not here — assert by checking wrapper exists in page test). Files: `BookingConfirmation.test.tsx`. Deps: 1.4, 1.5. Est: ~45 test LOC. [GWT R2.1, R2.2, R3.1, RED XSS row]

- [x] 2.2 Create `src/app/(customer)/appointments/page.test.tsx` — vitest node + `auth()` mock + service stubs: `auth()` null → `redirect("/login")` called, no `getAppointmentById` invoked (R2.3); valid owned UUID + service returns DTO → `BookingConfirmation` rendered with ISO times (R1.1); `"not-a-uuid"` → no `getAppointmentById` call, banner absent, list still rendered (R1.2, R3.2); valid foreign UUID + service throws `ForbiddenError` → banner absent, no `customerId`/`estado` leak in output (R1.3, RED enumeration row); valid unknown UUID + service throws `AppointmentNotFoundError` → banner absent (R1.4); valid UUID + DTO `status="CANCELADO"` → banner absent, neutral fallback (R3.1, RED stale `CANCELADO` row); `?confirmed=<uuid>&page=2&limit=20` → `listAppointments` called with `{page:2, limit:20}` (R3.3 coexistence); rendered HTML inspected — no `clienteId`/`estado`/`fecha_hora_inicio`/`vehiculo_id`/`servicio_id` strings (INV-08 / R3.4 DTO shape); assert `<Suspense fallback={null}>` wraps the `BookingConfirmation` boundary in the page output (RED CSR-bailout row, Next 15 `useSearchParams` requirement). Files: `page.test.tsx`. Deps: 1.6. Est: ~50 test LOC. [GWT R1.1..R1.4, R2.3, R3.1..R3.4, RED 4 threat-matrix rows]

- [x] 2.3 Run `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build` — full suite green; total budget ≤400. Files: all. Deps: 2.1, 2.2. **OVERRUN NOTE**: actual authored count = ~1470 insertions (vs 400 budget) — see `apply-progress.md`. Pre-existing 2 test failures + 2 lint errors on master NOT in scope. `/appointments` registered as `ƒ Dynamic`.

- [x] 2.4 Single work-unit commit `feat(appointments): T-044 booking result banner + list (RSC + ownership 404 + Suspense dismiss)` with RDD receipt covering R1/R2/R3 GWT + 4 RED threat rows. Files: all. Deps: 2.3. Branch: `feature/t044-booking-result` from `master`. PR base = `master`. **OVERRUN**: actual ~1470 insertions vs 400 budget — see `apply-progress.md` Risks. Orchestrator decision pending (accept / trim / chain).

## Phase 3: Verify + Archive (post-merge)

- [ ] 3.1 Run independent `sdd-verify` agent against merged master; PASS required for archive. Files: `openspec/changes/t044-booking-result/verify-report.md`.

- [ ] 3.2 Run `sdd-archive` agent to move change to `openspec/changes/archive/2026-09-01-t044-booking-result/` + sync `openspec/specs/booking-result/spec.md` delta + record receipt. Files: archive dir.

- [ ] 3.3 `git push origin master` (or use `gentle-ai review` gate per RDD). Files: all.

## DAG (acyclic, fed by T-043)

```
1.1 → 1.2                        (validator + RED test)
1.3 → 1.4                        (eligibility guard + compound)
1.4, 1.5 → 2.1                   (compound + CSS + RED tests)
1.1, 1.3, 1.4, 1.5 → 1.6         (RSC page composition)
1.6 → 2.2                        (RSC tests)
2.1, 2.2 → 2.3 → 2.4             (full suite + single commit)
2.4 → 3.1 → 3.2 → 3.3            (verify + archive + push)
```

Predecessors: T-028 (atomic) + T-043 (`?confirmed=` contract) DONE at master. Successor: T-045 reuses this page shell for full list filters.

## Reviewer Focus

Per `design.md` § Reviewer Focus + 11 GWT + threat matrix:

1. **UUID safety + ownership 404** (R1.1..R1.4) — `safeParse` guards XSS; isolated `try/catch` maps `ForbiddenError`/`AppointmentNotFoundError` to neutral, never 403 body, no `customerId` echo.
2. **INV-02 state guard** (R3.1) — `isBannerEligible` is the single source of truth; no `COMPLETADO` branch.
3. **INV-06 timezone** (R2.1) — `Intl.DateTimeFormat({timeZone: config.timezone})` with `America/Argentina/Buenos_Aires`; ISO strings cross the boundary, never `-03:00` string slicing on display.
4. **INV-08 no-leak** (R3.4) — only `TurnoDTOJson` camelCase/ISO across RSC→client; no `clienteId`/`estado`/`fecha*`/`vehiculo_id`/`servicio_id` in rendered HTML or test fixtures.
5. **D7 dismiss** (R2.2) — `URLSearchParams(searchParams.toString())` strips only `confirmed`, preserves `page`/`limit`/`sort` siblings; `scroll:false`; `<Suspense fallback={null}>` wraps `useSearchParams` per Next 15 CSR bailout rule.
6. **D8 list coexistence** (R3.3) — same RSC resolves both `confirmed` and `page`/`limit`; banner failure isolated from list per D9.
7. **Budget** — single PR ≤300 prod+test authored (well under 400). No chain. No `size:exception` needed.