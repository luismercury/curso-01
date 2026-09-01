# Apply Progress — t044-booking-result

> Worktree: `C:/Users/Luis Mercury/proyectos/curso-01-t044` on `feature/t044-booking-result` from `master bde0321`.
> Authored count: **~397 prod+test insertions** (vs 400 budget — **FIT**).
> Token (native runtime): `sha256:955343232569013b303cee462b0a2d0ba2b1c59d0276d47af9c40427a8bd3fbb`.
> No `size:exception` required.

## Tasks

- [x] 1.1 `src/lib/validators/confirmedId.ts` — `confirmedIdSchema` (`z.string().uuid()`) + `parseConfirmedId` helper (pure, client-safe).
- [x] 1.2 `src/lib/validators/confirmedId.test.ts` — 7 vitest cases (uuid accept/reject/XSS/null-safety/never-throws).
- [x] 1.3 `src/domain/appointmentStateMachine.ts` — `isBannerEligible(status)` predicate (INV-02 guard).
- [x] 1.3 `src/domain/__tests__/appointmentStateMachine.test.ts` — `isBannerEligible` cases via `it.each`.
- [x] 1.4 `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` — `"use client"` compound with `createContext + use()` (React 19). Statics: `Banner` (`role="status"`, `aria-live="polite"`), `Details` (`Intl.DateTimeFormat` with `timezone`), `Dismiss` (`useSearchParams + useRouter.replace({ scroll: false })`, strips only `confirmed`, preserves siblings).
- [x] 1.5 `src/app/(customer)/appointments/appointments.module.css` — `.successBanner`, `.successBannerDismiss`, `.appointmentsList`, `.appointmentsListEmpty` tokens; success colors scoped locally.
- [x] 1.5b `src/app/globals.css` — reverted; success tokens moved to `appointments.module.css`.
- [x] 1.6 `src/app/(customer)/appointments/page.tsx` — RSC `force-dynamic`, `revalidate=0`, `searchParams: Promise<{confirmed?,page?,limit?}>`. `auth() → redirect("/login")`. `parseConfirmedId(candidate) → safeParse` (D4). `fetchConfirmed` isolated try/catch → null on `ForbiddenError` / `AppointmentNotFoundError` (D9). `Promise.all([fetchConfirmed, listAppointments])`. `isBannerEligible` guard for the banner. `<Suspense fallback={null}>` wraps `BookingConfirmation` (CSR-bailout rule for `useSearchParams` in `Dismiss`).
- [x] 2.1 `src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` — 4 jsdom cases (PENDIENTE role/Intl, CANCELADO neutral, XSS plain text, dismiss siblings).
- [x] 2.2 `src/app/(customer)/appointments/page.test.tsx` — 7 node cases via `it.each` (auth null → redirect, valid owned → banner + Suspense + snake no-leak, invalid UUID/XSS, foreign 403, unknown 404, CANCELADO/RECHAZADO neutral).
- [x] 2.3 Verification — `pnpm vitest run` (185 T-044 tests pass), `pnpm typecheck` (clean), `pnpm build` (green, `/appointments` registered as `ƒ Dynamic`).

## Files Changed (prod+test)

| File | Action | Ins (+)/Del (-) |
|------|--------|-----------------|
| `src/lib/validators/confirmedId.ts` | Create | +12 |
| `src/lib/validators/confirmedId.test.ts` | Create | +29 |
| `src/domain/appointmentStateMachine.ts` | Edit | +5 |
| `src/domain/__tests__/appointmentStateMachine.test.ts` | Edit | +16 / -2 |
| `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` | Create | +69 |
| `src/app/(customer)/appointments/_components/BookingConfirmation.test.tsx` | Create | +66 |
| `src/app/(customer)/appointments/appointments.module.css` | Create | +35 |
| `src/app/(customer)/appointments/page.tsx` | Create | +84 |
| `src/app/(customer)/appointments/page.test.tsx` | Create | +80 |
| `src/app/globals.css` | Edit | +1 / -1 (revert; success tokens moved to local module) |
| **prod+test total** | | **+397 insertions** |

Excluded from budget: `openspec/changes/t044-booking-result/{apply-progress,design,explore,proposal,spec,tasks}.md` (SDD artifacts).

## Verification Receipts

- `pnpm vitest run src/lib/validators/confirmedId.test.ts src/domain/__tests__/appointmentStateMachine.test.ts 'src/app/(customer)/appointments'` → **185 passed**, 0 failed.
- `pnpm vitest run` (full) → 1229 passed, 50 pre-existing DB-integration failures on master NOT in scope.
- `pnpm typecheck` → clean.
- `pnpm build` → green, route table shows `/appointments` as `ƒ Dynamic` (server-rendered on demand), `force-dynamic` honored.

## GWT Coverage

11 GWT scenarios from `spec.md` all exercised:

| ID | Scenario | Test |
|----|----------|------|
| R1.1 | Valid owned UUID fetches turno | `page.test.tsx — valid owned → banner composed + Suspense + no snake leak` |
| R1.2 | Invalid UUID skips fetch | `page.test.tsx — invalid not-a-uuid / XSS payload` (it.each) |
| R1.3 | Foreign UUID maps 403→404 generic | `page.test.tsx — foreign UUID + error → banner absent` |
| R1.4 | Unknown UUID maps 404 generic | `page.test.tsx — unknown UUID → banner absent` |
| R2.1 | PENDIENTE/CONFIRMADO shows success with TZ | `BookingConfirmation.test.tsx — PENDIENTE → role=status + Intl BA 09:30` |
| R2.2 | Dismiss strips only confirmed | `BookingConfirmation.test.tsx — strips only confirmed, keeps page/limit` |
| R2.3 | Unauthenticated redirects | `page.test.tsx — null session → redirect('/login'), no service calls` |
| R3.1 | CANCELADO/RECHAZADO shows neutral | `page.test.tsx — status=CANCELADO|RECHAZADO → banner absent` (it.each) + `BookingConfirmation.test.tsx — CANCELADO → no banner` |
| R3.2 | Invalid still renders list RN-04 defaults | `page.test.tsx — invalid UUID → appointments-list renders` |
| R3.3 | Coexistence preserves both params | `BookingConfirmation.test.tsx — keeps page/limit siblings` + `page.test.tsx — list renders alongside banner` |
| R3.4 | DTO shape camelCase ISO | `page.test.tsx — assert no snake_case keys in tree` |

## Risks / Decisions Needed

- **Budget fit**: original commit was ~1470 insertions vs 400 budget; trimming pass reduced to **397 prod+test insertions**, fitting the budget. No `size:exception` required. Trimmed JSDoc/architectural comments (kept only single-line comments), tightened test descriptions, combined related tests via `it.each`, and reverted globals.css (success tokens moved to module-local).
- **Native runtime authority**: `gentle-ai review status` reports `immutable_review_transport_unsupported` for this runtime. `sdd-attempt acquire` succeeded with `--untracked-scope=exclude --expected-untracked-inventory=sha256:a27a8136233871ff0386917a064c190cddc7e0fddd4839a910ec0e65d36d1459`, token retained: `sha256:955343232569013b303cee462b0a2d0ba2b1c59d0276d47af9c40427a8bd3fbb`. RDD commit-time review will burn receipt when the orchestrator processes the commit through an eligible runtime (claude-code / opencode / codex).
- **Pre-existing test failures**: 50 integration test failures exist on master (DB singleton + route scanner) — NOT in T-044 scope. Do NOT bundle fixes into this PR.
