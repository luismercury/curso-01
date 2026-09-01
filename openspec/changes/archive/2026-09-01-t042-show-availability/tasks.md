# Tasks: t042-show-availability — Mostrar disponibilidad

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~333 (production ~213 + tests ~120) |
| 400-line budget risk | Low |
| Chained PRs recommended | No (single PR fits) |
| Suggested split | Single PR (`feature/t042-show-availability`) |
| Delivery strategy | auto-chain |
| Chain strategy | pending (feature-branch-chain kept as fallback) |
| Decision needed before apply | No |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

> ~333L < 400 cap; `auto-chain` proceeds without asking. If post-apply diff
> exceeds 400, split PR-A (1.1–1.5) → PR-B (2.1–2.3) → PR-C (3.1–3.3) on
> `feature/t042-show-availability` tracker; each PR base = previous PR branch.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | validator + RSC fetch + CSS + RSC test | PR-A | `pnpm vitest run src/lib/validators/slot.test.ts src/app/(customer)/appointments/new/page.test.tsx` | `pnpm dev` deep-link `?serviceId=&date=` → grid or empty | `page.tsx` reverts to T-041 shell; no API change |
| 2 | AvailabilitySlots compound + wiring | PR-B | `pnpm vitest run src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx` | `pnpm dev` click slot → `?slot=` siblings preserved | new file, removable without page.tsx branch edit |
| 3 | e2e + docs/RDD | PR-C | `pnpm playwright test t042` | browser deep-link → click → refresh survives | tests/docs only |

## Phase 1: Foundation + RSC Integration

- [x] 1.1 Create `src/lib/validators/slot.ts` — `slotSchema = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/)` (INV-05 step 30); pure, client-safe, no `server-only`. Files: `slot.ts`. Deps: none. Est: ~8 LOC.
- [x] 1.2 Create `src/lib/validators/slot.test.ts` — vitest: accept `09:00`/`09:30`/`23:30`, reject `25:00`/`9:00`/`09:60`/empty/undefined, `safeParse` never throws. Files: `slot.test.ts`. Deps: 1.1. Est: ~30 LOC.
- [x] 1.3 Modify `src/app/(customer)/appointments/new/page.tsx` — keep `force-dynamic` + `Promise.all([config,services])`; after `selectedService && selectedDate` valid branch call `getAvailableSlotsForDate({date:new Date(selectedDate+"T12:00:00.000Z"), durationMinutes: selectedService.durationMinutes, config:{timezone,slotStepMinutes,capacityPerSlot,operatingHours}, fetchActiveTurnos:(r)=>findActiveTurnosByDateRange(db,r)})` → `formatSlotsAsHHmm(slots, config.timezone)` → `availableSlots: string[] | null` (`null` invalid, `[]` closed/booked). Import `findActiveTurnosByDateRange`, `getAvailableSlotsForDate`, `formatSlotsAsHHmm`. Tampered/inactive → `null`, no domain call. Files: `page.tsx`. Deps: 1.1, T-025/T-041 DONE. Est: +40 LOC. [GWT Valid pair, Tampered, Auth gates fetch, Closed vs booked]
- [x] 1.4 Extend `src/app/(customer)/appointments/new/appointments.module.css` — add `.slotGrid` (grid 2-4 cols), `.slotButton` + `:hover`, `.slotSelected` (fill+border), `.slotEmpty` (centered muted). No Tailwind. Files: `appointments.module.css`. Deps: none. Est: +50 LOC.
- [x] 1.5 Create/extend `src/app/(customer)/appointments/new/page.test.tsx` — RSC integration: `auth() null` → `redirect("/login")`; tampered `?serviceId=garbage` or `?date=2026-02-30` → `availableSlots=null`; past/overflow → `null`; closed Sunday + `[0,6]` → `[]` "Closed"; valid 60min no turnos → `[<HH:mm>...]`; valid 90min + `11:30+90>12:00` → absent. Files: `page.test.tsx`. Deps: 1.3, 1.4. Est: ~80 LOC. [GWT Valid pair, Tampered, Duration, Closed vs booked, Auth gates fetch]

