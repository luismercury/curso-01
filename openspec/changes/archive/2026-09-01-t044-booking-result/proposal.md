# Proposal: t044-booking-result — Mostrar resultado de la reserva

## Intent

FL-01 step 9: `BookingForm` pushes `/appointments?confirmed=<id>` on 201 but target is 404. Show success banner if creada, else no banner. 409 race stays in `BookingForm`.

## Scope

### In Scope
- RSC `src/app/(customer)/appointments/page.tsx` — `async searchParams`, `force-dynamic`, `auth()` guard, `Promise.all([getWorkshopConfig, getAppointmentById?, listAppointments])` limit 20 RN-04.
- Compound `_components/BookingConfirmation.tsx` — `Banner/Details/Dismiss`, `role="status"`, dismiss `router.replace("/appointments",{scroll:false})`.
- CSS `appointments.module.css` — `.successBanner` tokens.
- Fetch: UUID `safeParse`, `Forbidden→404`, `Intl` with `config.timezone`, `Suspense` for dismiss.

### Out of Scope
- T-045 filters, admin panel, new API/migration, toast, EXCLUDE (T-028).

## Capabilities

### New Capabilities
- `booking-result`: banner + list on `/appointments` (RSC fetch, 404-mapped ownership).

### Modified Capabilities
- None — additive UI only.

## Approach

Option A. Await `searchParams`, UUID validate, `try/catch getAppointmentById` → `PENDIENTE`/`CONFIRMADO` = banner, `CANCELADO`/`RECHAZADO` = neutral, invalid/foreign = no banner. Co-render `listAppointments` (`clienteId` scoped, `fechaHoraInicio>now`). `TurnoDTOJson` ISO across boundary (INV-08), `Intl` with `config.timezone` (INV-06). Only client part is dismiss `<Suspense>`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(customer)/appointments/page.tsx` | New | RSC shell, parallel fetches, banner+list |
| `src/app/(customer)/appointments/_components/BookingConfirmation.tsx` | New | Compound banner + dismiss island |
| `src/app/(customer)/appointments/appointments.module.css` | New | Success tokens |
| `src/services/appointmentService.ts` / `src/db/repositories/turnos.ts` | Read | Reuse `getAppointmentById`/`listAppointments` |
| `openspec/specs/booking-result/spec.md` | New | Canonical spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UUID enumeration via `?confirmed=` | Low | `ForbiddenError` → 404, no `customerId` leak |
| Stale `CANCELADO`/`RECHAZADO` shows success | Med | Guard: success only `PENDIENTE`/`CONFIRMADO` |
| `useSearchParams` CSR bailout | High if missed | `<Suspense fallback={null}>` around dismiss |
| Line budget >400 | Low | ~250 prod, single PR |
| Timezone drift | Low | `Intl` with `config.timezone`, no hardcode |

## Alternatives Considered

| Alt | Summary | Verdict |
|-----|---------|---------|
| A RSC fetch+client dismiss | Zero waterfall, ownership before HTML, fits precedent | **Chosen** |
| B Client fetch `/api/appointments/:id` | Needs new route, RTT+flash, breaks D1 | Rejected |
| C Cookie flash | One-shot, breaks refresh/share, couples POST | Rejected |
| D Toast only | Stays on stale form, weak a11y | Rejected |

## Rollback Plan

Revert deletes `page.tsx`+`_components/`+CSS; `/appointments` → 404. Hotfix redirect `?confirmed=` to `/appointments/new`. No migration.

## Dependencies

- T-028 + T-043 done. T-045 future consumer — not blocker. `getWorkshopConfig(db)` per-request.

## Success Criteria

- [ ] `?confirmed=<own-uuid>` shows `role="status"` banner with ISO times, dismiss strips only `confirmed`.
- [ ] Invalid/foreign/not-found → no banner/neutral, never 403.
- [ ] Unauthenticated → `/login` redirect.
- [ ] List via `listAppointments` RN-04, DTO camelCase/ISO.
- [ ] Single PR <400 lines, no API/migration.