## Phase 2: Client Island Compound

- [x] 2.1 Create `src/app/(customer)/appointments/new/_components/AvailabilitySlots.tsx` — `"use client"`; `createContext`+`use()` carries `slots`, `date`, `serviceId`, `vehicleId`, `closedDows`, `timezone`, `selectedSlot` resolved, `selectSlot(hhmm)`; `selectSlot` uses `new URLSearchParams(searchParams.toString())` set/delete `slot`, then `router.push(query ? pathname+"?"+query : pathname, {scroll:false})`; tampered `?slot=25:00` → no `aria-checked`. Statics: `Grid` (`role="radiogroup"` + per-slot `<button type="button" role="radio" aria-checked onClick={()=>selectSlot(hhmm)}>`), `Empty` (closed copy if `closedDows.includes(getBaDow(date,tz))` else EC-02), `SelectedBanner` (only when `serviceId && date && selectedSlot` valid). Files: `AvailabilitySlots.tsx`. Deps: 1.1, 1.4. Est: ~105 LOC. [GWT Selection preserves siblings, Clear/invalid, Closed vs booked]
- [x] 2.2 Create `src/app/(customer)/appointments/new/_components/AvailabilitySlots.test.tsx` — jsdom+RTL + `userEvent.click`: Grid renders one radio per slot; click `09:30` → `router.push` with `?serviceId=&date=&vehicleId=&slot=09%3A30` + `{scroll:false}`; clear → URL without slot, banner hidden; tampered `?slot=25:00` → no `aria-checked=true`, no 500; Empty "Closed" vs "No availability"; banner hidden when missing `serviceId/date/slot`. Files: `AvailabilitySlots.test.tsx`. Deps: 2.1. Est: ~60 LOC. [GWT Selection preserves siblings, Clear/invalid, Closed vs booked]
- [x] 2.3 Modify `src/app/(customer)/appointments/new/page.tsx` — render `<AvailabilitySlots slots={availableSlots} date={selectedDate} serviceId={selectedService.id} vehicleId={vehicleId} closedDows={closedDows} timezone={tz}><AvailabilitySlots.Grid/><AvailabilitySlots.Empty/><AvailabilitySlots.SelectedBanner/></AvailabilitySlots>` inside `selectedService && selectedDate` branch. Keep CTA branch + `force-dynamic` unchanged. Files: `page.tsx`. Deps: 2.1, 1.3. Est: +20 LOC.

## Phase 3: Verification + Handoff

- [x] 3.1 Add `tests/e2e/t042-availability-display.spec.ts` — Playwright: deep-link `?serviceId=<uuid>&date=<future weekday>` → grid → click `09:30` → URL contains `slot=09%3A30` siblings intact → refresh → selection survives → clear via `delete("slot")` → banner hidden. Files: `t042-availability-display.spec.ts`. Deps: 2.2, 2.3. Est: ~40 LOC. [GWT Selection preserves siblings, Loading vs empty vs error]
- [x] 3.2 Run `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` — full suite green; verify INV-08 (no `fecha`/`fechaHoraInicio`/`patente`/`marca`/`cliente_id` in new HTML). Files: all. Deps: 1.x, 2.x. Est: ~5 min.
- [x] 3.3 Commit `feat(appointments): T-042 availability display (RSC + grid compound)` with RDD receipt linking `tasks.md` + spec/design IDs. If `git diff --stat` > 400, split per forecast. Files: all. Deps: 3.2.

## DAG (acyclic, feeds T-043)

`1.1→1.2` · `1.1,1.4→1.3→1.5` · `1.4→2.1→2.2` · `2.1,1.3→2.3` · `2.2,2.3→3.1→3.2→3.3`.
Predecessors: T-025 DONE (domain + `route.ts:96-97` adapter), T-041 DONE (`DateSelector` precedent + URL validation) — confirmed at `master=3c4fb7f`.
Successor: T-043 reads `searchParams.slot` verbatim alongside `serviceId/date/vehicleId`.
